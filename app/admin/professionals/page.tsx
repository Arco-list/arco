import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminProfessionalsCompaniesTable } from "@/components/admin-professionals-companies-table"
import { AdminProfessionalInvitesTable } from "@/components/admin-professional-invites-table"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database, Tables } from "@/lib/supabase/types"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

type CompanyRow = {
  id: string
  name: string
  location: string | null
  city: string | null
  country: string | null
  planTier: Database["public"]["Enums"]["company_plan_tier"]
  status: Database["public"]["Enums"]["company_status"]
  isVerified: boolean
  projectsLinked: number
  professionalCount: number
  averageRating: number | null
  totalReviews: number
  domain: string | null
  logoUrl: string | null
  website: string | null
  contactEmail: string | null
  servicesOffered: string[]
}

type ServiceOption = {
  id: string
  name: string
}

type InviteRow = {
  id: string
  invitedEmail: string
  invitedAt: string | null
  status: Database["public"]["Enums"]["professional_project_status"]
  projectTitle: string | null
  projectStatus: Database["public"]["Enums"]["project_status"] | null
  respondedAt: string | null
}

type AdminCompanyMetricsRow = {
  company_id: string
  professional_count: number
  projects_linked: number
  average_rating: number | null
  total_reviews: number
}

type ProjectInviteRow = Pick<Tables<"project_professionals">, "id" | "invited_email" | "invited_at" | "responded_at" | "status"> & {
  project: Pick<Tables<"projects">, "title" | "status"> | null
}

async function loadAdminProfessionalsData() {
  const supabase = await createServerSupabaseClient()

  const [companiesQuery, metricsQuery, invitesQuery, servicesQuery] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, name, status, plan_tier, city, country, is_verified, domain, logo_url, website, email, services_offered"
      ),
    supabase
      .from("admin_company_professional_metrics")
      .select("company_id, professional_count, projects_linked, average_rating, total_reviews"),
    supabase
      .from("project_professionals")
      .select("id, invited_email, invited_at, responded_at, status, project:projects(title, status)")
      .is("professional_id", null),
    supabase.from("categories").select("id, name").eq("is_active", true).order("name", { ascending: true }),
  ])

  // Check for query errors
  if (companiesQuery.error) {
    logger.error("Failed to load companies", { table: "companies" }, companiesQuery.error)
    throw new Error("Failed to load companies data")
  }

  if (invitesQuery.error) {
    logger.error("Failed to load invites", { table: "project_professionals" }, invitesQuery.error)
    throw new Error("Failed to load invites data")
  }

  if (metricsQuery.error) {
    logger.error(
      "Failed to load company metrics",
      { view: "admin_company_professional_metrics" },
      metricsQuery.error
    )
    throw new Error("Failed to load company metrics")
  }

  if (servicesQuery.error) {
    logger.error("Failed to load services", { table: "categories" }, servicesQuery.error)
    throw new Error("Failed to load services data")
  }

  const companies = (companiesQuery.data ?? []).filter((company): company is Tables<"companies"> => Boolean(company?.id))

  const metrics = (metricsQuery.data ?? []).filter(
    (row): row is AdminCompanyMetricsRow => Boolean(row?.company_id)
  )

  const projectInvites = (invitesQuery.data ?? []).filter(
    (row): row is ProjectInviteRow => Boolean(row?.id)
  )

  const servicesOptions: ServiceOption[] = (servicesQuery.data ?? [])
    .filter((service): service is { id: string; name: string } => Boolean(service?.id && service?.name))
    .map((service) => ({ id: service.id, name: service.name }))

  const metricsByCompany = new Map<string, AdminCompanyMetricsRow>()
  metrics.forEach((row) => {
    metricsByCompany.set(row.company_id, {
      ...row,
      professional_count: typeof row.professional_count === "number" ? row.professional_count : 0,
      projects_linked: typeof row.projects_linked === "number" ? row.projects_linked : 0,
      total_reviews: typeof row.total_reviews === "number" ? row.total_reviews : 0,
      average_rating:
        typeof row.average_rating === "number"
          ? Number(Number(row.average_rating).toFixed(2))
          : null,
    })
  })

  const companiesRows: CompanyRow[] = companies.map((company) => {
    const metric = metricsByCompany.get(company.id)

    const projectsLinked = metric?.projects_linked ?? 0
    const professionalCount = metric?.professional_count ?? 0
    const averageRating = metric?.average_rating ?? null
    const totalReviews = metric?.total_reviews ?? 0

    const locationPieces = [company.city, company.country].filter(Boolean)
    const location = locationPieces.length > 0 ? locationPieces.join(", ") : null

    return {
      id: company.id,
      name: company.name,
      location,
      city: company.city ?? null,
      country: company.country ?? null,
      planTier: company.plan_tier,
      status: company.status,
      isVerified: Boolean(company.is_verified),
      projectsLinked,
      professionalCount,
      averageRating,
      totalReviews,
      domain: company.domain ?? null,
      logoUrl: company.logo_url ?? null,
      website: company.website ?? null,
      contactEmail: company.email ?? null,
      servicesOffered: Array.isArray(company.services_offered)
        ? company.services_offered.filter((value): value is string => typeof value === "string")
        : [],
    }
  })

  const inviteRows: InviteRow[] = projectInvites
    .map((row) => ({
      id: row.id,
      invitedEmail: row.invited_email,
      invitedAt: row.invited_at,
      status: row.status,
      projectTitle: row.project?.title ?? null,
      projectStatus: row.project?.status ?? null,
      respondedAt: row.responded_at ?? null,
    }))
    .sort((a, b) => {
      const aDate = a.invitedAt ? new Date(a.invitedAt).getTime() : 0
      const bDate = b.invitedAt ? new Date(b.invitedAt).getTime() : 0
      return bDate - aDate
    })

  return { companiesRows, inviteRows, servicesOptions }
}

export default async function AdminProfessionalsPage() {
  const { companiesRows, inviteRows, servicesOptions } = await loadAdminProfessionalsData()

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/admin">Admin Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Professionals</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <Separator className="w-full" />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Tabs defaultValue="companies" className="flex h-full flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 px-1">
              <TabsList>
                <TabsTrigger value="companies">Companies</TabsTrigger>
                <TabsTrigger value="invites">Invites</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="companies" className="flex-1">
              <AdminProfessionalsCompaniesTable companies={companiesRows} serviceOptions={servicesOptions} />
            </TabsContent>
            <TabsContent value="invites" className="flex-1">
              <AdminProfessionalInvitesTable invites={inviteRows} />
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
