"use server"

import { revalidatePath } from "next/cache"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"

export type AdminAddCompanyResult = {
  success: boolean
  companyId?: string
  error?: string
}

export type GooglePlaceInput = {
  name: string
  placeId: string
  formattedAddress: string | null
  city: string | null
  country: string | null
  stateRegion: string | null
  phone: string | null
  website: string | null
  domain: string | null
}

export async function adminAddCompanyAction(input: GooglePlaceInput): Promise<AdminAddCompanyResult> {
  const supabase = await createServerActionSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isAdminUser(profile?.user_types, profile?.admin_role)) {
    return { success: false, error: "Unauthorized" }
  }

  const serviceSupabase = createServiceRoleSupabaseClient()

  // Check if company with same google_place_id already exists
  if (input.placeId) {
    const { data: existing } = await serviceSupabase
      .from("companies")
      .select("id, name")
      .eq("google_place_id", input.placeId)
      .maybeSingle()

    if (existing) {
      return { success: false, error: `Company "${existing.name}" already exists on Arco.` }
    }
  }

  // Check domain collision
  if (input.domain) {
    const { data: domainMatch } = await serviceSupabase
      .from("companies")
      .select("id, name")
      .ilike("domain", input.domain)
      .maybeSingle()

    if (domainMatch) {
      return { success: false, error: `A company with domain "${input.domain}" already exists (${domainMatch.name}).` }
    }
  }

  // Generate slug
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  // Geocode address for map placement
  let latitude: number | null = null
  let longitude: number | null = null
  if (input.formattedAddress) {
    try {
      const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (mapsKey) {
        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(input.formattedAddress)}&key=${mapsKey}`
        )
        const geoData = await geoRes.json()
        if (geoData?.results?.[0]?.geometry?.location) {
          latitude = geoData.results[0].geometry.location.lat
          longitude = geoData.results[0].geometry.location.lng
        }
      }
    } catch {}
  }

  // Derive contact email from domain (info@domain is the most common pattern)
  const contactEmail = input.domain ? `info@${input.domain}` : null

  // Insert company without owner (claimable)
  const { data: newCompany, error: insertError } = await serviceSupabase
    .from("companies")
    .insert({
      name: input.name,
      owner_id: null,
      website: input.website,
      domain: input.domain,
      email: contactEmail,
      phone: input.phone,
      address: input.formattedAddress,
      city: input.city,
      country: input.country || "Netherlands",
      state_region: input.stateRegion,
      google_place_id: input.placeId || null,
      latitude,
      longitude,
      is_verified: false,
      status: "unclaimed" as any,
      slug,
    })
    .select("id")
    .single()

  if (insertError || !newCompany) {
    logger.db("insert", "companies", "Admin failed to add company", { name: input.name }, insertError)
    return { success: false, error: insertError?.message || "Failed to create company." }
  }

  revalidatePath("/admin/professionals")
  return { success: true, companyId: newCompany.id }
}
