"use server"

import { revalidatePath } from "next/cache"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"

/**
 * Photographer credit on a project.
 *
 * Project owners (and admins) can credit a photographer via Google Places
 * lookup on the project edit page. Different from the standard professional
 * invite flow because:
 *   • No email — photographers are credited from public listings, not invited
 *     to log in. Their `invited_email` defaults to '' (no drip enqueue).
 *   • Single category locked to "photographer" (audience=pro). Company
 *     `audience` is set automatically by the categories.audience trigger.
 *   • status is set to live_on_page so the photographer surfaces in the
 *     specs bar immediately. Their company stays `unclaimed` until the
 *     photographer claims it via /businesses/professionals.
 *
 * Idempotent on (google_place_id, domain) — running the action twice for
 * the same place returns the existing company row.
 */

export type PhotographerLookupInput = {
  /** Display name pulled from Google Places. Used for company.name. */
  name: string
  /** Google Places id for de-duplication and slug stability. */
  placeId: string | null
  /** Full formatted address from Google. Drives geocoding for the map. */
  formattedAddress: string | null
  city: string | null
  country: string | null
  stateRegion: string | null
  phone: string | null
  website: string | null
  /** Hostname only (no protocol, no www). Used for de-duplication. */
  domain: string | null
}

export type AddPhotographerResult = {
  success: boolean
  companyId?: string
  error?: string
}

export async function addPhotographerToProject(
  projectId: string,
  input: PhotographerLookupInput,
): Promise<AddPhotographerResult> {
  if (!projectId) return { success: false, error: "Missing project id" }
  if (!input?.name?.trim()) return { success: false, error: "Photographer name is required" }

  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  // Authorisation: must be the project's client_id, or an admin.
  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("id, client_id").eq("id", projectId).maybeSingle(),
    supabase.from("profiles").select("user_types, admin_role").eq("id", user.id).maybeSingle(),
  ])
  if (!project) return { success: false, error: "Project not found" }
  const isAdmin = isAdminUser(profile?.user_types, profile?.admin_role)
  if (project.client_id !== user.id && !isAdmin) {
    return { success: false, error: "Not authorised to edit this project" }
  }

  const serviceSupabase = createServiceRoleSupabaseClient()

  // Resolve photographer category id — slug='photographer' set in migration 145.
  const { data: photographerCat } = await serviceSupabase
    .from("categories")
    .select("id")
    .eq("slug", "photographer")
    .maybeSingle()

  if (!photographerCat?.id) {
    return { success: false, error: "Photographer category missing — run migration 145." }
  }
  const photographerCategoryId = photographerCat.id as string

  // De-dupe: google_place_id first (strongest signal), then domain.
  let companyId: string | null = null

  if (input.placeId) {
    const { data: byPlace } = await serviceSupabase
      .from("companies")
      .select("id")
      .eq("google_place_id", input.placeId)
      .maybeSingle()
    if (byPlace?.id) companyId = byPlace.id as string
  }

  if (!companyId && input.domain) {
    const { data: byDomain } = await serviceSupabase
      .from("companies")
      .select("id")
      .ilike("domain", input.domain)
      .maybeSingle()
    if (byDomain?.id) companyId = byDomain.id as string
  }

  // Create company if no match.
  if (!companyId) {
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      || `photographer-${Date.now()}`

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
      } catch { /* geocode failures are non-fatal */ }
    }

    const contactEmail = input.domain ? `info@${input.domain}` : null

    // audience defaults to 'homeowner' but the BEFORE INSERT trigger
    // (trg_companies_sync_audience, migration 147) flips it to 'pro' once
    // it sees primary_service_id pointing at the photographer category.
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
        primary_service_id: photographerCategoryId,
        services_offered: [photographerCategoryId],
      })
      .select("id")
      .single()

    if (insertError || !newCompany) {
      logger.db("insert", "companies", "Failed to create photographer company", { name: input.name }, insertError)
      return { success: false, error: insertError?.message || "Failed to create photographer." }
    }
    companyId = newCompany.id as string
  }

  // Replace any existing photographer credit on this project. The
  // project_professionals_unique_per_project constraint is UNIQUE (project_id,
  // invited_email), and we set invited_email='' for every photographer — so
  // adding a second one without first removing the old would collide. We
  // resolve that by treating "add a photographer" as a single-slot replace:
  // delete any prior pro-audience credit on this project (whatever company
  // it pointed to), then insert the new one. Same-company re-add is a no-op
  // (delete + reinsert with the same fields).
  //
  // Filtered by company.audience='pro' so we never accidentally delete a
  // homeowner-facing professional credit (architect, builder, etc.).
  const { data: existingPhotographers } = await serviceSupabase
    .from("project_professionals")
    .select("id, company_id, companies!inner(audience)")
    .eq("project_id", projectId)
    .eq("companies.audience", "pro")

  const idsToRemove = (existingPhotographers ?? [])
    .filter((row: any) => row.company_id !== companyId) // keep the row if it's already pointing at the same photographer
    .map((row: any) => row.id as string)

  if (idsToRemove.length > 0) {
    const { error: deleteError } = await serviceSupabase
      .from("project_professionals")
      .delete()
      .in("id", idsToRemove)
    if (deleteError) {
      logger.db("delete", "project_professionals", "Failed to clear prior photographer credit", { projectId }, deleteError)
      return { success: false, error: deleteError.message }
    }
  }

  // Insert the new credit only if the same-company row didn't already exist.
  const sameCompanyRowExists = (existingPhotographers ?? [])
    .some((row: any) => row.company_id === companyId)

  if (!sameCompanyRowExists) {
    const { error: linkError } = await serviceSupabase
      .from("project_professionals")
      .insert({
        project_id: projectId,
        company_id: companyId,
        professional_id: null,
        invited_email: "",
        invited_service_category_ids: [photographerCategoryId],
        status: "live_on_page" as any,
        is_project_owner: false,
      })
    if (linkError) {
      logger.db("insert", "project_professionals", "Failed to credit photographer", { projectId, companyId }, linkError)
      return { success: false, error: linkError.message }
    }
  }

  revalidatePath(`/dashboard/edit/${projectId}`)
  // Project slug cache will refresh next request — don't strictly need to
  // revalidate /projects/[slug] here since the photographer query runs on
  // each request anyway.
  return { success: true, companyId }
}

/**
 * Remove the photographer credit from a project. Does not delete the
 * underlying company (other projects may credit it).
 */
export async function removePhotographerFromProject(
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!projectId) return { success: false, error: "Missing project id" }

  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("id, client_id").eq("id", projectId).maybeSingle(),
    supabase.from("profiles").select("user_types, admin_role").eq("id", user.id).maybeSingle(),
  ])
  if (!project) return { success: false, error: "Project not found" }
  const isAdmin = isAdminUser(profile?.user_types, profile?.admin_role)
  if (project.client_id !== user.id && !isAdmin) {
    return { success: false, error: "Not authorised to edit this project" }
  }

  const serviceSupabase = createServiceRoleSupabaseClient()

  // Find the photographer credit on this project (audience=pro company).
  const { data: credit } = await serviceSupabase
    .from("project_professionals")
    .select("id, companies!inner(audience)")
    .eq("project_id", projectId)
    .eq("companies.audience", "pro")
    .maybeSingle()

  if (!credit) return { success: true } // already gone

  const { error: deleteError } = await serviceSupabase
    .from("project_professionals")
    .delete()
    .eq("id", (credit as any).id)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  revalidatePath(`/dashboard/edit/${projectId}`)
  return { success: true }
}
