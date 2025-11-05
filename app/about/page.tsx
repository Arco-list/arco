import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { AboutContent } from "@/components/about-content"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us - Arco",
  description: "Inspiring the world to build beautifully through the most inspiring portfolio of architectural achievements.",
}

type ProjectCarouselItem = {
  id: string
  title: string
  slug: string | null
  imageUrl: string | null
  location: string | null
}

async function getProjects(): Promise<ProjectCarouselItem[]> {
  const supabase = await createServerSupabaseClient()

  // Fetch projects directly from the materialized view to get style_preferences
  const { data, error } = await supabase
    .from("mv_project_summary")
    .select("id, title, slug, location, project_type, style_preferences, primary_photo_url, primary_photo_alt")
    .eq("status", "published")
    .not("primary_photo_url", "is", null)
    .not("slug", "is", null)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    logger.error("Failed to load projects for about page", { scope: "about" }, error)
    return []
  }

  // Fetch taxonomy labels for styles and types (from both tables)
  const [taxonomyResult, categoriesResult] = await Promise.all([
    supabase.from("project_taxonomy_options").select("id, name, slug"),
    supabase.from("categories").select("id, name, slug")
  ])

  const taxonomyMap = new Map<string, string>()

  // Add taxonomy options
  if (taxonomyResult.data) {
    taxonomyResult.data.forEach((item) => {
      if (item.id && item.name) {
        taxonomyMap.set(item.id, item.name)
        if (item.slug) taxonomyMap.set(item.slug, item.name)
        taxonomyMap.set(item.name, item.name)
      }
    })
  }

  // Add categories
  if (categoriesResult.data) {
    categoriesResult.data.forEach((item) => {
      if (item.id && item.name) {
        taxonomyMap.set(item.id, item.name)
        if (item.slug) taxonomyMap.set(item.slug, item.name)
        taxonomyMap.set(item.name, item.name)
      }
    })
  }

  return (data ?? [])
    .map((project) => {
      // Build project title from style, type, and location
      const style = project.style_preferences?.[0] || ""
      const subType = project.project_type || ""
      const location = project.location || "Location unavailable"
      const parts = []

      if (style) {
        const styleLabel = taxonomyMap.get(style) || style
        parts.push(styleLabel)
      }
      if (subType) {
        const subTypeLabel = taxonomyMap.get(subType) || subType
        parts.push(subTypeLabel)
      }
      parts.push(`in ${location}`)
      const projectTitle = parts.join(" ")

      return {
        id: project.id ?? "",
        title: projectTitle,
        slug: project.slug,
        imageUrl: project.primary_photo_url,
        location,
      }
    })
}

export default async function AboutPage() {
  const projects = await getProjects()

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <AboutContent projects={projects} />
      </main>
      <Footer />
    </div>
  )
}
