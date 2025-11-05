"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRef } from "react"
import { textButtonStyles } from "@/lib/utils"

const services = [
  {
    title: "Architecture",
    description: "Complete architectural design services",
    image: "/placeholder.svg?height=300&width=400",
    href: "/professionals?category=Architecture",
  },
  {
    title: "Interior Design",
    description: "Transform your interior spaces",
    image: "/placeholder.svg?height=300&width=400",
    href: "/professionals?category=Interior Design",
  },
  {
    title: "Landscape Design",
    description: "Beautiful outdoor spaces",
    image: "/placeholder.svg?height=300&width=400",
    href: "/professionals?category=Landscape Design",
  },
  {
    title: "Construction",
    description: "Professional construction services",
    image: "/placeholder.svg?height=300&width=400",
    href: "/professionals?category=Construction",
  },
  {
    title: "Engineering",
    description: "Structural and civil engineering",
    image: "/placeholder.svg?height=300&width=400",
    href: "/professionals?category=Engineering",
  },
]

export function PopularServices() {
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

  return (
    <section className="py-16 px-4 md:px-8">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-foreground">Popular professional services</h2>
          <div className="hidden md:flex items-center gap-2">
            <Link href="/professionals" className={textButtonStyles}>
              View all
            </Link>
            <div className="flex items-center gap-2">
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
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 mb-8 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4 md:overflow-visible"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {services.map((service, index) => (
            <Link
              key={index}
              href={service.href}
              className="group cursor-pointer flex-none w-64 md:w-auto"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3">
                <img
                  src={service.image || "/placeholder.svg"}
                  alt={service.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
                <h3 className="absolute bottom-4 left-4 text-white text-4xl" style={{ fontFamily: 'Figtree', fontWeight: 600, letterSpacing: '-2px' }}>{service.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
