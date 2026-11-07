"use server"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"

/**
 * Merken en series op een project — de koppeling uit migraties 288/289.
 *
 * Alleen admins, zolang de merkenlaag in fase 1 zit. De acties zijn zo
 * geschreven dat de eigenaar er later bij kan zonder dat de vorm
 * verandert: de guard wordt dan "admin óf eigenaar van dit project" en
 * de source wordt 'pro_suggest' in plaats van 'admin_manual'.
 */

export type BrandOption = { id: string; name: string; slug: string; logoUrl: string | null; status: string }
export type FamilyOption = { id: string; brandId: string; name: string; slug: string }
export type SpaceOption = { id: string; slug: string }
export type ProjectBrandRow = {
  id: string
  brandId: string
  brandName: string
  brandSlug: string
  familyId: string | null
  familyName: string | null
  familySlug: string | null
  spaceId: string | null
  spaceSlug: string | null
  note: string | null
  photoId: string | null
  source: string
  status: string
}

const LINK_SELECT =
  "id, brand_id, family_id, space_id, note, photo_id, source, status, brands(name, slug), product_families(name, slug), spaces(slug)"

type Guard = { ok: true; userId: string } | { error: string }

async function requireAdmin(): Promise<Guard> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Je moet ingelogd zijn." }
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()
  if (!isAdminUser(profile?.user_types, profile?.admin_role)) return { error: "Alleen voor admins." }
  return { ok: true, userId: user.id }
}

// De merkentabellen zijn nog niet overal in de gegenereerde types
// meegenomen; de bestaande admin-acties casten om dezelfde reden.
type AnyClient = any

const mapLink = (r: any): ProjectBrandRow => ({
  id: r.id,
  brandId: r.brand_id,
  brandName: r.brands?.name ?? "",
  brandSlug: r.brands?.slug ?? "",
  familyId: r.family_id ?? null,
  familyName: r.product_families?.name ?? null,
  familySlug: r.product_families?.slug ?? null,
  spaceId: r.space_id ?? null,
  spaceSlug: r.spaces?.slug ?? null,
  note: r.note ?? null,
  photoId: r.photo_id ?? null,
  source: r.source,
  status: r.status,
})

/** Alles wat de editor nodig heeft in één rondje: merken en hun series
 *  om uit te kiezen, ruimtes als hint, en de koppelingen die er al staan. */
export async function loadProjectBrandsEditorAction(
  projectId: string,
): Promise<{ brands: BrandOption[]; families: FamilyOption[]; spaces: SpaceOption[]; links: ProjectBrandRow[] } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const supabase: AnyClient = createServiceRoleSupabaseClient()
  const [brandsRes, familiesRes, spacesRes, linksRes] = await Promise.all([
    supabase.from("brands").select("id, name, slug, logo_url, status").neq("status", "deactivated").order("name"),
    supabase.from("product_families").select("id, brand_id, name, slug").order("name"),
    supabase.from("spaces").select("id, slug").order("name"),
    supabase.from("project_brands").select(LINK_SELECT).eq("project_id", projectId).order("created_at", { ascending: true }),
  ])
  const err = brandsRes.error ?? familiesRes.error ?? spacesRes.error ?? linksRes.error
  if (err) return { error: err.message }
  return {
    brands: (brandsRes.data ?? []).map((b: any) => ({ id: b.id, name: b.name, slug: b.slug, logoUrl: b.logo_url ?? null, status: b.status })),
    families: (familiesRes.data ?? []).map((f: any) => ({ id: f.id, brandId: f.brand_id, name: f.name, slug: f.slug })),
    spaces: (spacesRes.data ?? []).map((s: any) => ({ id: s.id, slug: s.slug })),
    links: (linksRes.data ?? []).map(mapLink),
  }
}

/**
 * Merk (+ serie) op een project zetten.
 *
 * Staat het merk er al zónder serie en komt er nu een serie bij, dan
 * wordt die rij verfijnd in plaats van dat er een tweede naast komt:
 * "Occhio" wordt "Occhio › Mito". Dat is de gang van zaken die we
 * verwachten — eerst weet je het merk, dan de serie.
 */
export async function addProjectBrandAction(
  projectId: string,
  brandId: string,
  familyId: string | null,
  spaceId: string | null,
  note: string | null,
): Promise<{ link: ProjectBrandRow } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const supabase: AnyClient = createServiceRoleSupabaseClient()
  const cleanNote = note?.trim() || null

  if (familyId) {
    const { data: bare } = await supabase
      .from("project_brands")
      .select("id, space_id, note")
      .eq("project_id", projectId)
      .eq("brand_id", brandId)
      .is("family_id", null)
      .is("photo_id", null)
      .maybeSingle()
    if (bare) {
      const { data, error } = await supabase
        .from("project_brands")
        .update({
          family_id: familyId,
          space_id: spaceId ?? bare.space_id ?? null,
          note: cleanNote ?? bare.note ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bare.id)
        .select(LINK_SELECT)
        .single()
      if (error) return { error: error.message }
      return { link: mapLink(data) }
    }
  }

  const { data, error } = await supabase
    .from("project_brands")
    .insert({
      project_id: projectId,
      brand_id: brandId,
      family_id: familyId,
      space_id: spaceId,
      note: cleanNote,
      source: "admin_manual",
      status: "live",
      suggested_by_user_id: guard.userId,
    })
    .select(LINK_SELECT)
    .single()
  if (error) {
    // 23505 = de unique index: dit merk (met deze serie) staat al op dit project.
    if (error.code === "23505") return { error: "Dit merk staat met deze serie al op dit project." }
    return { error: error.message }
  }
  return { link: mapLink(data) }
}

export async function updateProjectBrandAction(
  linkId: string,
  fields: { familyId?: string | null; spaceId?: string | null; note?: string | null },
): Promise<{ link: ProjectBrandRow } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ("familyId" in fields) patch.family_id = fields.familyId
  if ("spaceId" in fields) patch.space_id = fields.spaceId
  if ("note" in fields) patch.note = fields.note?.trim() || null
  const supabase: AnyClient = createServiceRoleSupabaseClient()
  const { data, error } = await supabase
    .from("project_brands")
    .update(patch)
    .eq("id", linkId)
    .select(LINK_SELECT)
    .single()
  if (error) {
    if (error.code === "23505") return { error: "Dit merk staat met deze serie al op dit project." }
    return { error: error.message }
  }
  return { link: mapLink(data) }
}

export async function removeProjectBrandAction(linkId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const supabase: AnyClient = createServiceRoleSupabaseClient()
  const { error } = await supabase.from("project_brands").delete().eq("id", linkId)
  if (error) return { error: error.message }
  return { ok: true }
}
