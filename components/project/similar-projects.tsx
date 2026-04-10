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
              <Link key={project.id} href={href} className="discover-card">
                <div className="discover-card-image-wrap">
                  {project.imageUrl ? (
                    <div className="discover-card-image-layer">
                      <Image
                        src={project.imageUrl}
                        alt={project.title}
                        width={600}
                        height={450}
                      />
                    </div>
                  ) : (
                    <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                  )}
                </div>

                <h3 className="discover-card-title">{project.title}</h3>
                {subtitle && <p className="discover-card-sub">{subtitle}</p>}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
