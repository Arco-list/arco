"use server"

import { createServerSupabaseClient, createServerActionSupabaseClient } from "@/lib/supabase/server"

const stripWww = (h: string) => h.replace(/^www\./, "").toLowerCase()

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url)
    return stripWww(parsed.hostname)
  } catch {
    return null
  }
}

export type DomainCheckResult =
  | { status: "invalid" }
  | { status: "unclaimed" }
  | { status: "claimable"; companyName: string; companyId: string }
  | { status: "claimed"; companyName: string; companyId: string }
  | { status: "owned"; companyName: string; companyId: string; professionalId: string }

export async function checkDomainOwnership(url: string): Promise<DomainCheckResult> {
  const domain = extractDomain(url)
  if (!domain) return { status: "invalid" }

  const supabase = await createServerSupabaseClient()

  // Find companies with a matching domain
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, domain, is_verified, setup_completed")
    .not("domain", "is", null)

  if (!companies?.length) return { status: "unclaimed" }

  // Match domain (strip www and protocol from stored domain)
  const match = companies.find((c) => {
    if (!c.domain) return false
    const stored = stripWww(c.domain.replace(/^https?:\/\//i, "").split("/")[0])
    return stored === domain
  })

  if (!match) return { status: "unclaimed" }

  // Check if the current user owns this company
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: professional } = await supabase
      .from("professionals")
      .select("id, company_id")
      .eq("user_id", user.id)
      .eq("company_id", match.id)
      .maybeSingle()

    if (professional) {
      return {
        status: "owned",
        companyName: match.name ?? "",
        companyId: match.id,
        professionalId: professional.id,
      }
    }
  }

  // Company exists but is not verified and setup not completed — claimable by anyone
  const isVerified = Boolean((match as any).is_verified)
  const setupCompleted = Boolean((match as any).setup_completed)

  if (!isVerified && !setupCompleted) {
    return {
      status: "claimable",
      companyName: match.name ?? "",
      companyId: match.id,
    }
  }

  return {
    status: "claimed",
    companyName: match.name ?? "",
    companyId: match.id,
  }
}

export type AutoCreateCompanyResult =
  | { success: true; companyId: string; professionalId: string }
  | { success: false; error: string }

/**
 * Auto-create or claim a company from a URL domain.
 * If claimableCompanyId is provided, claims that existing company instead of creating new.
 * Otherwise creates a new company using Google Places data.
 */
export async function autoCreateCompanyFromDomain(domain: string, claimableCompanyId?: string): Promise<AutoCreateCompanyResult> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in." }

  // Check if user already has a company
  const { data: existingPro } = await supabase
    .from("professionals")
    .select("id, company_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (existingPro?.company_id) {
    return { success: true, companyId: existingPro.company_id, professionalId: existingPro.id }
  }

  // If there's a claimable company, take ownership of it
  if (claimableCompanyId) {
    // Update company owner
    await supabase
      .from("companies")
      .update({ owner_id: user.id })
      .eq("id", claimableCompanyId)

    // Remove old professional links to this company (except the current user's)
    await supabase
      .from("professionals")
      .delete()
      .eq("company_id", claimableCompanyId)
      .neq("user_id", user.id)

    // Link current user's professional record to this company (upsert)
    const { data: existingUserPro } = await supabase
      .from("professionals")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    let newPro: { id: string } | null = null
    let proError: any = null

    if (existingUserPro) {
      // Update existing record to point to the claimed company
      const { error } = await supabase
        .from("professionals")
        .update({ company_id: claimableCompanyId, title: domain })
        .eq("id", existingUserPro.id)
      proError = error
      newPro = existingUserPro
    } else {
      // Create new professional record
      const { data, error } = await supabase
        .from("professionals")
        .insert({
          title: domain,
          user_id: user.id,
          company_id: claimableCompanyId,
        })
        .select("id")
        .single()
      proError = error
      newPro = data
    }

    if (proError || !newPro) {
      console.error("[autoCreateCompany] Claim professional error:", proError)
      return { success: false, error: `Could not claim company: ${proError?.message ?? "unknown error"}` }
    }

    // Promote user to professional type
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_types")
      .eq("id", user.id)
      .maybeSingle()

    const currentTypes = Array.isArray(profile?.user_types) ? profile.user_types : []
    if (!currentTypes.includes("professional")) {
      await supabase
        .from("profiles")
        .update({ user_types: [...currentTypes, "professional"] })
        .eq("id", user.id)
    }

    return { success: true, companyId: claimableCompanyId, professionalId: newPro.id }
  }

  // Try to find the company via Google Places Text Search using the domain
  let companyName = domain
    .replace(/\.(com|nl|co\.uk|org|net|io|eu|de|fr|be)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

  let companyAddress: string | null = null
  let companyCity: string | null = null
  let companyCountry: string | null = null
  let companyPhone: string | null = null
  let googlePlaceId: string | null = null

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (mapsKey) {
    try {
      // Try multiple search queries: company name, then domain, then domain URL
      const searchQueries = [
        companyName,
        domain,
        `https://${domain}`,
      ]

      let placeId: string | null = null

      for (const query of searchQueries) {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=name,place_id,formatted_address&key=${mapsKey}`
        )
        const data = await res.json()
        console.log(`[autoCreateCompany] Places search for "${query}":`, JSON.stringify(data?.candidates?.length ?? 0), "candidates")

        if (data?.candidates?.[0]?.place_id) {
          placeId = data.candidates[0].place_id
          break
        }
      }

      // Get detailed info from Place Details API
      if (placeId) {
        const detailRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,address_components,website&key=${mapsKey}`
        )
        const detailData = await detailRes.json()
        const result = detailData?.result

        if (result) {
          console.log(`[autoCreateCompany] Place details found:`, result.name, result.formatted_address)
          if (result.name) companyName = result.name
          if (result.formatted_phone_number) companyPhone = result.formatted_phone_number
          companyAddress = result.formatted_address ?? null
          googlePlaceId = placeId

          const components = result.address_components ?? []
          for (const comp of components) {
            const types: string[] = comp.types ?? []
            if (types.includes("locality")) companyCity = comp.long_name
            if (types.includes("country")) companyCountry = comp.long_name
          }
        }
      }
    } catch (e) {
      console.error("[autoCreateCompany] Google Places lookup failed:", e)
      // Non-fatal — continue with domain-based fallback
    }
  }

  // Create company
  const slug = domain.replace(/\./g, "-").toLowerCase()
  const { data: newCompany, error: insertError } = await supabase
    .from("companies")
    .insert({
      name: companyName,
      owner_id: user.id,
      domain: domain,
      website: `https://${domain}`,
      address: companyAddress,
      city: companyCity,
      country: companyCountry ?? "Netherlands",
      phone: companyPhone,
      google_place_id: googlePlaceId,
      is_verified: false,
      status: "unlisted" as const,
      slug,
    })
    .select("id")
    .single()

  if (insertError || !newCompany) {
    console.error("[autoCreateCompany] Company insert error:", insertError)
    return { success: false, error: "Could not create company." }
  }

  // Link user to company — update existing professional record or create new
  const { data: existingProfessional } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  let newPro: { id: string } | null = null
  let proError: any = null

  if (existingProfessional) {
    const { error } = await supabase
      .from("professionals")
      .update({ company_id: newCompany.id, title: companyName })
      .eq("id", existingProfessional.id)
    proError = error
    newPro = existingProfessional
  } else {
    const { data, error } = await supabase
      .from("professionals")
      .insert({
        title: companyName,
        user_id: user.id,
        company_id: newCompany.id,
      })
      .select("id")
      .single()
    proError = error
    newPro = data
  }

  if (proError || !newPro) {
    console.error("[autoCreateCompany] Professional error:", proError)
    return { success: false, error: `Could not create professional profile: ${proError?.message ?? "unknown error"}` }
  }

  // Promote user to professional type
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()

  const currentTypes = Array.isArray(profile?.user_types) ? profile.user_types : []
  if (!currentTypes.includes("professional")) {
    await supabase
      .from("profiles")
      .update({ user_types: [...currentTypes, "professional"] })
      .eq("id", user.id)
  }

  return { success: true, companyId: newCompany.id, professionalId: newPro.id }
}

// ---------------------------------------------------------------------------
// Lookup company from email domain via Google Places (no auth required)
// Used to pre-populate the "Claim [Company]" CTA on the invite landing page
// ---------------------------------------------------------------------------

const BLOCKED_EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "icloud.com", "live.com", "aol.com", "protonmail.com"]

export type PreloadedCompany = {
  name: string
  placeId: string
  formattedAddress: string | null
  city: string | null
  country: string | null
  stateRegion: string | null
  phone: string | null
  website: string | null
  domain: string | null
  editorialSummary: string | null
  googleTypes: string[] | null
  /** Set when a matching unowned Arco company already exists */
  arcoCompanyId?: string
}

export async function lookupCompanyByEmailDomain(
  email: string
): Promise<PreloadedCompany | null> {
  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain || BLOCKED_EMAIL_DOMAINS.includes(domain)) return null

  const supabase = await createServerSupabaseClient()

  // 1. Check if there's already an unowned Arco company matching this domain
  const { data: arcoMatch } = await supabase
    .from("companies")
    .select("id, name, city, country, address, domain, website, phone, google_place_id, owner_id")
    .or(`domain.ilike.%${domain}%,email.ilike.%@${domain}`)
    .limit(1)
    .maybeSingle()

  if (arcoMatch) {
    return {
      name: arcoMatch.name,
      placeId: arcoMatch.google_place_id ?? "",
      formattedAddress: arcoMatch.address ?? null,
      city: arcoMatch.city ?? null,
      country: arcoMatch.country ?? null,
      stateRegion: null,
      phone: arcoMatch.phone ?? null,
      website: arcoMatch.website ?? null,
      domain: arcoMatch.domain ?? domain,
      editorialSummary: null,
      googleTypes: null,
      arcoCompanyId: arcoMatch.owner_id ? undefined : arcoMatch.id,
    }
  }

  // 2. Look up via Google Places
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!mapsKey) return null

  const companyNameGuess = domain
    .replace(/\.(com|nl|co\.uk|org|net|io|eu|de|fr|be)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

  try {
    const searchQueries = [companyNameGuess, domain, `https://${domain}`]
    let placeId: string | null = null

    for (const query of searchQueries) {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=name,place_id&key=${mapsKey}`,
        { next: { revalidate: 86400 } } // cache 24h
      )
      const data = await res.json()
      if (data?.candidates?.[0]?.place_id) {
        placeId = data.candidates[0].place_id
        break
      }
    }

    if (!placeId) return null

    const detailRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,address_components,website,editorial_summary,types&key=${mapsKey}`,
      { next: { revalidate: 86400 } }
    )
    const detailData = await detailRes.json()
    const result = detailData?.result
    if (!result?.name) return null

    let city: string | null = null
    let country: string | null = null
    let stateRegion: string | null = null
    for (const comp of result.address_components ?? []) {
      const types: string[] = comp.types ?? []
      if (types.includes("locality")) city = comp.long_name
      if (types.includes("country")) country = comp.long_name
      if (types.includes("administrative_area_level_1")) stateRegion = comp.long_name
    }

    let placeDomain: string | null = null
    if (result.website) {
      try { placeDomain = new URL(result.website).hostname.replace(/^www\./, "") } catch {}
    }

    return {
      name: result.name,
      placeId,
      formattedAddress: result.formatted_address ?? null,
      city,
      country,
      stateRegion,
      phone: result.formatted_phone_number ?? null,
      website: result.website ?? null,
      domain: placeDomain ?? domain,
      editorialSummary: result.editorial_summary?.text ?? null,
      googleTypes: result.types ?? null,
    }
  } catch (e) {
    console.error("[lookupCompanyByEmailDomain] Google Places lookup failed:", e)
    return null
  }
}
