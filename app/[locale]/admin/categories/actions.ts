"use server"

import { revalidatePath } from "next/cache"
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
  input: { categoryId: string; name: string; slug?: string; parentId?: string | null }
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

export async function toggleCanPublishProjectsAction(
  input: { categoryId: string; enabled: boolean }
): Promise<ActionResult> {
  const parseResult = categoryIdSchema.safeParse(input.categoryId)
  if (!parseResult.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid category ID',
      { categoryId: input.categoryId },
      'admin-categories-can-publish'
    )
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      { userId: null },
      'admin-categories-can-publish'
    )
  }

  const serviceSupabase = createServiceRoleSupabaseClient()

  const { error: updateError } = await serviceSupabase
    .from("categories")
    .update({
      can_publish_projects: input.enabled,
      updated_at: new Date().toISOString()
    })
    .eq("id", parseResult.data)

  if (updateError) {
    return createErrorResponse(
      'DATABASE',
      updateError.message,
      { categoryId: parseResult.data, enabled: input.enabled },
      'admin-categories-can-publish'
    )
  }

  revalidatePath("/admin/categories")

  return createSuccessResponse({
    categoryId: parseResult.data,
    canPublishProjects: input.enabled
  })
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
