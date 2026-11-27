"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { z } from "zod"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"
import {
  ActionResult,
  createErrorResponse,
  createSuccessResponse
} from "@/app/admin/lib/error-handling"

const categoryIdSchema = z.string().uuid()

async function assertAdmin() {
  const supabase = await createServerActionSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    logger.security("admin-auth", "Admin authentication failed", {
      error: authError?.message,
      hasUser: !!user,
    })
    return { supabase, user: null, error: authError ?? new Error("Not authenticated") }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !isAdminUser(profile?.user_types)) {
    logger.security("admin-auth", "Admin authorization failed", {
      userId: user.id,
      userTypes: profile?.user_types,
      error: profileError?.message,
    })
    return {
      supabase,
      user,
      error: profileError ?? new Error("Unauthorized"),
    }
  }

  return { supabase, user, error: null }
}

// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function updateCategoryAction(
  input: {
    categoryId: string
    name: string
    nameNl?: string | null
    slug?: string
    parentId?: string | null
    /** Beroepsnamen (alleen diensten): enkelvoud en meervoud, EN en NL. */
    proNamePlural?: string | null
    proNamePluralNl?: string | null
    /** Marktomvang NL (alleen diensten): null = niet ingevuld. */
    tamNl?: number | null
    samNl?: number | null
  }
): Promise<ActionResult> {
  const parseResult = categoryIdSchema.safeParse(input.categoryId)
  if (!parseResult.success) {
    return createErrorResponse('VALIDATION', 'Invalid category id', {}, 'admin-categories-update')
  }

  if (!input.name || input.name.trim().length < 2 || input.name.trim().length > 100) {
    return createErrorResponse('VALIDATION', 'Category name must be between 2 and 100 characters', {}, 'admin-categories-update')
  }

  const { error } = await assertAdmin()
  if (error) return createErrorResponse('AUTH', error.message, {}, 'admin-categories-update')

  const name = input.name.trim()
  const slug = input.slug?.trim() || generateSlug(name)

  const serviceSupabase = createServiceRoleSupabaseClient()

  // Check slug uniqueness
  const { data: existingCategory } = await serviceSupabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .neq("id", parseResult.data)
    .maybeSingle()

  if (existingCategory) {
    return createErrorResponse('VALIDATION', 'A category with this slug already exists', {}, 'admin-categories-update')
  }

  const updateData: Record<string, unknown> = {
    name,
    slug,
    updated_at: new Date().toISOString(),
  }

  if (input.parentId !== undefined) {
    updateData.parent_id = input.parentId
  }

  // Nederlandse naam: leeg = geen eigen vertaling (de site valt dan terug
  // op de Engelse naam).
  if (input.nameNl !== undefined) {
    const nl = (input.nameNl ?? "").trim()
    if (nl.length > 100) {
      return createErrorResponse('VALIDATION', 'Dutch name must be at most 100 characters', {}, 'admin-categories-update')
    }
    updateData.name_nl = nl.length ? nl : null
  }
  for (const [key, column] of [["tamNl", "tam_nl"], ["samNl", "sam_nl"]] as const) {
    const raw = input[key]
    if (raw === undefined) continue
    if (raw !== null && (!Number.isInteger(raw) || raw < 0)) {
      return createErrorResponse('VALIDATION', 'TAM and SAM must be whole numbers of 0 or more', {}, 'admin-categories-update')
    }
    updateData[column] = raw
  }
  const proFields: Array<[keyof typeof input, string]> = [
    ["proNamePlural", "pro_name_plural"], ["proNamePluralNl", "pro_name_plural_nl"],
  ]
  for (const [key, column] of proFields) {
    const raw = input[key]
    if (raw === undefined) continue
    const value = String(raw ?? "").trim()
    if (value.length > 100) {
      return createErrorResponse('VALIDATION', 'Professional name must be at most 100 characters', {}, 'admin-categories-update')
    }
    updateData[column] = value.length ? value : null
  }

  const { error: updateError } = await serviceSupabase
    .from("categories")
    .update(updateData)
    .eq("id", parseResult.data)

  if (updateError) {
    return createErrorResponse('DATABASE', updateError.message, {}, 'admin-categories-update')
  }

  revalidatePath("/admin/categories")
  revalidatePath("/professionals")
  return createSuccessResponse({ categoryId: parseResult.data, name, slug })
}

export async function updateCategoryNameAction(
  input: { categoryId: string; name: string }
): Promise<ActionResult> {
  const parseResult = categoryIdSchema.safeParse(input.categoryId)
  if (!parseResult.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid category id',
      { errors: parseResult.error.flatten() },
      'admin-categories-name'
    )
  }

  if (!input.name || input.name.trim().length < 2 || input.name.trim().length > 100) {
    return createErrorResponse(
      'VALIDATION',
      'Category name must be between 2 and 100 characters',
      { name: input.name },
      'admin-categories-name'
    )
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      { userId: null },
      'admin-categories-name'
    )
  }

  const name = input.name.trim()
  const slug = generateSlug(name)

  // Use service role client to bypass RLS policies
  const serviceSupabase = createServiceRoleSupabaseClient()

  // Check if slug already exists (excluding current category)
  const { data: existingCategory } = await serviceSupabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .neq("id", parseResult.data)
    .maybeSingle()

  if (existingCategory) {
    return createErrorResponse(
      'VALIDATION',
      'A category with this name already exists',
      { name, slug },
      'admin-categories-name'
    )
  }

  const { error: updateError } = await serviceSupabase
    .from("categories")
    .update({
      name,
      slug,
      updated_at: new Date().toISOString()
    })
    .eq("id", parseResult.data)

  if (updateError) {
    return createErrorResponse(
      'DATABASE',
      updateError.message,
      { categoryId: parseResult.data, name },
      'admin-categories-name'
    )
  }

  revalidatePath("/admin/categories")
  revalidatePath("/professionals")

  return createSuccessResponse({
    categoryId: parseResult.data,
    name,
    slug
  })
}

export async function updateCategoryImageAction(
  input: { categoryId: string; imageUrl: string }
): Promise<ActionResult> {
  const parseResult = categoryIdSchema.safeParse(input.categoryId)
  if (!parseResult.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid category id',
      { errors: parseResult.error.flatten() },
      'admin-categories-image'
    )
  }

  if (!input.imageUrl || !input.imageUrl.trim()) {
    return createErrorResponse(
      'VALIDATION',
      'Image URL is required',
      { imageUrl: input.imageUrl },
      'admin-categories-image'
    )
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      { userId: null },
      'admin-categories-image'
    )
  }

  // Use service role client to bypass RLS policies
  const serviceSupabase = createServiceRoleSupabaseClient()
  const { error: updateError } = await serviceSupabase
    .from("categories")
    .update({
      image_url: input.imageUrl.trim(),
      updated_at: new Date().toISOString()
    })
    .eq("id", parseResult.data)

  if (updateError) {
    return createErrorResponse(
      'DATABASE',
      updateError.message,
      { categoryId: parseResult.data, imageUrl: input.imageUrl },
      'admin-categories-image'
    )
  }

  revalidatePath("/admin/categories")
  revalidatePath("/professionals")

  return createSuccessResponse({
    categoryId: parseResult.data,
    imageUrl: input.imageUrl
  })
}

export async function toggleCategoryStatusAction(
  input: { categoryId: string; isActive: boolean }
): Promise<ActionResult> {
  const parseResult = categoryIdSchema.safeParse(input.categoryId)
  if (!parseResult.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid category id',
      { errors: parseResult.error.flatten() },
      'admin-categories-status'
    )
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      { userId: null },
      'admin-categories-status'
    )
  }

  // Use service role client to bypass RLS policies
  const serviceSupabase = createServiceRoleSupabaseClient()
  const { error: updateError } = await serviceSupabase
    .from("categories")
    .update({
      is_active: input.isActive,
      updated_at: new Date().toISOString()
    })
    .eq("id", parseResult.data)

  if (updateError) {
    return createErrorResponse(
      'DATABASE',
      updateError.message,
      { categoryId: parseResult.data, isActive: input.isActive },
      'admin-categories-status'
    )
  }

  revalidatePath("/admin/categories")
  revalidatePath("/professionals")

  return createSuccessResponse({
    categoryId: parseResult.data,
    isActive: input.isActive
  })
}

export async function deleteCategoryAction(
  input: { categoryId: string }
): Promise<ActionResult> {
  const parseResult = categoryIdSchema.safeParse(input.categoryId)
  if (!parseResult.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid category id',
      { errors: parseResult.error.flatten() },
      'admin-categories-delete'
    )
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      { userId: null },
      'admin-categories-delete'
    )
  }

  // Use service role client to bypass RLS policies
  const serviceSupabase = createServiceRoleSupabaseClient()

  // Check if category has children
  const { data: children } = await serviceSupabase
    .from("categories")
    .select("id")
    .eq("parent_id", parseResult.data)
    .limit(1)

  if (children && children.length > 0) {
    return createErrorResponse(
      'VALIDATION',
      'Cannot delete category with subcategories. Please delete or reassign subcategories first.',
      { categoryId: parseResult.data },
      'admin-categories-delete'
    )
  }

  // Soft delete by setting is_active to false
  const { error: updateError } = await serviceSupabase
    .from("categories")
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq("id", parseResult.data)

  if (updateError) {
    return createErrorResponse(
      'DATABASE',
      updateError.message,
      { categoryId: parseResult.data },
      'admin-categories-delete'
    )
  }

  revalidatePath("/admin/categories")
  revalidatePath("/professionals")

  return createSuccessResponse({
    categoryId: parseResult.data
  })
}

export async function toggleHomeCarrouselAction(
  input: { categoryId: string; enabled: boolean; categoryType: string }
): Promise<ActionResult> {
  const parseResult = categoryIdSchema.safeParse(input.categoryId)
  if (!parseResult.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid category id',
      { errors: parseResult.error.flatten() },
      'admin-categories-home-carrousel'
    )
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      { userId: null },
      'admin-categories-home-carrousel'
    )
  }

  const serviceSupabase = createServiceRoleSupabaseClient()

  // Enforce max 5 per category type when enabling
  if (input.enabled) {
    const { data: currentCount } = await serviceSupabase
      .from("categories")
      .select("id")
      .eq("in_home_carrousel", true)
      .eq("is_active", true)
      .eq("category_type", input.categoryType)
      .eq("category_hierarchy", 2)

    if (currentCount && currentCount.length >= 5) {
      return createErrorResponse(
        'VALIDATION',
        'Maximum 5 categories can be shown on the homepage carousel. Please remove one first.',
        { categoryType: input.categoryType, currentCount: currentCount.length },
        'admin-categories-home-carrousel'
      )
    }
  }

  const { error: updateError } = await serviceSupabase
    .from("categories")
    .update({
      in_home_carrousel: input.enabled,
      updated_at: new Date().toISOString()
    })
    .eq("id", parseResult.data)

  if (updateError) {
    return createErrorResponse(
      'DATABASE',
      updateError.message,
      { categoryId: parseResult.data, enabled: input.enabled },
      'admin-categories-home-carrousel'
    )
  }

  revalidatePath("/admin/categories")
  revalidatePath("/")

  return createSuccessResponse({
    categoryId: parseResult.data,
    inHomeCarrousel: input.enabled
  })
}

/** Ruimte actief of niet: een inactieve ruimte verdwijnt uit filters en
 *  de fototour, bestaande foto's houden hun ruimte. */
export async function toggleSpaceStatusAction(
  input: { spaceId: string; enabled: boolean }
): Promise<ActionResult> {
  const parsed = z.object({ spaceId: z.string().uuid(), enabled: z.boolean() }).safeParse(input)
  if (!parsed.success) {
    return createErrorResponse('VALIDATION', 'Invalid input', { input }, 'admin-spaces-status')
  }
  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse('AUTH', error.message, { userId: null }, 'admin-spaces-status')
  }
  const serviceSupabase = createServiceRoleSupabaseClient()
  const { error: updateError } = await serviceSupabase
    .from("spaces")
    .update({ is_active: parsed.data.enabled })
    .eq("id", parsed.data.spaceId)
  if (updateError) {
    return createErrorResponse('DATABASE', updateError.message, { spaceId: parsed.data.spaceId }, 'admin-spaces-status')
  }
  revalidatePath("/admin/categories")
  revalidatePath("/projects")
  return createSuccessResponse({ spaceId: parsed.data.spaceId, isActive: parsed.data.enabled })
}

export async function toggleSpaceHomeCarrouselAction(
  input: { spaceId: string; enabled: boolean }
): Promise<ActionResult> {
  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse('AUTH', error.message, { userId: null }, 'admin-spaces-home-carrousel')
  }

  const serviceSupabase = createServiceRoleSupabaseClient()

  // Enforce max 5 spaces in homepage carousel
  if (input.enabled) {
    const { data: currentCount } = await serviceSupabase
      .from("spaces")
      .select("id")
      .eq("in_home_carrousel" as any, true)
      .eq("is_active", true)

    if (currentCount && currentCount.length >= 5) {
      return createErrorResponse(
        'VALIDATION',
        'Maximum 5 spaces can be shown on the homepage carousel. Please remove one first.',
        { currentCount: currentCount.length },
        'admin-spaces-home-carrousel'
      )
    }
  }

  const { error: updateError } = await serviceSupabase
    .from("spaces")
    .update({ in_home_carrousel: input.enabled } as any)
    .eq("id", input.spaceId)

  if (updateError) {
    return createErrorResponse('DATABASE', updateError.message, { spaceId: input.spaceId }, 'admin-spaces-home-carrousel')
  }

  revalidatePath("/admin/categories")
  revalidatePath("/")

  return createSuccessResponse({ spaceId: input.spaceId, inHomeCarrousel: input.enabled })
}

export async function createCategoryAction(
  input: { name: string; parentId?: string | null; description?: string | null; categoryType?: string | null }
): Promise<ActionResult> {
  if (!input.name || input.name.trim().length < 2 || input.name.trim().length > 100) {
    return createErrorResponse(
      'VALIDATION',
      'Category name must be between 2 and 100 characters',
      { name: input.name },
      'admin-categories-create'
    )
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      { userId: null },
      'admin-categories-create'
    )
  }

  const name = input.name.trim()
  const slug = generateSlug(name)

  // Use service role client to bypass RLS policies
  const serviceSupabase = createServiceRoleSupabaseClient()

  // Check if slug already exists
  const { data: existingCategory } = await serviceSupabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()

  if (existingCategory) {
    return createErrorResponse(
      'VALIDATION',
      'A category with this name already exists',
      { name, slug },
      'admin-categories-create'
    )
  }

  // Determine hierarchy: parent (group) = 1, child = 2
  // For project types without a parent, still treat as child-level (flat)
  const hierarchy = input.parentId
    ? 2
    : input.categoryType === "Professional"
      ? 1
      : 2

  const insertData = {
    name,
    slug,
    parent_id: input.parentId || null,
    description: input.description?.trim() || null,
    is_active: true,
    category_type: input.categoryType || null,
    category_hierarchy: hierarchy,
  }

  const { data: newCategory, error: insertError } = await serviceSupabase
    .from("categories")
    .insert(insertData as any)
    .select("id, name, slug")
    .single()

  if (insertError) {
    return createErrorResponse(
      'DATABASE',
      insertError.message,
      { name, slug },
      'admin-categories-create'
    )
  }

  revalidatePath("/admin/categories")
  revalidatePath("/professionals")

  return createSuccessResponse({
    category: newCategory
  })
}

const publishScopeSchema = z.object({
  categoryId: categoryIdSchema,
  scope: z.enum(["none", "project", "partial"]),
})

/** Wat een dienst publiceert: niets, projecten of deelprojecten
 *  (lib/publish-scope.ts). can_publish_projects volgt via trigger. */
export async function setPublishScopeAction(
  input: { categoryId: string; scope: "none" | "project" | "partial" }
): Promise<ActionResult> {
  const parsed = publishScopeSchema.safeParse(input)
  if (!parsed.success) {
    return createErrorResponse('VALIDATION', 'Invalid input', { input }, 'admin-categories-publish-scope')
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse('AUTH', error.message, { userId: null }, 'admin-categories-publish-scope')
  }

  const serviceSupabase = createServiceRoleSupabaseClient()
  const { error: updateError } = await serviceSupabase
    .from("categories")
    .update({ publish_scope: parsed.data.scope, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.categoryId)

  if (updateError) {
    return createErrorResponse('DATABASE', updateError.message, { ...parsed.data }, 'admin-categories-publish-scope')
  }

  revalidatePath("/admin/categories")
  return createSuccessResponse({ ...parsed.data })
}

const linkSchema = z.object({
  a: z.string().uuid(),
  b: z.string().uuid(),
  enabled: z.boolean(),
})

/** Eén koppelrij aan of uit in een jointabel met twee uuid-kolommen. */
async function toggleLink(
  table: "service_spaces" | "product_category_spaces",
  columns: readonly [string, string],
  input: { a: string; b: string; enabled: boolean },
  tag: string,
): Promise<ActionResult> {
  const parsed = linkSchema.safeParse(input)
  if (!parsed.success) {
    return createErrorResponse('VALIDATION', 'Invalid input', { input }, tag)
  }
  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse('AUTH', error.message, { userId: null }, tag)
  }
  const serviceSupabase = createServiceRoleSupabaseClient() as any
  const row = { [columns[0]]: parsed.data.a, [columns[1]]: parsed.data.b }
  const { error: dbError } = parsed.data.enabled
    ? await serviceSupabase.from(table).upsert(row, { onConflict: columns.join(",") })
    : await serviceSupabase.from(table).delete().match(row)
  if (dbError) {
    return createErrorResponse('DATABASE', dbError.message, { table, ...row }, tag)
  }
  revalidatePath("/admin/categories")
  return createSuccessResponse({ table, ...row, enabled: parsed.data.enabled })
}

/** Dienst ↔ ruimte: waar het werk van een dienst zichtbaar wordt. */
export async function toggleServiceSpaceAction(input: { serviceId: string; spaceId: string; enabled: boolean }): Promise<ActionResult> {
  return toggleLink("service_spaces", ["service_id", "space_id"], { a: input.serviceId, b: input.spaceId, enabled: input.enabled }, 'admin-categories-service-space')
}

export async function uploadCategoryImageAction(
  formData: FormData
): Promise<ActionResult & { imageUrl?: string }> {
  const { error } = await assertAdmin()
  if (error) return createErrorResponse('AUTH', error.message, {}, 'admin-categories-upload')

  const file = formData.get("file") as File | null
  const targetId = formData.get("targetId") as string | null
  const targetType = formData.get("targetType") as string | null // "category" or "space"

  if (!file || !targetId || !targetType) {
    return createErrorResponse('VALIDATION', 'Missing file, targetId, or targetType', {}, 'admin-categories-upload')
  }

  const serviceSupabase = createServiceRoleSupabaseClient()
  const folder = targetType === "space" ? "spaces" : "categories"
  const path = `${folder}/${targetId}-${Date.now()}.jpg`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await serviceSupabase.storage
    .from("company-assets")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true })

  if (uploadError) {
    return createErrorResponse('DATABASE', `Upload failed: ${uploadError.message}`, {}, 'admin-categories-upload')
  }

  const { data: urlData } = serviceSupabase.storage.from("company-assets").getPublicUrl(path)
  const imageUrl = `${urlData.publicUrl}?v=${Date.now()}`

  // Update the record
  if (targetType === "space") {
    await serviceSupabase.from("spaces").update({ image_url: imageUrl } as any).eq("id", targetId)
  } else {
    await serviceSupabase.from("categories").update({ image_url: imageUrl, updated_at: new Date().toISOString() }).eq("id", targetId)
  }

  revalidatePath("/admin/categories")
  return { ...createSuccessResponse({ imageUrl }), imageUrl }
}

/** Uitsnede voor de cirkel op /projects: ongewijzigd opgeslagen (PNG met
 *  transparantie of een productfoto op wit), geen bijsnijden. */
export async function uploadSpaceCutoutAction(
  formData: FormData
): Promise<ActionResult & { cutoutUrl?: string }> {
  const { error } = await assertAdmin()
  if (error) return createErrorResponse('AUTH', error.message, {}, 'admin-spaces-cutout')

  const file = formData.get("file") as File | null
  const spaceId = formData.get("spaceId") as string | null
  if (!file || !spaceId || !categoryIdSchema.safeParse(spaceId).success) {
    return createErrorResponse('VALIDATION', 'Missing file or space', {}, 'admin-spaces-cutout')
  }
  const type = file.type || "image/png"
  const ext = type === "image/webp" ? "webp" : type === "image/jpeg" ? "jpg" : "png"
  const path = `spaces/${spaceId}-cutout-${Date.now()}.${ext}`

  const serviceSupabase = createServiceRoleSupabaseClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await serviceSupabase.storage
    .from("company-assets")
    .upload(path, buffer, { contentType: type, upsert: true })
  if (uploadError) {
    return createErrorResponse('DATABASE', `Upload failed: ${uploadError.message}`, {}, 'admin-spaces-cutout')
  }
  const { data: urlData } = serviceSupabase.storage.from("company-assets").getPublicUrl(path)
  const cutoutUrl = urlData.publicUrl
  const { error: updateError } = await serviceSupabase.from("spaces").update({ cutout_url: cutoutUrl }).eq("id", spaceId)
  if (updateError) {
    return createErrorResponse('DATABASE', updateError.message, { spaceId }, 'admin-spaces-cutout')
  }
  revalidatePath("/admin/categories")
  revalidatePath("/projects")
  return { ...createSuccessResponse({ cutoutUrl }), cutoutUrl }
}

export async function clearSpaceCutoutAction(input: { spaceId: string }): Promise<ActionResult> {
  const parsed = categoryIdSchema.safeParse(input.spaceId)
  if (!parsed.success) return createErrorResponse('VALIDATION', 'Invalid space id', {}, 'admin-spaces-cutout')
  const { error } = await assertAdmin()
  if (error) return createErrorResponse('AUTH', error.message, {}, 'admin-spaces-cutout')
  const serviceSupabase = createServiceRoleSupabaseClient()
  const { error: updateError } = await serviceSupabase.from("spaces").update({ cutout_url: null }).eq("id", parsed.data)
  if (updateError) return createErrorResponse('DATABASE', updateError.message, { spaceId: parsed.data }, 'admin-spaces-cutout')
  revalidatePath("/admin/categories")
  revalidatePath("/projects")
  return createSuccessResponse({ spaceId: parsed.data })
}

export async function updateSpaceImageAction(
  input: { spaceId: string; imageUrl: string }
): Promise<ActionResult> {
  const parseResult = categoryIdSchema.safeParse(input.spaceId)
  if (!parseResult.success) {
    return createErrorResponse('VALIDATION', 'Invalid space id', {}, 'admin-spaces-image')
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse('AUTH', error.message, {}, 'admin-spaces-image')
  }

  const serviceSupabase = createServiceRoleSupabaseClient()
  const { error: updateError } = await serviceSupabase
    .from("spaces")
    .update({ image_url: input.imageUrl } as any)
    .eq("id", parseResult.data)

  if (updateError) {
    return createErrorResponse('DATABASE', updateError.message, {}, 'admin-spaces-image')
  }

  revalidatePath("/admin/categories")
  return createSuccessResponse({ spaceId: parseResult.data })
}

/**
 * Swap order_index of two product categories (for up/down reordering).
 */
/** Zet een productcategorie aan of uit (migratie 320). Uit = niet in menu en
 *  filters, met alles eronder; merken en collecties houden hun koppeling. */
export async function setProductCategoryActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult<{ success: true }>> {
  const { error } = await assertAdmin()
  if (error) return createErrorResponse("AUTH", error.message, {}, "admin-product-cat-active")

  const supabase = createServiceRoleSupabaseClient()
  const { error: updateError } = await supabase
    .from("product_categories")
    .update({ is_active: isActive } as any)
    .eq("id", id)
  if (updateError) return createErrorResponse("DATABASE", updateError.message, {}, "admin-product-cat-active")

  revalidatePath("/admin/categories")
  revalidatePath("/products")
  revalidatePath("/brands")
  // Het Producten-menu in de header (lib/nav-menu, vijf minuten gecachet).
  revalidateTag("nav-menus")
  return createSuccessResponse({ success: true as const })
}

/** Productherkenning per categorie (migraties 362–363): de stand voor de
 *  stippen (null = van de ouder) en extra context voor Claude. Geldt voor
 *  foto's die vanaf nu herkend worden. */
export async function setProductCategoryDetectAction(
  id: string,
  patch: { mode?: "auto" | "show" | "hide" | "off" | null; hint?: string | null },
): Promise<ActionResult<{ success: true }>> {
  const { error } = await assertAdmin()
  if (error) return createErrorResponse("AUTH", error.message, {}, "admin-product-cat-detect")

  const update: Record<string, unknown> = {}
  if (patch.mode !== undefined) {
    if (patch.mode !== null && !["auto", "show", "hide", "off"].includes(patch.mode)) return createErrorResponse("VALIDATION", "Unknown mode", {}, "admin-product-cat-detect")
    update.detect_mode = patch.mode
  }
  if (patch.hint !== undefined) update.detect_hint = patch.hint?.trim().slice(0, 500) || null
  if (Object.keys(update).length === 0) return createSuccessResponse({ success: true as const })

  const supabase = createServiceRoleSupabaseClient()
  const { error: updateError } = await supabase.from("product_categories").update(update as any).eq("id", id)
  if (updateError) return createErrorResponse("DATABASE", updateError.message, {}, "admin-product-cat-detect")

  revalidatePath("/admin/categories")
  return createSuccessResponse({ success: true as const })
}

/** Eigen beeld voor de schijf van een productgroep op /products (migratie
 *  321): een uitsnede of productfoto op wit, ongewijzigd opgeslagen. */
export async function uploadProductCategoryImageAction(
  formData: FormData,
): Promise<ActionResult & { imageUrl?: string }> {
  const { error } = await assertAdmin()
  if (error) return createErrorResponse("AUTH", error.message, {}, "admin-product-cat-image")

  const file = formData.get("file") as File | null
  const categoryId = formData.get("categoryId") as string | null
  if (!file || !categoryId || !categoryIdSchema.safeParse(categoryId).success) {
    return createErrorResponse("VALIDATION", "Missing file or category", {}, "admin-product-cat-image")
  }
  if (file.size > 5 * 1024 * 1024) return createErrorResponse("VALIDATION", "Image must be under 5MB", {}, "admin-product-cat-image")
  const type = file.type || "image/png"
  const ext = type === "image/webp" ? "webp" : type === "image/jpeg" ? "jpg" : "png"
  // Eigen naam per upload: anders blijft de oude versie in de cache hangen.
  const path = `product-categories/${categoryId}-${Date.now()}.${ext}`

  const serviceSupabase = createServiceRoleSupabaseClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await serviceSupabase.storage.from("company-assets").upload(path, buffer, { contentType: type, upsert: true })
  if (uploadError) return createErrorResponse("DATABASE", `Upload failed: ${uploadError.message}`, {}, "admin-product-cat-image")
  const { data: urlData } = serviceSupabase.storage.from("company-assets").getPublicUrl(path)
  const imageUrl = urlData.publicUrl
  const { error: updateError } = await serviceSupabase.from("product_categories").update({ image_url: imageUrl } as any).eq("id", categoryId)
  if (updateError) return createErrorResponse("DATABASE", updateError.message, {}, "admin-product-cat-image")

  revalidatePath("/admin/categories")
  revalidatePath("/products")
  return { ...createSuccessResponse({ imageUrl }), imageUrl }
}

/** Terug naar automatisch: de productfoto van de meest toegepaste collectie. */
export async function clearProductCategoryImageAction(categoryId: string): Promise<ActionResult> {
  const parsed = categoryIdSchema.safeParse(categoryId)
  if (!parsed.success) return createErrorResponse("VALIDATION", "Invalid category id", {}, "admin-product-cat-image")
  const { error } = await assertAdmin()
  if (error) return createErrorResponse("AUTH", error.message, {}, "admin-product-cat-image")
  const serviceSupabase = createServiceRoleSupabaseClient()
  const { error: updateError } = await serviceSupabase.from("product_categories").update({ image_url: null } as any).eq("id", parsed.data)
  if (updateError) return createErrorResponse("DATABASE", updateError.message, {}, "admin-product-cat-image")
  revalidatePath("/admin/categories")
  revalidatePath("/products")
  return createSuccessResponse({})
}

export async function swapProductCategoryOrderAction(
  idA: string,
  orderA: number,
  idB: string,
  orderB: number,
): Promise<ActionResult<{ success: true }>> {
  const { error } = await assertAdmin()
  if (error) return createErrorResponse("AUTH", error.message, {}, "admin-product-cat-reorder")

  const supabase = createServiceRoleSupabaseClient()

  const { error: errA } = await supabase
    .from("product_categories")
    .update({ order_index: orderB } as any)
    .eq("id", idA)
  if (errA) return createErrorResponse("DATABASE", errA.message, {}, "admin-product-cat-reorder")

  const { error: errB } = await supabase
    .from("product_categories")
    .update({ order_index: orderA } as any)
    .eq("id", idB)
  if (errB) return createErrorResponse("DATABASE", errB.message, {}, "admin-product-cat-reorder")

  revalidatePath("/admin/categories")
  return createSuccessResponse({ success: true as const })
}
