import Link from "next/link"
import Image from "next/image"
import { getTranslations } from "next-intl/server"

interface SimilarProject {
  id: string
  slug: string | null
  title: string
  location: string | null
  projectType: string | null
  imageUrl: string | null
}

interface SimilarProjectsProps {
  projects: SimilarProject[]
}

/**
 * "Similar projects" rail — projects of the same building type and country
 * by *different* studios. Sister to RelatedProjects (which only shows other
 * work from the same project owner). Together the two rails create both
 * intra-studio depth (RelatedProjects) and cross-studio breadth (this one),
 * which is the dual graph density Bar 1 (Discoverable) needs.
 *
 * Server component on purpose: this is purely link metadata, no interactivity,
 * so it can stream as static HTML and stay out of the client bundle.
 */
export async function SimilarProjects({ projects }: SimilarProjectsProps) {
  if (projects.length === 0) return null

  const t = await getTranslations("project_detail")

  return (
    <section className="related-projects">
      <div className="wrap">
        <div className="related-header">
          <h2 className="arco-section-title">{t("similar_projects")}</h2>
        </div>

        <div className="discover-grid">
          {projects.map((project) => {
            const href = project.slug ? `/projects/${project.slug}` : "#"
            const subtitle = [project.projectType, project.location].filter(Boolean).join(" · ")

            return (
              <Link key={project.id} href={href} className="related-card">
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
                {subtitle && <p className="related-subtitle">{subtitle}</p>}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
