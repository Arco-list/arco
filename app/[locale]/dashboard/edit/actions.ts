"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { dispatchProfessionalInvite } from "@/lib/invites/dispatch-professional-invite"

type CreateUnlistedCompanyInput = {
  name: string
  email: string
  city?: string | null
  googlePlaceId?: string | null
  projectId: string
  inviterName: string
  projectTitle: string
  creatorUserId: string
  skipDedup?: boolean
  // Enriched fields from Google Place Details
  website?: string | null
  domain?: string | null
  phone?: string | null
  address?: string | null
  country?: string | null
  stateRegion?: string | null
}

type CreateUnlistedCompanyResult =
  | { success: true; companyId: string; emailSent: boolean }
  | { duplicate: true; existingCompanyId: string; existingCompanyName: string; existingCompanyLogo: string | null; existingCompanyProjectCount: number; matchType: "domain" | "name" }
  | { error: string }

export async function createUnlistedCompanyAction(
  input: CreateUnlistedCompanyInput
): Promise<CreateUnlistedCompanyResult> {
  try {
    const supabase = createServiceRoleSupabaseClient()

    const buildDupResult = async (companyId: string, companyName: string, matchType: "domain" | "name"): Promise<CreateUnlistedCompanyResult> => {
      const { data: company } = await supabase.from("companies").select("logo_url").eq("id", companyId).maybeSingle()
      const { count } = await supabase.from("project_professionals").select("id", { count: "exact", head: true }).eq("company_id", companyId)
      return { duplicate: true, existingCompanyId: companyId, existingCompanyName: companyName, existingCompanyLogo: company?.logo_url ?? null, existingCompanyProjectCount: count ?? 0, matchType }
    }

    // --- Dedup checks (skip if forced) ---
    if (!input.skipDedup) {
      // 0. Google Place ID match (most authoritative)
      if (input.googlePlaceId) {
        const { data: placeMatch } = await supabase
          .from("companies")
          .select("id, name")
          .eq("google_place_id", input.googlePlaceId)
          .limit(1)
        if (placeMatch && placeMatch.length > 0) {
          return buildDupResult(placeMatch[0].id, placeMatch[0].name, "domain")
        }
      }

      // 1. Email domain match (authoritative — domain = unique company identity)
      const emailDomain = input.email.split("@")[1]?.toLowerCase()
      if (emailDomain) {
        // Check the `domain` column
        const { data: domainMatch } = await supabase
          .from("companies")
          .select("id, name")
          .ilike("domain", `%${emailDomain}%`)
          .limit(1)
        if (domainMatch && domainMatch.length > 0) {
          return buildDupResult(domainMatch[0].id, domainMatch[0].name, "domain")
        }
        // Also check email column for unlisted companies that only have email set
        const { data: emailDomainMatch } = await supabase
          .from("companies")
          .select("id, name")
          .ilike("email", `%@${emailDomain}`)
          .limit(1)
        if (emailDomainMatch && emailDomainMatch.length > 0) {
          return buildDupResult(emailDomainMatch[0].id, emailDomainMatch[0].name, "domain")
        }
      }

      // 2. Name + city fuzzy match
      if (input.name.trim().length >= 2) {
        let query = supabase
          .from("companies")
          .select("id, name")
          .ilike("name", input.name.trim())
        if (input.city) {
          query = query.ilike("city", input.city.trim())
        }
        const { data: nameMatches } = await query.limit(1)
        if (nameMatches && nameMatches.length > 0) {
          return buildDupResult(nameMatches[0].id, nameMatches[0].name, "name")
        }
      }
    }

    // --- Create unlisted company ---
    const insertData: Record<string, unknown> = {
      name: input.name.trim(),
      email: input.email.trim(),
      city: input.city?.trim() || null,
      status: "unlisted",
      owner_id: null,  // No owner — company is claimable via domain verification
      google_place_id: input.googlePlaceId || null,
      website: input.website || null,
      domain: input.domain || null,
      phone: input.phone || null,
      address: input.address || null,
      country: input.country || null,
      state_region: input.stateRegion || null,
    }
    const { data: company, error: insertError } = await supabase
      .from("companies")
      .insert(insertData as any)
      .select("id")
      .single()

    if (insertError || !company) {
      console.error("Failed to create unlisted company:", JSON.stringify(insertError, null, 2))
      console.error("Insert data was:", JSON.stringify(insertData, null, 2))
      return { error: insertError?.message || "Failed to create company" }
    }

    // --- Send invite email via the shared dispatcher ---
    // Newly-created unlisted companies are by definition unclaimed, so the
    // dispatcher will fire the three-step new-professional-invite sequence
    // (intro now via Resend, followup + final via the drip queue).
    let emailSent = false
    try {
      const result = await dispatchProfessionalInvite(supabase, {
        recipientEmail: input.email,
        projectId: input.projectId,
        inviterName: input.inviterName,
        recipientCompanyId: company.id,
      })
      emailSent = result.success
    } catch (e) {
      console.error("Failed to dispatch invite email:", e)
    }

    return { success: true, companyId: company.id, emailSent }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("createUnlistedCompanyAction error:", msg, error)
    return { error: msg || "An unexpected error occurred" }
  }
}

type LinkExistingCompanyInput = {
  companyId: string
  inviteId: string
  projectId: string
  email?: string | null
  inviterName: string
  projectTitle: string
}

export async function confirmLinkExistingCompanyAction(
  input: LinkExistingCompanyInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceRoleSupabaseClient()

    const updateData: Record<string, unknown> = { company_id: input.companyId }
    if (input.email) {
      updateData.invited_email = input.email
    }

    const { error } = await supabase
      .from("project_professionals")
      .update(updateData)
      .eq("id", input.inviteId)

    if (error) {
      return { success: false, error: error.message }
    }

    // Dispatch the invite. The dispatcher branches on whether the linked
    // company is claimed (one-shot professional-invite) or unclaimed
    // (three-step new-professional-invite sequence + prospects row).
    if (input.email) {
      try {
        await dispatchProfessionalInvite(supabase, {
          recipientEmail: input.email,
          projectId: input.projectId,
          inviterName: input.inviterName,
          recipientCompanyId: input.companyId,
        })
      } catch (e) {
        console.error("Failed to dispatch invite email:", e)
      }
    }

    return { success: true }
  } catch (error) {
    console.error("confirmLinkExistingCompanyAction error:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Resolve the owner email for a claimed company
export async function getCompanyOwnerEmailAction(companyId: string): Promise<{ email: string | null }> {
  try {
    const supabase = createServiceRoleSupabaseClient()
    const { data: company } = await supabase
      .from("companies")
      .select("owner_id, email")
      .eq("id", companyId)
      .maybeSingle()
    if (!company) return { email: null }
    // Use company email first
    if (company.email) return { email: company.email }
    // Look up owner's auth email
    if (company.owner_id) {
      const { data: userData } = await supabase.auth.admin.getUserById(company.owner_id)
      if (userData?.user?.email) return { email: userData.user.email }
    }
    return { email: null }
  } catch {
    return { email: null }
  }
}

// Standalone action to send a professional invite email (for paths that insert directly)
export async function sendInviteEmailAction(input: {
  email: string
  projectId: string
  inviterName: string
  projectTitle: string
}): Promise<{ success: boolean }> {
  try {
    const supabase = createServiceRoleSupabaseClient()
    const result = await dispatchProfessionalInvite(supabase, {
      recipientEmail: input.email,
      projectId: input.projectId,
      inviterName: input.inviterName,
    })
    return { success: result.success }
  } catch (e) {
    console.error("sendInviteEmailAction error:", e)
    return { success: false }
  }
}
