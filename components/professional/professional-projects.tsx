import Link from "next/link"
import Image from "next/image"

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
}

export function ProfessionalProjects({ projects }: ProfessionalProjectsProps) {
  if (projects.length === 0) return null

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
          <h2 className="arco-section-title">Featured Projects</h2>
        </div>

        {hasImages ? (
          <div className="projects-grid">
            {displayProjects.map((project) => {
              const href = project.slug ? `/projects/${project.slug}` : '#'
              const subtitle = [project.projectType, project.location]
                .filter(Boolean)
                .join(' · ')

              return (
                <Link
                  key={project.id}
                  href={href}
                  className="project-card"
                >
                  <div className="project-image-container">
                    {project.image ? (
                      <Image
                        src={project.image}
                        alt={project.title}
                        width={600}
                        height={450}
                        className="project-image"
                      />
                    ) : (
                      <div className="project-image-placeholder" />
                    )}
                  </div>
                  <h3 className="project-title">{project.title}</h3>
                  {subtitle && <p className="project-subtitle">{subtitle}</p>}
                </Link>
              )
            })}
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
                  <h3 className="arco-h4">{project.title}</h3>
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
