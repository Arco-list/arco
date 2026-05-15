import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { ProfessionalProjectCard } from "./professional-project-card"

// Match the actual ProfessionalProjectSummary type
interface Project {
  id: string
  slug: string | null
  title: string
  location: string | null
  projectYear: number | null
  projectType: string | null
  image: string | null
}

interface ProfessionalProjectsProps {
  projects: Project[]
  /** Optional heading override — defaults to t("featured_projects"). Used by the photographer page to render "Photographed projects". */
  heading?: string
}

export async function ProfessionalProjects({ projects, heading }: ProfessionalProjectsProps) {
  if (projects.length === 0) return null

  const t = await getTranslations("professional_detail")
  const sectionHeading = heading ?? t("featured_projects")

  // Show up to 6 projects with images, or first 10 if no images
  const projectsWithImages = projects.filter(p => p.image)
  const displayProjects = projectsWithImages.length > 0
    ? projectsWithImages.slice(0, 6)
    : projects.slice(0, 10)

  const hasImages = projectsWithImages.length > 0

  return (
    <section id="projects" className="projects-section">
      <div className="wrap">
        <div className="projects-header">
          <h2 className="arco-section-title">{sectionHeading}</h2>
        </div>

        {hasImages ? (
          <div className="discover-grid">
            {displayProjects.map((project) => (
              <ProfessionalProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="projects-list">
            {displayProjects.map((project) => {
              const href = project.slug ? `/projects/${project.slug}` : '#'
              const subtitle = [project.projectType, project.location]
                .filter(Boolean)
                .join(' · ')

              return (
                <Link
                  key={project.id}
                  href={href}
                  className="project-list-item"
                >
                  <h3 className="arco-label">{project.title}</h3>
                  {subtitle && <p className="arco-card-subtitle">{subtitle}</p>}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
