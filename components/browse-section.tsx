"use client"

import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"

// Types for the three browse paths
export interface BrowseCard {
  id: string
  title: string
  href: string
  imageUrl: string | null
  count?: string
}

interface BrowseSectionProps {
  projects: BrowseCard[]
  spaces: BrowseCard[]
  professionals: BrowseCard[]
}

function BrowseCarousel({ items, sectionTitle, viewAllHref, viewAllLabel }: {
  items: BrowseCard[]
  sectionTitle: string
  viewAllHref: string
  viewAllLabel: string
}) {
  return (
    <div>
      <div className="section-header">
        <h2 className="arco-section-title">{sectionTitle}</h2>
        <Link href={viewAllHref} className="view-all-link">
{viewAllLabel}
        </Link>
      </div>

      <div className="grid grid-cols-5 lg:grid-cols-5 max-lg:flex max-lg:overflow-x-auto max-lg:snap-x max-lg:snap-mandatory max-lg:scrollbar-hide" style={{ gap: 'var(--grid-gap)' }}>
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block flex-shrink-0 lg:w-auto max-lg:w-[30vw] max-md:w-[42vw] snap-start"
          >
            <div className="relative w-full overflow-hidden mb-2.5" style={{ aspectRatio: '2/3' }}>
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  className="object-cover transition-all duration-500 hover:scale-[1.04]"
                />
              ) : (
                <div className="w-full h-full bg-gray-200" />
              )}
            </div>
            <div className="flex flex-col gap-0.5 px-0.5">
              <span className="arco-card-title">{item.title}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function BrowseSection({ projects, spaces, professionals }: BrowseSectionProps) {
  const t = useTranslations("home")
  return (
    <section className="py-16 max-md:py-10 bg-white">
      <div className="wrap">

        <BrowseCarousel
          items={projects}
          sectionTitle={t("published_work")}
          viewAllHref="/projects"
          viewAllLabel={t("view_all_projects")}
        />

        <div className="my-16 max-md:my-10" />

        <BrowseCarousel
          items={spaces}
          sectionTitle={t("featured_spaces")}
          viewAllHref="/projects?filter=space"
          viewAllLabel={t("view_all_spaces")}
        />

        <div className="my-16 max-md:my-10" />

        <BrowseCarousel
          items={professionals}
          sectionTitle={t("credited_professionals")}
          viewAllHref="/professionals"
          viewAllLabel={t("view_all_professionals")}
        />

      </div>
    </section>
  )
}
