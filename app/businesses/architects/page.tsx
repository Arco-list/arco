import { Suspense } from "react"
import { ArchitectsClient } from "./architects-client"
import { fetchDiscoverProjects } from "@/lib/projects/queries"
import type { ProjectCard } from "@/components/landing/project-carousel"

export default async function ArchitectsPage() {
  const rawProjects = await fetchDiscoverProjects()

  const carouselProjects: ProjectCard[] = rawProjects
    .map((project) => ({
      id: project.id ?? "",
      title: project.title ?? "",
      firm: project.professional_name ?? "",
      image: project.primary_photo_url ?? project.photos[0]?.url ?? "",
    }))
    .filter((p) => p.image !== "")

  return (
    <Suspense>
      <ArchitectsClient projects={carouselProjects} />
    </Suspense>
  )
}
