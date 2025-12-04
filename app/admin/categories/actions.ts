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

export async function createCategoryAction(
  input: { name: string; parentId?: string | null; description?: string | null }
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

  const { data: newCategory, error: insertError } = await serviceSupabase
    .from("categories")
    .insert({
      name,
      slug,
      parent_id: input.parentId || null,
      description: input.description?.trim() || null,
      is_active: true
    })
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
