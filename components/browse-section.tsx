"use client"

import Image from "next/image"
import Link from "next/link"

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

export function BrowseSection({ projects, spaces, professionals }: BrowseSectionProps) {
  return (
    <section className="py-16 bg-white">
      {/* UPDATED: Use .wrap class */}
      <div className="wrap">
        
        {/* Path 1: Browse by Project */}
        <div className="mb-16">
          {/* UPDATED: Use section-header pattern from styles page */}
          <div className="section-header">
            <h2 className="arco-section-title">Published work</h2>
            {/* UPDATED: Use view-all-link class */}
            <Link 
              href="/projects"
              className="hidden md:inline-flex view-all-link"
            >
              View all projects →
            </Link>
          </div>

          {/* Desktop: 5 cols, Tablet/Mobile: 280px carousel */}
          <div className="grid grid-cols-5 gap-5 lg:grid-cols-5 max-lg:flex max-lg:overflow-x-auto max-lg:snap-x max-lg:snap-mandatory max-lg:scrollbar-hide max-lg:gap-5">
            {projects.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="block flex-shrink-0 lg:w-auto max-lg:w-[280px] snap-start"
              >
                {/* Image - 2:3 portrait aspect */}
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

                {/* Label - UPDATED: Use CSS classes */}
                <div className="flex flex-col gap-0.5 px-0.5">
                  <span className="arco-card-title">{item.title}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Mobile View All - UPDATED: Use view-all-link class */}
          <div className="md:hidden mt-4">
            <Link 
              href="/projects"
              className="inline-flex view-all-link"
            >
              View all projects →
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="my-16" />

        {/* Path 2: Browse by Space */}
        <div className="mb-16">
          {/* UPDATED: Use section-header pattern */}
          <div className="section-header">
            <h2 className="arco-section-title">Featured spaces</h2>
            {/* UPDATED: Use view-all-link class */}
            <Link 
              href="/projects?filter=space"
              className="hidden md:inline-flex view-all-link"
            >
              View all spaces →
            </Link>
          </div>

          {/* Desktop: 5 cols, Tablet/Mobile: 280px carousel */}
          <div className="grid grid-cols-5 gap-5 lg:grid-cols-5 max-lg:flex max-lg:overflow-x-auto max-lg:snap-x max-lg:snap-mandatory max-lg:scrollbar-hide max-lg:gap-5">
            {spaces.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="block flex-shrink-0 lg:w-auto max-lg:w-[280px] snap-start"
              >
                {/* Image - 2:3 portrait aspect */}
                <div className="relative w-full overflow-hidden mb-2.5" style={{ aspectRatio: '2/3' }}>
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover transition-all duration-500 hover:scale-105"
                      style={{ filter: 'brightness(0.72)' }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                </div>

                {/* Label - UPDATED: Use arco-card-title class */}
                <span className="arco-card-title block px-0.5">{item.title}</span>
              </Link>
            ))}
          </div>

          {/* Mobile View All - UPDATED: Use view-all-link class */}
          <div className="md:hidden mt-4">
            <Link 
              href="/projects?filter=space"
              className="inline-flex view-all-link"
            >
              View all spaces →
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="my-16" />

        {/* Path 3: Browse by Professional */}
        <div>
          {/* UPDATED: Use section-header pattern */}
          <div className="section-header">
            <h2 className="arco-section-title">Credited professionals</h2>
            {/* UPDATED: Use view-all-link class */}
            <Link 
              href="/professionals"
              className="hidden md:inline-flex view-all-link"
            >
              View all professionals →
            </Link>
          </div>

          {/* Desktop: 5 cols, Tablet/Mobile: 280px carousel */}
          <div className="grid grid-cols-5 gap-5 lg:grid-cols-5 max-lg:flex max-lg:overflow-x-auto max-lg:snap-x max-lg:snap-mandatory max-lg:scrollbar-hide max-lg:gap-5">
            {professionals.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="block flex-shrink-0 lg:w-auto max-lg:w-[280px] snap-start"
              >
                {/* Image - 2:3 portrait aspect */}
                <div className="relative w-full overflow-hidden mb-2.5" style={{ aspectRatio: '2/3' }}>
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover transition-all duration-500 hover:scale-105"
                      style={{ filter: 'brightness(0.72)' }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                </div>

                {/* Label - UPDATED: Use arco-card-title class */}
                <span className="arco-card-title block px-0.5">{item.title}</span>
              </Link>
            ))}
          </div>

          {/* Mobile View All - UPDATED: Use view-all-link class */}
          <div className="md:hidden mt-4">
            <Link 
              href="/professionals"
              className="inline-flex view-all-link"
            >
              View all professionals →
            </Link>
          </div>
        </div>

      </div>

    </section>
  )
}
