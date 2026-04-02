import { Suspense } from "react"
import { ArchitectsClient } from "./architects-client"
import { fetchDiscoverProjects } from "@/lib/projects/queries"
import type { ProjectCard } from "@/components/landing/project-carousel"

export default async function ArchitectsPage() {
  const rawProjects = await fetchDiscoverProjects()

  // Deduplicate by firm (max 1 project per owner), then take 6
  const seen = new Set<string>()
  const carouselProjects: ProjectCard[] = rawProjects
    .map((project) => ({
      id: project.id ?? "",
      title: project.title ?? "",
      firm: project.professional_name ?? "",
      image: project.primary_photo_url ?? project.photos[0]?.url ?? "",
    }))
    .filter((p) => {
      if (!p.image || !p.firm) return false
      if (seen.has(p.firm)) return false
      seen.add(p.firm)
      return true
    })
    .slice(0, 6)

  return (
    <Suspense>
      <ArchitectsClient projects={carouselProjects} />
    </Suspense>
  )
}
