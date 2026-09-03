import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getProjectTranslation } from "@/lib/project-translations"

const MAX_RESULTS = 3

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  const locale = request.nextUrl.searchParams.get("locale")?.trim() || "en"
  if (!q || q.length < 2) {
    return NextResponse.json({ projects: [], professionals: [] })
  }

  const supabase = await createServerSupabaseClient()
  const pattern = `%${q}%`

  // Name/title hits FIRST, then the broad field match fills what's
  // left. A single or() with a bare limit let e.g. a project literally
  // titled "Hedendaags" get crowded out by the dozens of projects with
  // "hedendaags" in their DESCRIPTION — Postgres returns an arbitrary
  // subset when nothing orders the match.
  const projectFields = "id, title, translations, slug, location, primary_photo_url, primary_category, description, building_type, project_type"
  const profFields = "company_id_full, company_name, company_slug, company_logo, company_city, company_state_region, primary_service_name, primary_service_name_nl, primary_specialty_slug, company_status"
  const [projectTitleResult, projectBroadResult, profNameResult, profBroadResult] = await Promise.all([
    supabase
      .from("mv_project_summary")
      .select(projectFields)
      .eq("status", "published")
      .ilike("title", pattern)
      .limit(MAX_RESULTS),
    supabase
      .from("mv_project_summary")
      .select(projectFields)
      .eq("status", "published")
      .or(`location.ilike.${pattern},description.ilike.${pattern},primary_category.ilike.${pattern},building_type.ilike.${pattern},project_type.ilike.${pattern}`)
      .limit(MAX_RESULTS),
    supabase
      .from("mv_professional_summary")
      .select(profFields)
      .in("company_status", ["listed", "prospected"])
      .ilike("company_name", pattern)
      .limit(MAX_RESULTS * 2),
    supabase
      .from("mv_professional_summary")
      .select(profFields)
      .in("company_status", ["listed", "prospected"])
      .or(`company_city.ilike.${pattern},company_state_region.ilike.${pattern},primary_service_name.ilike.${pattern},primary_service_name_nl.ilike.${pattern}`)
      .limit(MAX_RESULTS * 2), // fetch extra to account for dedup
  ])

  const seenProjects = new Set<string>()
  const projectRows = [...(projectTitleResult.data ?? []), ...(projectBroadResult.data ?? [])]
    .filter((p: any) => {
      if (seenProjects.has(p.id)) return false
      seenProjects.add(p.id)
      return true
    })
    .slice(0, MAX_RESULTS)

  // Deduplicate professionals by company_id, name hits leading
  const seenCompanies = new Set<string>()
  const professionals = [...(profNameResult.data ?? []), ...(profBroadResult.data ?? [])]
    .filter((p: any) => {
      if (seenCompanies.has(p.company_id_full)) return false
      seenCompanies.add(p.company_id_full)
      return true
    })
    .slice(0, MAX_RESULTS)

  return NextResponse.json({
    projects: projectRows.map((p: any) => ({
      id: p.id,
      title:
        getProjectTranslation(
          { title: p.title, translations: p.translations },
          "title",
          locale,
        ) || p.title,
      slug: p.slug,
      location: p.location,
      photo: p.primary_photo_url,
      category: p.primary_category,
    })),
    professionals: professionals.map((p: any) => ({
      id: p.company_id_full,
      name: p.company_name,
      slug: p.company_slug,
      logo: p.company_logo,
      city: p.company_city,
      service: p.primary_service_name,
      // Real categories.slug — the icon must not depend on a localised
      // display name. Named serviceSlug because `slug` is the company's.
      serviceSlug: p.primary_specialty_slug,
    })),
  })
}
