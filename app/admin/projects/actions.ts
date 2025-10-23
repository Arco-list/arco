"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"
import { generateUniqueSlug, isValidSlug } from "@/lib/seo-utils"
import { sendProjectStatusEmail, sendProfessionalInviteEmail, checkUserAndGenerateInviteUrl } from "@/lib/email-service"
import { 
  ActionResult, 
  createErrorResponse, 
  createSuccessResponse, 
  retryOperation,
  getErrorMessage,
  getErrorCode 
} from "@/app/admin/lib/error-handling"

const projectIdSchema = z.string().uuid()

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

export async function setProjectFeaturedAction(
  input: { projectId: string; featured: boolean }
): Promise<ActionResult> {
  const parseResult = projectIdSchema.safeParse(input.projectId)
  if (!parseResult.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid project id',
      { errors: parseResult.error.flatten() },
      'admin-projects-featured'
    )
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      { userId: null },
      'admin-projects-featured'
    )
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({ is_featured: input.featured })
    .eq("id", parseResult.data)

  if (updateError) {
    return createErrorResponse(
      'DATABASE',
      updateError.message,
      { projectId: parseResult.data, featured: input.featured },
      'admin-projects-featured'
    )
  }

  revalidatePath("/admin/projects")
  return createSuccessResponse({ projectId: parseResult.data, featured: input.featured })
}

const statusSchema = z.enum(["draft", "in_progress", "published", "completed", "archived", "rejected"])

export async function setProjectStatusAction(input: {
  projectId: string
  status: z.infer<typeof statusSchema>
  rejectionReason?: string | null
}): Promise<ActionResult> {
  const idResult = projectIdSchema.safeParse(input.projectId)
  if (!idResult.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid project id',
      { errors: idResult.error.flatten() },
      'admin-projects-status'
    )
  }

  const statusResult = statusSchema.safeParse(input.status)
  if (!statusResult.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid status value',
      { providedStatus: input.status, allowedValues: statusSchema.options },
      'admin-projects-status'
    )
  }

  const trimmedReason = input.rejectionReason?.trim()
  if (statusResult.data === "rejected" && (!trimmedReason || trimmedReason.length === 0)) {
    return createErrorResponse(
      'VALIDATION',
      'Rejection reason is required when rejecting a project',
      { status: statusResult.data },
      'admin-projects-status'
    )
  }

  const { supabase, user, error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      { hasUser: !!user },
      'admin-projects-status'
    )
  }

  const updatePayload: Record<string, unknown> = {
    status: statusResult.data,
    status_updated_at: new Date().toISOString(),
    status_updated_by: user.id,
    rejection_reason: statusResult.data === "rejected" ? trimmedReason : null,
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update(updatePayload)
    .eq("id", idResult.data)

  if (updateError) {
    return createErrorResponse(
      'DATABASE',
      updateError.message,
      { projectId: idResult.data, status: statusResult.data },
      'admin-projects-status'
    )
  }

  // Retry materialized view refresh with exponential backoff
  const serviceClient = createServiceRoleSupabaseClient()
  const warnings: string[] = []
  
  const { error: refreshError } = await retryOperation(
    async () => {
      const { error } = await serviceClient.rpc("refresh_project_summary")
      if (error) throw error
    },
    {
      maxAttempts: 3,
      onRetry: (attempt) => {
        logger.warn(
          `Retrying materialized view refresh (attempt ${attempt})`,
          { scope: "admin-projects", projectId: idResult.data }
        )
      }
    }
  )

  if (refreshError) {
    logger.error(
      "Failed to refresh project summary after status update",
      { 
        scope: "admin-projects", 
        projectId: idResult.data, 
        nextStatus: statusResult.data,
        error: getErrorMessage(refreshError)
      }
    )
    warnings.push("Project status updated successfully, but search index refresh failed. It will be updated automatically soon.")
  }

  // If project is being published, send emails
  if (statusResult.data === "published") {
    try {
      // Get project details and owner email
      const { data: project } = await serviceClient
        .from('projects')
        .select(`
          title,
          client_id,
          profiles!client_id(first_name, last_name)
        `)
        .eq('id', idResult.data)
        .single()
      
      logger.info("Project data retrieved", {
        scope: "admin-projects",
        projectId: idResult.data,
        hasTitle: !!project?.title,
        hasClientId: !!project?.client_id,
        hasProfile: !!project?.profiles
      })

      // Get owner's email from auth.users table
      let ownerEmail: string | null = null
      if (project?.client_id) {
        try {
          const { data: ownerAuth, error: authError } = await serviceClient.auth.admin.getUserById(project.client_id)
          ownerEmail = ownerAuth?.user?.email || null
          
          logger.info("Owner auth lookup", {
            scope: "admin-projects",
            clientId: project.client_id,
            hasEmail: !!ownerEmail,
            authError: authError?.message
          })
        } catch (error) {
          logger.error("Failed to get owner email", {
            scope: "admin-projects",
            clientId: project.client_id,
            error: getErrorMessage(error)
          })
        }
      }
      
      const ownerFirstName = project?.profiles?.first_name || ''
      const ownerFullName = [project?.profiles?.first_name, project?.profiles?.last_name].filter(Boolean).join(' ') || ownerEmail || 'Project Owner'

      // Send project live email to owner
      if (ownerEmail) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
          await sendProjectStatusEmail(
            ownerEmail,
            'live',
            {
              firstname: ownerFirstName,
              project_title: project?.title || 'Your Project',
              project_name: project?.title || 'Your Project',
              dashboard_link: `${baseUrl}/dashboard/listings`
            }
          )
          
          logger.info("Project live email sent", {
            scope: "admin-projects",
            projectId: idResult.data,
            emailSent: true
          })
        } catch (emailError) {
          logger.error("Failed to send project live email", {
            scope: "admin-projects",
            projectId: idResult.data,
            error: getErrorMessage(emailError)
          })
        }
      } else {
        logger.warn("No owner email found for project live notification", {
          scope: "admin-projects",
          projectId: idResult.data,
          clientId: project?.client_id
        })
      }

      // Get ALL professional invites and send emails (both 'invited' and 'listed')
      // Exclude project owner from receiving invite email
      const { data: invites } = await supabase
        .from('project_professionals')
        .select('id, invited_email')
        .eq('project_id', idResult.data)
        .neq('status', 'rejected')

      for (const invite of invites || []) {
        // Skip sending email to project owner
        if (ownerEmail && invite.invited_email.toLowerCase() === ownerEmail.toLowerCase()) {
          logger.info("Skipping invite email for project owner", {
            scope: "admin-projects",
            projectId: idResult.data
          })
          continue
        }

        try {
          // Generate smart URL based on user type
          const { confirmUrl } = await checkUserAndGenerateInviteUrl(
            invite.invited_email,
            idResult.data
          )
          
          await sendProfessionalInviteEmail(
            invite.invited_email,
            {
              project_owner: ownerFullName,
              project_name: project?.title || 'Project',
              project_title: project?.title || 'Project',
              confirmUrl
            }
          )
          
          logger.info("Professional invite email sent", {
            scope: "admin-projects",
            projectId: idResult.data,
            inviteId: invite.id
          })
        } catch (inviteEmailError) {
          logger.error("Failed to send professional invite email", {
            scope: "admin-projects",
            projectId: idResult.data,
            inviteId: invite.id,
            error: getErrorMessage(inviteEmailError)
          })
        }
      }
    } catch (emailError) {
      logger.warn("Email sending failed during project approval", {
        scope: "admin-projects",
        projectId: idResult.data,
        error: getErrorMessage(emailError)
      })
      warnings.push("Project published but email notifications may have failed.")
    }
  }

  revalidatePath("/admin/projects")
  return createSuccessResponse(
    { 
      projectId: idResult.data, 
      status: statusResult.data,
      updatedBy: user.id 
    }, 
    warnings
  )
}

const ownerInputSchema = z.object({
  projectId: projectIdSchema,
  ownerEmail: z.string().email(),
})

export async function changeProjectOwnerAction(
  input: { projectId: string; ownerEmail: string }
): Promise<ActionResult> {
  const parsed = ownerInputSchema.safeParse(input)
  if (!parsed.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid email address or project ID',
      { errors: parsed.error.flatten() },
      'admin-projects-owner'
    )
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      {},
      'admin-projects-owner'
    )
  }

  const serviceClient = createServiceRoleSupabaseClient()

  const { data: authData, error: ownerError } = await serviceClient.auth.admin.listUsers()
    .then(({ data, error }) => {
      if (error) return { data: null, error }
      const user = data.users.find(u => u.email?.toLowerCase() === parsed.data.ownerEmail.toLowerCase())
      return { data: user ? { user } : null, error: null }
    })
  
  if (ownerError || !authData?.user) {
    return createErrorResponse(
      'BUSINESS_LOGIC',
      `No user found with email: ${parsed.data.ownerEmail}`,
      { email: parsed.data.ownerEmail, error: ownerError?.message },
      'admin-projects-owner'
    )
  }

  const ownerUser = authData.user

  const { data: ownerProfile, error: profileError } = await serviceClient
    .from("profiles")
    .select("user_types")
    .eq("id", ownerUser.id)
    .maybeSingle()

  if (profileError) {
    return createErrorResponse(
      'DATABASE',
      profileError.message,
      { userId: ownerUser.id },
      'admin-projects-owner'
    )
  }

  const ownerTypes = ownerProfile?.user_types ?? []
  if (!ownerTypes.includes("professional")) {
    return createErrorResponse(
      'BUSINESS_LOGIC',
      'Selected user must have a professional account to own projects',
      { email: parsed.data.ownerEmail, userTypes: ownerTypes },
      'admin-projects-owner'
    )
  }

  const { error: updateError } = await serviceClient
    .from("projects")
    .update({ client_id: ownerUser.id })
    .eq("id", parsed.data.projectId)

  if (updateError) {
    return createErrorResponse(
      'DATABASE',
      updateError.message,
      { projectId: parsed.data.projectId, newOwnerId: ownerUser.id },
      'admin-projects-owner'
    )
  }

  revalidatePath("/admin/projects")
  return createSuccessResponse({ 
    projectId: parsed.data.projectId, 
    newOwnerId: ownerUser.id,
    ownerEmail: parsed.data.ownerEmail
  })
}

export async function deleteProjectAction(
  input: { projectId: string }
): Promise<ActionResult> {
  const parsed = projectIdSchema.safeParse(input.projectId)
  if (!parsed.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid project id',
      { errors: parsed.error.flatten() },
      'admin-projects-delete'
    )
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      {},
      'admin-projects-delete'
    )
  }

  const serviceClient = createServiceRoleSupabaseClient()
  const { error: deleteError } = await serviceClient.from("projects").delete().eq("id", parsed.data)

  if (deleteError) {
    return createErrorResponse(
      'DATABASE',
      deleteError.message,
      { projectId: parsed.data },
      'admin-projects-delete'
    )
  }

  revalidatePath("/admin/projects")
  return createSuccessResponse({ deletedProjectId: parsed.data })
}

const seoUpdateSchema = z.object({
  projectId: projectIdSchema,
  slug: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
})

export async function updateProjectSeoAction(input: {
  projectId: string
  slug?: string
  seoTitle?: string
  seoDescription?: string
}): Promise<ActionResult> {
  const parsed = seoUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid input data',
      { errors: parsed.error.flatten() },
      'admin-projects-seo'
    )
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      {},
      'admin-projects-seo'
    )
  }

  const serviceClient = createServiceRoleSupabaseClient()
  const warnings: string[] = []

  // Validate slug if provided
  if (parsed.data.slug !== undefined) {
    if (parsed.data.slug && !isValidSlug(parsed.data.slug)) {
      return createErrorResponse(
        'VALIDATION',
        'Slug must contain only lowercase letters, numbers, and hyphens',
        { providedSlug: parsed.data.slug },
        'admin-projects-seo'
      )
    }

    // Check for slug conflicts (excluding current project)
    if (parsed.data.slug) {
      const { data: existingProject, error: checkError } = await serviceClient
        .from("projects")
        .select("id")
        .eq("slug", parsed.data.slug)
        .neq("id", parsed.data.projectId)
        .maybeSingle()

      if (checkError) {
        return createErrorResponse(
          'DATABASE',
          checkError.message,
          { projectId: parsed.data.projectId, slug: parsed.data.slug },
          'admin-projects-seo'
        )
      }

      if (existingProject) {
        return createErrorResponse(
          'BUSINESS_LOGIC',
          'This slug is already in use by another project',
          { slug: parsed.data.slug, conflictingProjectId: existingProject.id },
          'admin-projects-seo'
        )
      }
    }
  }

  // Get current project data to create redirect if slug is changing
  const { data: currentProject, error: currentError } = await serviceClient
    .from("projects")
    .select("slug, title")
    .eq("id", parsed.data.projectId)
    .single()

  if (currentError) {
    return createErrorResponse(
      'DATABASE',
      currentError.message,
      { projectId: parsed.data.projectId },
      'admin-projects-seo'
    )
  }

  // Prepare update payload
  const updatePayload: Record<string, unknown> = {}
  if (parsed.data.slug !== undefined) updatePayload.slug = parsed.data.slug || null
  if (parsed.data.seoTitle !== undefined) updatePayload.seo_title = parsed.data.seoTitle || null
  if (parsed.data.seoDescription !== undefined) updatePayload.seo_description = parsed.data.seoDescription || null

  // Update project
  const { error: updateError } = await serviceClient
    .from("projects")
    .update(updatePayload)
    .eq("id", parsed.data.projectId)

  if (updateError) {
    return createErrorResponse(
      'DATABASE',
      updateError.message,
      { projectId: parsed.data.projectId, payload: updatePayload },
      'admin-projects-seo'
    )
  }

  // TODO: Implement redirect functionality when project_redirects table is available
  if (
    parsed.data.slug !== undefined &&
    currentProject.slug &&
    parsed.data.slug &&
    currentProject.slug !== parsed.data.slug
  ) {
    logger.warn(
      "Slug changed but redirect functionality is not yet implemented",
      { 
        scope: "admin-seo", 
        projectId: parsed.data.projectId,
        oldSlug: currentProject.slug,
        newSlug: parsed.data.slug
      }
    )
    warnings.push(
      `SEO settings updated successfully. Note: Old URLs (${currentProject.slug}) ` +
      `will no longer work. Redirect functionality is coming soon.`
    )
  }

  revalidatePath("/admin/projects")
  if (parsed.data.slug) {
    revalidatePath(`/projects/${parsed.data.slug}`)
  }
  if (currentProject.slug && currentProject.slug !== parsed.data.slug) {
    revalidatePath(`/projects/${currentProject.slug}`)
  }
  return createSuccessResponse(
    {
      projectId: parsed.data.projectId,
      updatedFields: Object.keys(updatePayload),
      ...(parsed.data.slug && { newSlug: parsed.data.slug })
    },
    warnings
  )
}

export async function generateProjectSlugAction(
  input: { projectId: string; title: string }
): Promise<ActionResult<{ slug: string }>> {
  const parseResult = z.object({
    projectId: projectIdSchema,
    title: z.string().min(1),
  }).safeParse(input)

  if (!parseResult.success) {
    return createErrorResponse(
      'VALIDATION',
      'Invalid input data',
      { errors: parseResult.error.flatten() },
      'admin-projects-slug-generate'
    )
  }

  const { error } = await assertAdmin()
  if (error) {
    return createErrorResponse(
      'AUTH',
      error.message,
      {},
      'admin-projects-slug-generate'
    )
  }

  const serviceClient = createServiceRoleSupabaseClient()

  try {
    const checkSlugExists = async (slug: string): Promise<boolean> => {
      const { data, error } = await serviceClient
        .from("projects")
        .select("id")
        .eq("slug", slug)
        .neq("id", parseResult.data.projectId)
        .maybeSingle()

      if (error) throw error
      return Boolean(data)
    }

    const uniqueSlug = await generateUniqueSlug(
      parseResult.data.title,
      checkSlugExists,
      parseResult.data.projectId
    )

    return createSuccessResponse({ slug: uniqueSlug })
  } catch (error) {
    return createErrorResponse(
      getErrorCode(error),
      getErrorMessage(error),
      { 
        projectId: parseResult.data.projectId,
        title: parseResult.data.title
      },
      'admin-projects-slug-generate'
    )
  }
}
