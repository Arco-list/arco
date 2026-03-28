import { redirect } from "next/navigation"

import { CompanyEditClient } from "@/components/company-edit/company-edit-client"
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getActiveCompanyId } from "@/lib/active-company"
import { isAdminUser } from "@/lib/auth-utils"
import type { Database } from "@/lib/supabase/types"
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_DOT_CLASS, type ProjectStatus } from "@/lib/project-status-config"
import { CONTRIBUTOR_STATUS_LABELS, CONTRIBUTOR_STATUS_DOT_CLASS, type ContributorStatus } from "@/lib/contributor-status-config"

export default async function CompanySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string; imported?: string; project_id?: string }>
}) {
  const { company_id: companyIdParam, imported, project_id: importedProjectId } = await searchParams
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw new Error(userError.message)
  }

  if (!user) {
    redirect("/login?redirectTo=/dashboard/company")
  }

  const companySelect = `
    id, slug, name, description, website, status, plan_tier, plan_expires_at,
    upgrade_eligible, logo_url, email, phone, domain, is_verified, address, city, country,
    services_offered, languages, certificates, primary_service_id, founded_year,
    team_size_min, team_size_max, hero_photo_url, hero_photo_project_id, owner_id,
    setup_completed
  `

  let company = null

  // 0. company_id param: from company switcher or admin override
  if (companyIdParam) {
    const serviceSupabase = createServiceRoleSupabaseClient()

    // Check if user has access to this company (owner, member, or professional)
    const [{ data: isOwner }, { data: isMember }, { data: isProfessional }] = await Promise.all([
      serviceSupabase.from("companies").select("id").eq("id", companyIdParam).eq("owner_id", user.id).maybeSingle(),
      serviceSupabase.from("company_members").select("id").eq("company_id", companyIdParam).eq("user_id", user.id).eq("status", "active").maybeSingle(),
      serviceSupabase.from("professionals").select("id").eq("company_id", companyIdParam).eq("user_id", user.id).maybeSingle(),
    ])

    // Also allow admins
    let isAdmin = false
    if (!isOwner && !isMember && !isProfessional) {
      const { data: profile } = await supabase.from("profiles").select("admin_role, user_types").eq("id", user.id).maybeSingle()
      isAdmin = !!(profile && isAdminUser(profile.user_types, profile.admin_role))
    }

    if (isOwner || isMember || isProfessional || isAdmin) {
      const { data: paramCompany } = await serviceSupabase
        .from("companies")
        .select(companySelect)
        .eq("id", companyIdParam)
        .maybeSingle()

      if (paramCompany) {
        company = paramCompany
      }
    }
  }

  // 1. Fallback: prefer owned company (oldest first)
  if (!company) {
    const { data: ownedCompany, error: companyError } = await supabase
      .from("companies")
      .select(companySelect)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (companyError) {
      throw new Error(companyError.message)
    }

    if (ownedCompany) {
      company = ownedCompany
    }
  }

  // 2. No owned company — check cookie for membership
  if (!company) {
    const activeId = await getActiveCompanyId()
    if (activeId) {
      const { data: activeCompany } = await supabase
        .from("companies")
        .select(companySelect)
        .eq("id", activeId)
        .maybeSingle()

      if (activeCompany) {
        const { data: isMember } = await supabase
          .from("company_members")
          .select("id")
          .eq("company_id", activeId)
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle()

        if (isMember) {
          company = activeCompany
        }
      }
    }
  }

  // 3. Fallback: first team membership (oldest first)
  if (!company) {
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (membership) {
      const { data: memberCompany } = await supabase
        .from("companies")
        .select(companySelect)
        .eq("id", membership.company_id)
        .single()

      if (memberCompany) {
        company = memberCompany
      }
    }
  }

  if (!company) {
    redirect("/create-company")
  }

  // Setup mode is persistent until the company completes setup and publishes
  const isSetupMode = !company.setup_completed

  const [{ data: socialLinks }, { data: allCategories }, { data: professional }, { data: projectLinks }, { data: pendingProjectLinks }] = await Promise.all([
    supabase
      .from("company_social_links")
      .select("id, platform, url")
      .eq("company_id", company.id)
      .order("platform"),
    supabase
      .from("categories")
      .select("id, name, slug, parent_id, sort_order, can_publish_projects")
      .eq("is_active", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name"),
    supabase
      .from("professionals")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", company.id)
      .maybeSingle(),
    supabase
      .from("project_professionals")
      .select("id, project_id, is_project_owner, status, cover_photo_id, projects!inner(id, slug, title, location, status, rejection_reason, project_type, address_city, project_type_category:categories!projects_project_type_category_id_fkey(name), project_photos(id, url, is_primary, order_index))")
      .eq("company_id", company.id)
      .limit(10),
    // Fetch projects this company is invited to (for setup mode go-live)
    isSetupMode
      ? supabase
          .from("project_professionals")
          .select("id, project_id, status, projects!inner(id, title, status)")
          .eq("company_id", company.id)
          .in("status", ["invited", "unlisted", "listed"])
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Build flat service list and grouped categories from DB hierarchy
  const cats = allCategories ?? []
  const serviceOptions = cats
    .map((item) => ({ id: item.id, name: item.name, slug: item.slug }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Group child categories under their parent (only parents that have children = service categories)
  const parentCats = cats.filter((c) => !c.parent_id).sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
  const serviceCategories = parentCats
    .map((parent) => {
      const children = cats
        .filter((c) => c.parent_id === parent.id)
        .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99) || a.name.localeCompare(b.name))
        .map((c) => ({ id: c.id, name: c.name, slug: c.slug }))
      return { name: parent.name, slug: parent.slug, services: children }
    })
    .filter((g) => g.services.length > 0)

  // Determine if company can publish projects based on its service categories
  const publishableCategoryIds = new Set(
    cats.filter((c) => c.can_publish_projects === true).map((c) => c.id),
  )
  const companyServiceIds = [
    ...(company.services_offered ?? []),
    ...(company.primary_service_id ? [company.primary_service_id] : []),
  ].filter(Boolean) as string[]
  const canPublishProjects = companyServiceIds.some((id) => publishableCategoryIds.has(id))

  // Transform project data
  const projects = (projectLinks ?? [])
    .map((link: any) => {
      const p = link.projects
      if (!p) return null
      const sortedPhotos = (p.project_photos ?? [])
        .sort((a: any, b: any) => {
          if (a.is_primary && !b.is_primary) return -1
          if (!a.is_primary && b.is_primary) return 1
          return (a.order_index ?? 0) - (b.order_index ?? 0)
        })
      const projectTypeLabel = p.project_type_category?.name ??
        (p.project_type && !/^[0-9a-f]{8}-/.test(p.project_type) ? p.project_type : "")
      const locationLabel = p.address_city || p.location || null
      const isProjectOwner = !!link.is_project_owner
      // Show project_professionals status for both owners and contributors
      // For draft/in_progress/rejected projects, show project-level status
      const projectStatus = p.status as ProjectStatus
      const ppStatus = link.status as ContributorStatus
      const useProjectStatus = ["draft", "in_progress", "rejected"].includes(projectStatus)
      const displayStatus = useProjectStatus ? projectStatus : ppStatus
      const statusLabel = useProjectStatus
        ? (PROJECT_STATUS_LABELS[projectStatus] ?? projectStatus)
        : (CONTRIBUTOR_STATUS_LABELS[ppStatus] ?? ppStatus)
      const statusDotClass = useProjectStatus
        ? (PROJECT_STATUS_DOT_CLASS[projectStatus] ?? "bg-muted-foreground")
        : (CONTRIBUTOR_STATUS_DOT_CLASS[ppStatus] ?? "bg-muted-foreground")
      // For contributors, prefer their custom cover_photo_id; for owners, use is_primary
      const contributorCoverPhoto = link.cover_photo_id
        ? sortedPhotos.find((ph: any) => ph.id === link.cover_photo_id)
        : null
      const primaryPhoto = contributorCoverPhoto ?? sortedPhotos.find((ph: any) => ph.is_primary) ?? sortedPhotos[0] ?? null
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        location: p.location,
        status: displayStatus,
        statusLabel,
        statusDotClass,
        subtitle: [projectTypeLabel, locationLabel].filter(Boolean).join(" · "),
        isOwner: isProjectOwner,
        coverImage: primaryPhoto?.url ?? null,
        coverPhotoId: primaryPhoto?.id ?? null,
        photos: sortedPhotos.map((ph: any) => ({ id: ph.id, url: ph.url, isPrimary: !!ph.is_primary })),
        projectProfessionalId: link.id as string,
        projectProfessionalStatus: link.status as string,
        rejectionReason: p.rejection_reason ?? null,
        rawProjectStatus: projectStatus,
      }
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  // Deduplicate by project id
  const uniqueProjects = Array.from(new Map(projects.map((p) => [p.id, p])).values())

  // Build pending projects for setup mode
  const pendingProjects = (pendingProjectLinks ?? [])
    .filter((link: any) => link.projects?.status === "published" || link.projects?.status === "completed")
    .map((link: any) => ({
      id: link.project_id as string,
      title: link.projects?.title as string,
      ppId: link.id as string,
      ppStatus: link.status as string,
    }))

  return (
    <CompanyEditClient
      company={company as CompanyRow}
      socialLinks={socialLinks ?? []}
      services={serviceOptions}
      serviceCategories={serviceCategories}
      professionalId={professional?.id ?? null}
      projects={uniqueProjects as any}
      heroPhotoUrl={company.hero_photo_url ?? null}
      heroPhotoProjectId={company.hero_photo_project_id ?? null}
      isSetupMode={isSetupMode}
      pendingProjects={pendingProjects}
      canPublishProjects={canPublishProjects}
      showImportedBanner={imported === "1"}
      importedProjectId={importedProjectId ?? null}
    />
  )
}

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"]
