import Link from "next/link"
import Image from "next/image"

interface RelatedProject {
  id: string
  slug: string | null
  title: string
  location: string | null
  year: number | null
  imageUrl: string | null
}

interface RelatedProjectsProps {
  projects: RelatedProject[]
  architectName: string
}

export function RelatedProjects({ projects, architectName }: RelatedProjectsProps) {
  if (projects.length === 0) return null

  return (
    <section className="related-projects">
      <div className="wrap">
        <div className="related-header">
          <h2 className="arco-section-title">More from {architectName}</h2>
        </div>

        <div className="related-grid">
          {projects.map((project) => {
            const href = project.slug ? `/projects/${project.slug}` : '#'
            const subtitle = [project.location, project.year]
              .filter(Boolean)
              .join(', ')

            return (
              <Link
                key={project.id}
                href={href}
                className="related-card"
              >
                <div className="related-image-container">
                  {project.imageUrl ? (
                    <Image
                      src={project.imageUrl}
                      alt={project.title}
                      width={600}
                      height={450}
                      className="related-image"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface" />
                  )}
                </div>
                <h3 className="related-title">{project.title}</h3>
                {subtitle && (
                  <p className="related-subtitle">{subtitle}</p>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
