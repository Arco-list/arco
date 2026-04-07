"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { sendProfessionalInviteEmail, checkUserAndGenerateInviteUrl } from "@/lib/email-service"

async function isProjectPublished(supabase: ReturnType<typeof createServiceRoleSupabaseClient>, projectId: string): Promise<boolean> {
  const { data } = await supabase.from("projects").select("status").eq("id", projectId).maybeSingle()
  return data?.status === "published" || data?.status === "completed"
}

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

    // --- Send invite email (only if project is published) ---
    let emailSent = false
    const projectIsLive = await isProjectPublished(supabase, input.projectId)
    if (!projectIsLive) {
      return { success: true, companyId: company.id, emailSent: false }
    }
    try {
      const { confirmUrl } = await checkUserAndGenerateInviteUrl(input.email, input.projectId)
      // Fetch project primary photo for email card
      const { data: projectPhoto } = await supabase
        .from("project_photos")
        .select("url")
        .eq("project_id", input.projectId)
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle()
      // Fetch project details
      const { data: projectData } = await supabase
        .from("projects")
        .select("location, address_city, building_type, project_type, project_type_category_id")
        .eq("id", input.projectId)
        .maybeSingle()
      // Inviter (project owner) company — used to render the inviting-company
      // badge in the email so the recipient instantly recognises the studio.
      const { data: ownerPP } = await supabase
        .from("project_professionals")
        .select("company_id")
        .eq("project_id", input.projectId)
        .eq("is_project_owner", true)
        .maybeSingle()
      const { data: ownerCompany } = ownerPP?.company_id
        ? await supabase.from("companies").select("name, logo_url").eq("id", ownerPP.company_id).maybeSingle()
        : { data: null }
      // Resolve building type label
      let projectType: string | undefined
      const bt = projectData?.building_type
      const isUuid = bt && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bt)
      if (bt && !isUuid) {
        projectType = bt.charAt(0).toUpperCase() + bt.slice(1).replace(/-/g, " ")
      }
      // Look up category name: try building_type UUID, then project_type_category_id
      if (!projectType) {
        const idsToTry = [isUuid ? bt : null, projectData?.project_type_category_id].filter(Boolean) as string[]
        for (const catId of idsToTry) {
          const { data: cat } = await supabase.from("categories").select("name").eq("id", catId).maybeSingle()
          if (cat?.name) { projectType = cat.name; break }
        }
      }
      // Final fallback: project_type field (e.g. "New Build")
      if (!projectType && (projectData as any)?.project_type) {
        projectType = (projectData as any).project_type
      }
      const result = await sendProfessionalInviteEmail(input.email, {
        project_owner: input.inviterName,
        company_name: ownerCompany?.name ?? undefined,
        company_logo_url: ownerCompany?.logo_url ?? undefined,
        project_name: input.projectTitle,
        project_title: input.projectTitle,
        project_image: projectPhoto?.url ?? undefined,
        project_location: projectData?.address_city ?? projectData?.location ?? undefined,
        project_type: projectType,
        confirmUrl,
      })
      emailSent = result.success
    } catch (e) {
      console.error("Failed to send invite email:", e)
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

    // Send invite email if email provided and project is published
    const projectIsLive = await isProjectPublished(supabase, input.projectId)
    if (input.email && projectIsLive) {
      try {
        const { confirmUrl } = await checkUserAndGenerateInviteUrl(input.email, input.projectId)
        const { data: projectPhoto } = await supabase
          .from("project_photos")
          .select("url")
          .eq("project_id", input.projectId)
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle()
        const { data: projectData } = await supabase
          .from("projects")
          .select("location, address_city, building_type, project_type, project_type_category_id")
          .eq("id", input.projectId)
          .maybeSingle()
        let projectType = projectData?.building_type ? projectData.building_type.charAt(0).toUpperCase() + projectData.building_type.slice(1) : undefined
        if (!projectType && projectData?.project_type_category_id) {
          const { data: cat } = await supabase.from("categories").select("name").eq("id", projectData.project_type_category_id).maybeSingle()
          projectType = cat?.name ?? undefined
        }
        // Inviter (project owner) company for the badge in the email.
        const { data: ownerPP } = await supabase
          .from("project_professionals")
          .select("company_id")
          .eq("project_id", input.projectId)
          .eq("is_project_owner", true)
          .maybeSingle()
        const { data: ownerCompany } = ownerPP?.company_id
          ? await supabase.from("companies").select("name, logo_url").eq("id", ownerPP.company_id).maybeSingle()
          : { data: null }
        await sendProfessionalInviteEmail(input.email, {
          project_owner: input.inviterName,
          company_name: ownerCompany?.name ?? undefined,
          company_logo_url: ownerCompany?.logo_url ?? undefined,
          project_name: input.projectTitle,
          project_title: input.projectTitle,
          project_image: projectPhoto?.url ?? undefined,
          project_location: projectData?.address_city ?? projectData?.location ?? undefined,
          project_type: projectType,
          confirmUrl,
        })
      } catch (e) {
        console.error("Failed to send invite email:", e)
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
    // Only send if project is published
    const projectIsLive = await isProjectPublished(supabase, input.projectId)
    if (!projectIsLive) return { success: false }
    const { confirmUrl } = await checkUserAndGenerateInviteUrl(input.email, input.projectId)
    const { data: projectPhoto } = await supabase
      .from("project_photos")
      .select("url")
      .eq("project_id", input.projectId)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle()
    const { data: projectData } = await supabase
      .from("projects")
      .select("location, address_city, building_type, project_type, project_type_category_id")
      .eq("id", input.projectId)
      .maybeSingle()
    let projectType = projectData?.building_type ? projectData.building_type.charAt(0).toUpperCase() + projectData.building_type.slice(1) : undefined
    if (!projectType && projectData?.project_type_category_id) {
      const { data: cat } = await supabase.from("categories").select("name").eq("id", projectData.project_type_category_id).maybeSingle()
      projectType = cat?.name ?? undefined
    }
    const { data: projectSlug } = await supabase
      .from("projects")
      .select("slug")
      .eq("id", input.projectId)
      .maybeSingle()
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://arcolist.com"
    // Get the owner's company name
    const { data: ownerPP } = await supabase
      .from("project_professionals")
      .select("company_id")
      .eq("project_id", input.projectId)
      .eq("is_project_owner", true)
      .maybeSingle()
    const { data: ownerCompany } = ownerPP?.company_id
      ? await supabase.from("companies").select("name, logo_url").eq("id", ownerPP.company_id).maybeSingle()
      : { data: null }

    const result = await sendProfessionalInviteEmail(input.email, {
      project_owner: input.inviterName,
      company_name: ownerCompany?.name ?? undefined,
      company_logo_url: ownerCompany?.logo_url ?? undefined,
      project_name: input.projectTitle,
      project_title: input.projectTitle,
      project_image: projectPhoto?.url ?? undefined,
      project_location: projectData?.address_city ?? projectData?.location ?? undefined,
      project_type: projectType,
      project_link: `${baseUrl}/projects/${projectSlug?.slug ?? input.projectId}`,
      confirmUrl,
    })
    return { success: result.success }
  } catch (e) {
    console.error("sendInviteEmailAction error:", e)
    return { success: false }
  }
}
