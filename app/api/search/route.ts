import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const MAX_RESULTS = 3

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ projects: [], professionals: [] })
  }

  const supabase = await createServerSupabaseClient()
  const pattern = `%${q}%`

  // Search across multiple fields using or()
  const [projectsResult, professionalsResult] = await Promise.all([
    supabase
      .from("mv_project_summary")
      .select("id, title, slug, location, primary_photo_url, primary_category, description, building_type, project_type")
      .eq("status", "published")
      .or(`title.ilike.${pattern},location.ilike.${pattern},description.ilike.${pattern},primary_category.ilike.${pattern},building_type.ilike.${pattern},project_type.ilike.${pattern}`)
      .limit(MAX_RESULTS),
    supabase
      .from("mv_professional_summary")
      .select("company_id_full, company_name, company_slug, company_logo, company_city, company_state_region, primary_service_name, primary_service_name_nl, bio")
      .eq("company_status", "listed")
      .or(`company_name.ilike.${pattern},company_city.ilike.${pattern},company_state_region.ilike.${pattern},primary_service_name.ilike.${pattern},primary_service_name_nl.ilike.${pattern},bio.ilike.${pattern}`)
      .limit(MAX_RESULTS * 2), // fetch extra to account for dedup
  ])

  // Deduplicate professionals by company_id
  const seenCompanies = new Set<string>()
  const professionals = (professionalsResult.data ?? [])
    .filter((p: any) => {
      if (seenCompanies.has(p.company_id_full)) return false
      seenCompanies.add(p.company_id_full)
      return true
    })
    .slice(0, MAX_RESULTS)

  return NextResponse.json({
    projects: (projectsResult.data ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
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
    })),
  })
}
