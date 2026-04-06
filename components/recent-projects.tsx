"use client"

import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"

export interface RecentProject {
  id: string
  title: string
  href: string
  imageUrl: string | null
  subtitle?: string
}

interface RecentProjectsProps {
  projects: RecentProject[]
}

function Card({ project, className }: { project: RecentProject; className?: string }) {
  return (
    <Link href={project.href} className={`discover-card ${className ?? ""}`}>
      <div className="discover-card-image-wrap">
        <div className="discover-card-image-layer">
          {project.imageUrl ? (
            <img src={project.imageUrl} alt={project.title} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#f0f0ee" }} />
          )}
        </div>
      </div>
      <h3 className="discover-card-title">{project.title}</h3>
          </Link>
  )
}

export function RecentProjects({ projects }: RecentProjectsProps) {
  const t = useTranslations("home")
  if (projects.length === 0) return null

  const p = projects.slice(0, 6)

  return (
    <section className="py-16 max-md:py-10 bg-white">
      <div className="wrap">
        <div className="section-header">
          <h2 className="arco-section-title">{t("recent_projects")}</h2>
          <Link href="/projects" className="view-all-link">
            {t("view_all_projects")}
          </Link>
        </div>

        {/* Desktop / iPad: 1 big + 5 smaller in a row */}
        <div className="hidden md:block">
          <div className="editorial-row-1">
            {p[0] && (
              <Link href={p[0].href} className="ed-card ed-card-large">
                <div className="ed-img" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                  {p[0].imageUrl ? (
                    <Image src={p[0].imageUrl} alt={p[0].title} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                </div>
                <div className="ed-info">
                  <h3 className="ed-name">{p[0].title}</h3>
                                  </div>
              </Link>
            )}
            <div className="ed-stack">
              {p[1] && (
                <Link href={p[1].href} className="ed-card">
                  <div className="ed-img"><Image src={p[1].imageUrl!} alt={p[1].title} fill className="object-cover" /></div>
                  <div className="ed-info"><h3 className="ed-name">{p[1].title}</h3></div>
                </Link>
              )}
              {p[2] && (
                <Link href={p[2].href} className="ed-card">
                  <div className="ed-img"><Image src={p[2].imageUrl!} alt={p[2].title} fill className="object-cover" /></div>
                  <div className="ed-info"><h3 className="ed-name">{p[2].title}</h3></div>
                </Link>
              )}
            </div>
          </div>
          <div className="editorial-row-2">
            {p[3] && (
              <Link href={p[3].href} className="ed-card">
                <div className="ed-img"><Image src={p[3].imageUrl!} alt={p[3].title} fill className="object-cover" /></div>
                <div className="ed-info"><h3 className="ed-name">{p[3].title}</h3></div>
              </Link>
            )}
            {p[4] && (
              <Link href={p[4].href} className="ed-card">
                <div className="ed-img"><Image src={p[4].imageUrl!} alt={p[4].title} fill className="object-cover" /></div>
                <div className="ed-info"><h3 className="ed-name">{p[4].title}</h3></div>
              </Link>
            )}
            {p[5] && (
              <Link href={p[5].href} className="ed-card">
                <div className="ed-img"><Image src={p[5].imageUrl!} alt={p[5].title} fill className="object-cover" /></div>
                <div className="ed-info"><h3 className="ed-name">{p[5].title}</h3></div>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile: 1 big, 2 small, 2 small, 1 big */}
        <div className="md:hidden">
          {/* Big */}
          {p[0] && <div className="mb-3"><Card project={p[0]} /></div>}

          {/* 2 small */}
          {(p[1] || p[2]) && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {p[1] && <Card project={p[1]} />}
              {p[2] && <Card project={p[2]} />}
            </div>
          )}

          {/* 2 small */}
          {(p[3] || p[4]) && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {p[3] && <Card project={p[3]} />}
              {p[4] && <Card project={p[4]} />}
            </div>
          )}

          {/* Big */}
          {p[5] && <Card project={p[5]} />}
        </div>
      </div>
    </section>
  )
}
