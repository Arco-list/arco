"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { sanitizeImageUrl, IMAGE_SIZES } from "@/lib/image-security"

const FALLBACK_IMAGE = "/placeholder.svg?height=400&width=300"

export interface ProfessionalCategoryCard {
  id: string
  title: string
  href: string
  imageUrl: string | null
  countLabel?: string | null
}

interface ProfessionalCategoriesProps {
  categories: ProfessionalCategoryCard[]
}

export function ProfessionalCategories({ categories }: ProfessionalCategoriesProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -320, behavior: "smooth" })
    }
  }

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 320, behavior: "smooth" })
    }
  }

  if (categories.length === 0) {
    return null
  }

  return (
    <section className="py-10 px-4 md:px-8 bg-white">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h4 className="heading-4">Popular professional services</h4>
          <div className="flex items-center gap-2">
            <Link href="/professionals" className="body-small text-text-secondary hover:text-foreground transition-colors mr-2">
              View all
            </Link>
            <div className="hidden md:flex items-center gap-2">
              <Button variant="quaternary" size="quaternary" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollLeft}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="quaternary" size="quaternary" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollRight}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {categories.map((category) => (
            <Link
              key={category.id}
              href={category.href}
              className="group cursor-pointer flex-none w-80 sm:w-72 md:w-60 lg:w-64 xl:w-72"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3">
                <Image
                  src={sanitizeImageUrl(category.imageUrl, FALLBACK_IMAGE)}
                  alt={category.title}
                  width={300}
                  height={400}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
                <h2 className="heading-2 absolute top-4 left-4 text-white">{category.title}</h2>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
