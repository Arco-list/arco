import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { composeBrandedImage } from "@/lib/pinterest/composeBrandedImage"
import {
  composeTypePinCopy,
  composeSpacePinCopy,
  type PinCopyInput,
} from "@/lib/pinterest/compose"
import {
  pinTypeObjectKey,
  pinSpaceObjectKey,
  socialObjectKey,
  uploadBrandedImage,
  deleteBrandedImage,
} from "@/lib/pinterest/storage"
import {
  createPin,
  deletePin,
  patchPin,
} from "@/lib/pinterest/client"

/**
 * Per-target orchestration for the Pinterest cron worker.
 *
 * Every function here handles ONE row from pinterest_queue. Errors bubble
 * up to the worker, which decides transient (retry) vs. permanent
 * (cancel) based on the HTTP status attached to the Error object.
 */

// ── Types the worker calls with ──────────────────────────────────────────
export type Target =
  | { type: "project"; id: string }
  | { type: "feature"; id: string }

// ── Shared resolvers ─────────────────────────────────────────────────────

interface ProjectContext {
  id: string
  title: string
  slug: string
  description: string | null
  buildingType: string | null
  addressCity: string | null
  style: string | null
  coverPhotoUrl: string | null
  ownerCompany: { name: string | null; slug: string | null } | null
  categoryId: string | null
}

async function loadProjectContext(projectId: string): Promise<ProjectContext | null> {
  const supabase = createServiceRoleSupabaseClient()
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, slug, description, building_type, address_city, style_preferences, project_type_category_id")
    .eq("id", projectId)
    .maybeSingle()
  if (!project) return null

  // Cover photo — is_primary flag, or lowest order_index as fallback.
  const { data: primaryPhoto } = await supabase
    .from("project_photos")
    .select("url")
    .eq("project_id", projectId)
    .eq("is_primary", true)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle()
  let coverPhotoUrl: string | null = primaryPhoto?.url ?? null
  if (!coverPhotoUrl) {
    const { data: firstPhoto } = await supabase
      .from("project_photos")
      .select("url")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle()
    coverPhotoUrl = firstPhoto?.url ?? null
  }

  // Owning company — the is_project_owner=true entry in project_professionals.
  let ownerCompany: ProjectContext["ownerCompany"] = null
  const { data: ownerLink } = await supabase
    .from("project_professionals")
    .select("company_id")
    .eq("project_id", projectId)
    .eq("is_project_owner", true)
    .limit(1)
    .maybeSingle()
  if (ownerLink?.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name, slug")
      .eq("id", ownerLink.company_id)
      .maybeSingle()
    if (company) ownerCompany = { name: company.name, slug: company.slug }
  }

  // Style — style_preferences is a text[] on projects; pick the first tag
  // so it slots into "· {style} {building_type}" without turning the title
  // into a bullet list. If empty, the title/hashtag builders drop the field.
  const stylePref = (project as { style_preferences?: string[] | null }).style_preferences
  const style = Array.isArray(stylePref) && stylePref.length > 0 ? stylePref[0] : null

  return {
    id: project.id,
    title: project.title ?? "",
    slug: project.slug ?? "",
    description: project.description ?? null,
    buildingType: project.building_type ?? null,
    addressCity: project.address_city ?? null,
    style,
    coverPhotoUrl,
    ownerCompany,
    categoryId: project.project_type_category_id ?? null,
  }
}

interface FeatureContext {
  id: string
  projectId: string
  spaceId: string | null
  spaceName: string | null
  spaceSlug: string | null
  coverPhotoUrl: string | null
}

async function loadFeatureContext(featureId: string): Promise<FeatureContext | null> {
  const supabase = createServiceRoleSupabaseClient()
  const { data: feature } = await supabase
    .from("project_features")
    .select("id, project_id, space_id, cover_photo_id")
    .eq("id", featureId)
    .maybeSingle()
  if (!feature) return null

  let spaceName: string | null = null
  let spaceSlug: string | null = null
  if (feature.space_id) {
    const { data: space } = await supabase
      .from("spaces")
      .select("name, slug")
      .eq("id", feature.space_id)
      .maybeSingle()
    spaceName = space?.name ?? null
    spaceSlug = space?.slug ?? null
  }

  let coverPhotoUrl: string | null = null
  if (feature.cover_photo_id) {
    const { data: photo } = await supabase
      .from("project_photos")
      .select("url")
      .eq("id", feature.cover_photo_id)
      .maybeSingle()
    coverPhotoUrl = photo?.url ?? null
  }

  return {
    id: feature.id,
    projectId: feature.project_id,
    spaceId: feature.space_id,
    spaceName,
    spaceSlug,
    coverPhotoUrl,
  }
}

async function resolveBoardId(where: { spaceId?: string; categoryId?: string }): Promise<string | null> {
  const supabase = createServiceRoleSupabaseClient()
  let query = supabase
    .from("pinterest_boards")
    .select("board_id")
    .eq("is_active", true)
    .not("board_id", "is", null)
    .limit(1)
  if (where.spaceId) query = query.eq("space_id", where.spaceId)
  if (where.categoryId) query = query.eq("category_id", where.categoryId)
  const { data } = await query.maybeSingle()
  return data?.board_id ?? null
}

// ── Publish flows ────────────────────────────────────────────────────────

export async function publishProjectPin(projectId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient()
  const ctx = await loadProjectContext(projectId)
  if (!ctx) throw permanentError(`project ${projectId} not found`)
  if (!ctx.coverPhotoUrl) throw permanentError(`project ${projectId} has no cover photo`)
  if (!ctx.categoryId) throw permanentError(`project ${projectId} has no project_type_category — no board mapping`)

  const boardId = await resolveBoardId({ categoryId: ctx.categoryId })
  if (!boardId) throw permanentError(`no active Pinterest board mapped to category ${ctx.categoryId}`)

  // Composite + upload the pin image AND the social share image in
  // parallel — both come from the same source photo.
  const [pinComposite, socialComposite] = await Promise.all([
    composeBrandedImage({ sourceUrl: ctx.coverPhotoUrl, target: "pin" }),
    composeBrandedImage({ sourceUrl: ctx.coverPhotoUrl, target: "social" }),
  ])
  const [pinUrl, _socialUrl] = await Promise.all([
    uploadBrandedImage(pinTypeObjectKey(ctx.id), pinComposite.buffer),
    uploadBrandedImage(socialObjectKey(ctx.id), socialComposite.buffer),
  ])
  void _socialUrl  // reserved for future og:image consumer

  const copyInput: PinCopyInput = {
    projectTitle: ctx.title,
    projectSlug: ctx.slug,
    projectDescription: ctx.description,
    companyName: ctx.ownerCompany?.name ?? null,
    companySlug: ctx.ownerCompany?.slug ?? null,
    city: ctx.addressCity,
    style: ctx.style,
    buildingType: ctx.buildingType,
    scope: null,
  }
  const copy = composeTypePinCopy(copyInput)
  const description = copy.hashtags.length > 0
    ? `${copy.description}\n\n${copy.hashtags.join(" ")}`
    : copy.description

  const pin = await createPin({
    boardId,
    title: copy.title,
    description,
    link: copy.link,
    imageUrl: pinUrl,
  })

  await supabase
    .from("projects")
    .update({
      pinterest_pin_id: pin.pinId,
      pinterest_synced_at: new Date().toISOString(),
      pinterest_sync_error: null,
    })
    .eq("id", ctx.id)
}

export async function publishFeaturePin(featureId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient()
  const feature = await loadFeatureContext(featureId)
  if (!feature) throw permanentError(`feature ${featureId} not found`)
  if (!feature.coverPhotoUrl) throw permanentError(`feature ${featureId} has no cover photo`)
  if (!feature.spaceId) throw permanentError(`feature ${featureId} has no space assignment`)
  if (feature.spaceSlug === "exterior") throw permanentError(`feature ${featureId} is on the exterior space — no board`)

  const boardId = await resolveBoardId({ spaceId: feature.spaceId })
  if (!boardId) throw permanentError(`no active Pinterest board mapped to space ${feature.spaceSlug ?? feature.spaceId}`)

  const project = await loadProjectContext(feature.projectId)
  if (!project) throw permanentError(`parent project ${feature.projectId} not found`)

  const composite = await composeBrandedImage({ sourceUrl: feature.coverPhotoUrl, target: "pin" })
  const pinUrl = await uploadBrandedImage(pinSpaceObjectKey(feature.id), composite.buffer)

  const copyInput: PinCopyInput = {
    projectTitle: project.title,
    projectSlug: project.slug,
    projectDescription: project.description,
    companyName: project.ownerCompany?.name ?? null,
    companySlug: project.ownerCompany?.slug ?? null,
    city: project.addressCity,
    style: project.style,
    buildingType: project.buildingType,
    scope: null,
    spaceName: feature.spaceName,
    spaceSlug: feature.spaceSlug,
  }
  const copy = composeSpacePinCopy(copyInput)
  const description = copy.hashtags.length > 0
    ? `${copy.description}\n\n${copy.hashtags.join(" ")}`
    : copy.description

  const pin = await createPin({
    boardId,
    title: copy.title,
    description,
    link: copy.link,
    imageUrl: pinUrl,
  })

  await supabase
    .from("project_features")
    .update({
      pinterest_pin_id: pin.pinId,
      pinterest_synced_at: new Date().toISOString(),
      pinterest_sync_error: null,
    })
    .eq("id", feature.id)
}

// ── Delete flows ─────────────────────────────────────────────────────────

export async function deleteProjectPin(projectId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient()
  const { data: proj } = await supabase
    .from("projects")
    .select("pinterest_pin_id")
    .eq("id", projectId)
    .maybeSingle()
  if (!proj?.pinterest_pin_id) return // nothing to delete
  await deletePin(proj.pinterest_pin_id)
  await Promise.all([
    deleteBrandedImage(pinTypeObjectKey(projectId)),
    deleteBrandedImage(socialObjectKey(projectId)),
  ])
  await supabase
    .from("projects")
    .update({
      pinterest_pin_id: null,
      pinterest_synced_at: new Date().toISOString(),
      pinterest_sync_error: null,
    })
    .eq("id", projectId)
}

export async function deleteFeaturePin(featureId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient()
  const { data: feat } = await supabase
    .from("project_features")
    .select("pinterest_pin_id")
    .eq("id", featureId)
    .maybeSingle()
  if (!feat?.pinterest_pin_id) return
  await deletePin(feat.pinterest_pin_id)
  await deleteBrandedImage(pinSpaceObjectKey(featureId))
  await supabase
    .from("project_features")
    .update({
      pinterest_pin_id: null,
      pinterest_synced_at: new Date().toISOString(),
      pinterest_sync_error: null,
    })
    .eq("id", featureId)
}

// ── Patch flows ──────────────────────────────────────────────────────────

export async function patchProjectPin(projectId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient()
  const { data: proj } = await supabase
    .from("projects")
    .select("pinterest_pin_id")
    .eq("id", projectId)
    .maybeSingle()
  if (!proj?.pinterest_pin_id) return

  const ctx = await loadProjectContext(projectId)
  if (!ctx) return
  const copy = composeTypePinCopy({
    projectTitle: ctx.title,
    projectSlug: ctx.slug,
    projectDescription: ctx.description,
    companyName: ctx.ownerCompany?.name ?? null,
    companySlug: ctx.ownerCompany?.slug ?? null,
    city: ctx.addressCity,
    style: ctx.style,
    buildingType: ctx.buildingType,
    scope: null,
  })
  const description = copy.hashtags.length > 0
    ? `${copy.description}\n\n${copy.hashtags.join(" ")}`
    : copy.description

  await patchPin({
    pinId: proj.pinterest_pin_id,
    title: copy.title,
    description,
    link: copy.link,
  })
  await supabase
    .from("projects")
    .update({
      pinterest_synced_at: new Date().toISOString(),
      pinterest_sync_error: null,
    })
    .eq("id", projectId)
}

export async function patchFeaturePin(featureId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient()
  const { data: feat } = await supabase
    .from("project_features")
    .select("pinterest_pin_id, project_id")
    .eq("id", featureId)
    .maybeSingle()
  if (!feat?.pinterest_pin_id) return

  const feature = await loadFeatureContext(featureId)
  if (!feature) return
  const project = await loadProjectContext(feat.project_id)
  if (!project) return

  const copy = composeSpacePinCopy({
    projectTitle: project.title,
    projectSlug: project.slug,
    projectDescription: project.description,
    companyName: project.ownerCompany?.name ?? null,
    companySlug: project.ownerCompany?.slug ?? null,
    city: project.addressCity,
    style: project.style,
    buildingType: project.buildingType,
    scope: null,
    spaceName: feature.spaceName,
    spaceSlug: feature.spaceSlug,
  })
  const description = copy.hashtags.length > 0
    ? `${copy.description}\n\n${copy.hashtags.join(" ")}`
    : copy.description

  await patchPin({
    pinId: feat.pinterest_pin_id,
    title: copy.title,
    description,
    link: copy.link,
  })
  await supabase
    .from("project_features")
    .update({
      pinterest_synced_at: new Date().toISOString(),
      pinterest_sync_error: null,
    })
    .eq("id", featureId)
}

// ── Permanent-error marker ──────────────────────────────────────────────
// The cron worker classifies errors by looking at the .permanent flag on
// the Error. Anything else defaults to transient (retry with backoff).
export function permanentError(message: string): Error {
  const err = new Error(message)
  ;(err as Error & { permanent?: boolean }).permanent = true
  return err
}
