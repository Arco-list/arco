import { createServiceRoleSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server"
import { isSuperAdminUser } from "@/lib/auth-utils"
import { AboutClient, type AboutHeroCover } from "./about-client"

// Revalidate every hour — cover selection is slow-moving, and the client
// randomises per page load on mount, so every visitor sees a different
// pick without needing a fresh server render.
export const revalidate = 3600

const FALLBACK_COVERS: AboutHeroCover[] = [
  {
    image: "/images/about-hero.jpg",
    title: "",
    projectSlug: null,
    companyName: null,
    companySlug: null,
  },
]

async function fetchAboutCovers(): Promise<AboutHeroCover[]> {
  try {
    const supabase = createServiceRoleSupabaseClient()
    const { data: covers } = await supabase
      .from("hero_covers")
      .select("slot, photo_url, project_id, projects(id, title, slug)")
      .eq("scope", "about")
      .order("slot", { ascending: true })

    const rows = (covers ?? []) as Array<{
      slot: number
      photo_url: string
      project_id: string
      projects: { id: string; title: string | null; slug: string | null } | null
    }>

    if (rows.length === 0) return FALLBACK_COVERS

    // Look up the owning company for each project so we can render the credit
    // line (Project title — Company name).
    const projectIds = rows.map((r) => r.project_id).filter(Boolean)
    const companyMap = new Map<string, { name: string; slug: string | null }>()

    if (projectIds.length > 0) {
      const { data: owners } = await supabase
        .from("project_professionals")
        .select("project_id, company:companies(name, slug)")
        .in("project_id", projectIds)
        .eq("is_project_owner", true)

      for (const row of (owners ?? []) as Array<{
        project_id: string
        company: { name: string | null; slug: string | null } | null
      }>) {
        if (row.company?.name) {
          companyMap.set(row.project_id, {
            name: row.company.name,
            slug: row.company.slug ?? null,
          })
        }
      }
    }

    return rows.map((r) => {
      const company = companyMap.get(r.project_id) ?? null
      return {
        image: r.photo_url,
        title: r.projects?.title ?? "",
        projectSlug: r.projects?.slug ?? null,
        companyName: company?.name ?? null,
        companySlug: company?.slug ?? null,
      }
    })
  } catch {
    return FALLBACK_COVERS
  }
}

async function fetchIsSuperAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { data: profile } = await supabase
      .from("profiles")
      .select("admin_role")
      .eq("id", user.id)
      .maybeSingle()
    return isSuperAdminUser(profile?.admin_role)
  } catch {
    return false
  }
}

export default async function AboutPage() {
  const [covers, isSuperAdmin] = await Promise.all([
    fetchAboutCovers(),
    fetchIsSuperAdmin(),
  ])
  return <AboutClient covers={covers} isSuperAdmin={isSuperAdmin} />
}
