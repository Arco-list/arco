"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"
import { generateUniqueSlug, isValidSlug } from "@/lib/seo-utils"
import { getSiteUrl } from "@/lib/utils"
import { sendProjectStatusEmail } from "@/lib/email-service"
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

/**
 * Count of projects awaiting admin review (status = 'in_progress').
 * Powers the Projects badge in the admin header — same predicate the
 * /admin/projects table uses to surface its "Review (N)" CTA.
 */
export async function countProjectsToReview(): Promise<number> {
  const supabase = createServiceRoleSupabaseClient()
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress")
  return count ?? 0
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

  // Refresh materialized view to update search results and homepage hero
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
          { scope: "admin-projects-featured", projectId: parseResult.data }
        )
      }
    }
  )

  if (refreshError) {
    logger.error(
      "Failed to refresh project summary after featured status update",
      {
        scope: "admin-projects-featured",
        projectId: parseResult.data,
        featured: input.featured,
        error: getErrorMessage(refreshError)
      }
    )
    warnings.push("Featured status updated successfully, but search index refresh failed. It will be updated automatically soon.")
  }

  revalidatePath("/admin/projects")
  revalidatePath("/") // Revalidate homepage to show updated featured projects
  return createSuccessResponse(
    { projectId: parseResult.data, featured: input.featured },
    warnings
  )
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
    // Publishing no longer implies is_featured — the star is a curated
    // quality tier (AI featured decision at import, admin-overridable),
    // not an approval side effect.
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

  // When admin publishes a project, set owner to Featured and auto-enable auto_approve
  if (statusResult.data === "published") {
    // Set owner's project_professionals status to live_on_page (Featured)
    await supabase
      .from("project_professionals")
      .update({ status: "live_on_page" })
      .eq("project_id", idResult.data)
      .eq("is_project_owner", true)

    const { data: ownerPP } = await supabase
      .from("project_professionals")
      .select("company_id")
      .eq("project_id", idResult.data)
      .eq("is_project_owner", true)
      .maybeSingle()

    if (ownerPP?.company_id) {
      // Auto-enable auto_approve and mark setup completed
      await supabase
        .from("companies")
        .update({ auto_approve_projects: true, setup_completed: true } as never)
        .eq("id", ownerPP.company_id)

      // A company inherits the quality star when one of its featured
      // projects goes live: featured companies sort above the fold on
      // the professionals discover/hubs. One-way only — publishing an
      // average project never removes an earned star.
      const { data: publishedProject } = await supabase
        .from("projects")
        .select("is_featured")
        .eq("id", idResult.data)
        .maybeSingle()
      if (publishedProject?.is_featured) {
        await supabase
          .from("companies")
          .update({ is_featured: true })
          .eq("id", ownerPP.company_id)
      }

      // Sync company listed status based on active projects
      await syncCompanyListedStatus(ownerPP.company_id)

      logger.info("admin-projects", "Auto-approve enabled for company after project approval", {
        companyId: ownerPP.company_id,
        projectId: idResult.data,
      })
    }
  }

  // Sync listed status for all companies on this project
  const { data: projectCompanies } = await supabase
    .from("project_professionals")
    .select("company_id")
    .eq("project_id", idResult.data)
    .not("company_id", "is", null)
  const companyIds = Array.from(new Set((projectCompanies ?? []).map(pc => pc.company_id).filter(Boolean)))
  for (const cId of companyIds) {
    await syncCompanyListedStatus(cId as string)
  }

  // Invites credited while the project was a draft were skipped by the
  // dispatcher ("project not published") and nothing re-triggered them
  // on publish — they stranded at Not started. Fire them now.
  if (statusResult.data === "published") {
    try {
      const { dispatchPendingInvitesForProject } = await import("@/lib/invites/dispatch-professional-invite")
      const invites = await dispatchPendingInvitesForProject(supabase, idResult.data)
      if (invites.dispatched > 0) {
        logger.info("Dispatched pending invites on publish", {
          projectId: idResult.data,
          ...invites,
        })
      }
    } catch (err) {
      logger.error("Failed to dispatch pending invites on publish", {
        projectId: idResult.data,
      }, err instanceof Error ? err : undefined)
    }
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

  // Send emails based on status change
  if (statusResult.data === "published" || statusResult.data === "rejected") {
    try {
      // Get project details and owner email
      const { data: project } = await serviceClient
        .from('projects')
        .select(`
          title,
          slug,
          client_id,
          location,
          address_city,
          building_type,
          project_type,
          project_type_category_id,
          profiles!client_id(first_name, last_name)
        `)
        .eq('id', idResult.data)
        .single()

      // Fetch primary photo
      const { data: projectPhoto } = await serviceClient
        .from('project_photos')
        .select('url')
        .eq('project_id', idResult.data)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle()

      // Resolve project type label
      let projectTypeLabel: string | undefined
      const bt = (project as any)?.building_type
      const btIsUuid = bt && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bt)
      if (bt && !btIsUuid) {
        projectTypeLabel = bt.charAt(0).toUpperCase() + bt.slice(1).replace(/-/g, " ")
      }
      if (!projectTypeLabel) {
        const catId = btIsUuid ? bt : (project as any)?.project_type_category_id
        if (catId) {
          const { data: cat } = await serviceClient.from("categories").select("name").eq("id", catId).maybeSingle()
          if (cat?.name) projectTypeLabel = cat.name
        }
      }
      if (!projectTypeLabel && (project as any)?.project_type) {
        projectTypeLabel = (project as any).project_type
      }
      
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
      const baseUrl = getSiteUrl()

      if (statusResult.data === "rejected") {
        // Send rejection email to project owner
        if (ownerEmail) {
          try {
            await sendProjectStatusEmail(
              ownerEmail,
              'rejected',
              {
                firstname: ownerFirstName,
                project_title: project?.title || 'Your Project',
                project_name: project?.title || 'Your Project',
                project_image: projectPhoto?.url ?? undefined,
                project_location: (project as any)?.address_city ?? (project as any)?.location ?? undefined,
                project_type: projectTypeLabel,
                dashboard_link: `${baseUrl}/dashboard/listings`,
                rejection_reason: trimmedReason || 'No reason provided'
              }
            )
            
            logger.info("Project rejection email sent", {
              scope: "admin-projects",
              projectId: idResult.data,
              emailSent: true
            })
          } catch (emailError) {
            logger.error("Failed to send project rejection email", {
              scope: "admin-projects",
              projectId: idResult.data,
              error: getErrorMessage(emailError)
            })
            warnings.push("Project rejected but email notification failed.")
          }
        } else {
          logger.warn("No owner email found for project rejection notification", {
            scope: "admin-projects",
            projectId: idResult.data,
            clientId: project?.client_id
          })
        }
      } else if (statusResult.data === "published") {
        // Send project live email to owner
        if (ownerEmail) {
          try {
            await sendProjectStatusEmail(
              ownerEmail,
              'live',
              {
                firstname: ownerFirstName,
                project_title: project?.title || 'Your Project',
                project_name: project?.title || 'Your Project',
                project_image: projectPhoto?.url ?? undefined,
                project_location: (project as any)?.address_city ?? (project as any)?.location ?? undefined,
                project_type: projectTypeLabel,
                project_link: `${baseUrl}/projects/${(project as any)?.slug ?? idResult.data}`,
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

        // Professional invites for this publish are dispatched above
        // (dispatchPendingInvitesForProject), one per credit, with
        // per-credit dedup. The loop that used to live here re-sent a
        // plain invite to every credit on every publish — including
        // professionals who had already accepted — on top of that.
      }
    } catch (emailError) {
      logger.warn("Email sending failed during project status update", {
        scope: "admin-projects",
        projectId: idResult.data,
        status: statusResult.data,
        error: getErrorMessage(emailError)
      })
      warnings.push(`Project status updated but email notifications may have failed.`)
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

const ppStatusSchema = z.enum(["invited", "listed", "live_on_page", "unlisted", "rejected", "removed"])

/**
 * Recalculate a company's listed status based on its project_professionals.
 * - If the company has any listed/live_on_page PP records on published projects → set to "listed"
 * - If none → set to "unlisted"
 */
export async function syncCompanyListedStatus(companyId: string) {
  // Implementation lives in lib/companies/sync-listed-status.ts so
  // server-side callers outside the actions layer can use it directly.
  const { syncCompanyListedStatus: run } = await import("@/lib/companies/sync-listed-status")
  return run(companyId)
}
export async function updateProjectProfessionalStatusAction(input: {
  projectId: string
  companyId: string
  status: string
}) {
  const projectIdResult = projectIdSchema.safeParse(input.projectId)
  if (!projectIdResult.success) {
    return { success: false, error: "Invalid project ID" }
  }

  const companyIdResult = projectIdSchema.safeParse(input.companyId)
  if (!companyIdResult.success) {
    return { success: false, error: "Invalid company ID" }
  }

  const statusResult = ppStatusSchema.safeParse(input.status)
  if (!statusResult.success) {
    return { success: false, error: "Invalid status" }
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const { error: updateError } = await supabase
    .from("project_professionals")
    .update({ status: statusResult.data })
    .eq("project_id", projectIdResult.data)
    .eq("company_id", companyIdResult.data)

  if (updateError) {
    logger.error("admin-projects", "Failed to update project professional status", {
      projectId: projectIdResult.data,
      companyId: companyIdResult.data,
      status: statusResult.data,
      error: updateError.message,
    })
    return { success: false, error: updateError.message }
  }

  logger.info("admin-projects", "Project professional status updated", {
    projectId: projectIdResult.data,
    companyId: companyIdResult.data,
    status: statusResult.data,
  })

  // OWNER credits carry the project itself: unlisting the owner while
  // projects.status stays 'published' left the project live in discover
  // with a hidden owner (Wildenberg, Aug 25). Mirror the credit status
  // onto the project — the inverse of company listing, which publishes
  // owned projects. Contributor credits stay credit-only.
  const { data: ppRow } = await supabase
    .from("project_professionals")
    .select("is_project_owner")
    .eq("project_id", projectIdResult.data)
    .eq("company_id", companyIdResult.data)
    .maybeSingle()
  if (ppRow?.is_project_owner) {
    if (statusResult.data === "unlisted") {
      await supabase
        .from("projects")
        .update({ status: "draft" })
        .eq("id", projectIdResult.data)
        .eq("status", "published")
    } else if (statusResult.data === "live_on_page" || statusResult.data === "listed") {
      await supabase
        .from("projects")
        .update({ status: "published" })
        .eq("id", projectIdResult.data)
        .eq("status", "draft")
    }
  }

  // Sync company listed status based on active projects
  await syncCompanyListedStatus(companyIdResult.data)

  revalidatePath("/admin/projects")
  revalidatePath("/admin/companies")
  return { success: true }
}

// ---------------------------------------------------------------------------
// Toggle project featured status (homepage hero)
// ---------------------------------------------------------------------------

export async function toggleProjectFeaturedAction(input: {
  projectId: string
  isFeatured: boolean
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerActionSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()

  if (!isAdminUser(profile?.user_types)) {
    return { success: false, error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("projects")
    .update({ is_featured: input.isFeatured })
    .eq("id", input.projectId)

  if (error) {
    logger.db("update", "projects", "Failed to toggle featured", { projectId: input.projectId }, error)
    return { success: false, error: error.message }
  }

  // Refresh materialized view so homepage picks up the change
  try {
    const serviceClient = createServiceRoleSupabaseClient()
    await serviceClient.rpc("refresh_project_summary")
  } catch {}

  revalidatePath("/admin/projects")
  revalidatePath("/")
  return { success: true }
}
