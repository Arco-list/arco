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

type ProjectProfessionalRow = Tables<"project_professionals"> & {
  project: Pick<Tables<"projects">, "title" | "status"> | null
  professional: Pick<Tables<"professionals">, "company_id"> | null
}

type ProfessionalRow = Pick<Tables<"professionals">, "id" | "company_id">

type ProfessionalRatingRow = Pick<Tables<"professional_ratings">, "professional_id" | "overall_rating" | "total_reviews">

async function loadAdminProfessionalsData() {
  const supabase = await createServerSupabaseClient()

  const [companiesQuery, professionalsQuery, ratingsQuery, invitesQuery, servicesQuery] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, name, status, plan_tier, city, country, is_verified, domain, logo_url, website, email, services_offered"
      ),
    supabase.from("professionals").select("id, company_id"),
    supabase.from("professional_ratings").select("professional_id, overall_rating, total_reviews"),
    supabase
      .from("project_professionals")
      .select(
        "id, project_id, professional_id, invited_email, invited_at, responded_at, status, project:projects(title, status), professional:professionals(company_id)"
      ),
    supabase.from("categories").select("id, name").eq("is_active", true).order("name", { ascending: true }),
  ])

  const companies = (companiesQuery.data ?? []).filter((company): company is Tables<"companies"> => Boolean(company?.id))

  const professionals = (professionalsQuery.data ?? []).filter(
    (professional): professional is ProfessionalRow => Boolean(professional?.id)
  )

  const ratings = (ratingsQuery.data ?? []).filter((rating): rating is ProfessionalRatingRow => Boolean(rating?.professional_id))

  const projectProfessionals = (invitesQuery.data ?? []).filter(
    (row): row is ProjectProfessionalRow => Boolean(row?.id)
  )

  const servicesOptions: ServiceOption[] = (servicesQuery.data ?? [])
    .filter((service): service is { id: string; name: string } => Boolean(service?.id && service?.name))
    .map((service) => ({ id: service.id, name: service.name }))

  const professionalsByCompany = new Map<string, string[]>()
  professionals.forEach((professional) => {
    if (!professional.company_id) return
    const list = professionalsByCompany.get(professional.company_id) ?? []
    list.push(professional.id)
    professionalsByCompany.set(professional.company_id, list)
  })

  const ratingByProfessional = new Map<string, { rating: number; totalReviews: number }>()
  ratings.forEach((rating) => {
    ratingByProfessional.set(rating.professional_id, {
      rating: typeof rating.overall_rating === "number" ? Number(rating.overall_rating) : 0,
      totalReviews: typeof rating.total_reviews === "number" ? Number(rating.total_reviews) : 0,
    })
  })

  const projectIdsByProfessional = new Map<string, Set<string>>()
  projectProfessionals.forEach((row) => {
    if (!row.professional_id) return
    const projectId = row.project_id
    if (!projectId) return
    const existing = projectIdsByProfessional.get(row.professional_id) ?? new Set<string>()
    existing.add(projectId)
    projectIdsByProfessional.set(row.professional_id, existing)
  })

  const companiesRows: CompanyRow[] = companies.map((company) => {
    const companyProfessionalIds = professionalsByCompany.get(company.id) ?? []

    const aggregatedProjectIds = new Set<string>()
    let ratingSum = 0
    let ratingCount = 0
    let totalReviews = 0

    companyProfessionalIds.forEach((professionalId) => {
      const projectSet = projectIdsByProfessional.get(professionalId)
      if (projectSet) {
        projectSet.forEach((projectId) => aggregatedProjectIds.add(projectId))
      }

      const ratingInfo = ratingByProfessional.get(professionalId)
      if (ratingInfo && ratingInfo.rating > 0) {
        ratingSum += ratingInfo.rating
        ratingCount += 1
        totalReviews += ratingInfo.totalReviews
      }
    })

    const averageRating = ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(2)) : null

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
      projectsLinked: aggregatedProjectIds.size,
      professionalCount: companyProfessionalIds.length,
      averageRating,
      totalReviews,
      domain: company.domain ?? null,
      logoUrl: company.logo_url ?? null,
      website: company.website ?? null,
      contactEmail: company.email ?? null,
      servicesOffered: Array.isArray(company.services_offered)
        ? (company.services_offered.filter((value): value is string => typeof value === "string") ?? [])
        : [],
    }
  })

  const inviteRows: InviteRow[] = projectProfessionals
    .filter((row) => !row.professional_id)
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
