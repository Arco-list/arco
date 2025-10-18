"use client"

import { Heart, ChevronLeft, ChevronRight, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRef } from "react"

export type FeaturedProfessional = {
  id: string
  name: string
  title: string
  location: string
  rating: number
  reviews: number
  image: string | null
  href: string
}

type FeaturedProfessionalsProps = {
  professionals: FeaturedProfessional[]
}

export function FeaturedProfessionals({ professionals }: FeaturedProfessionalsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -400, behavior: "smooth" })
    }
  }

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 400, behavior: "smooth" })
    }
  }

  return (
    <section className="py-16 px-4 md:px-8">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Featured professionals</h2>
          <div className="flex items-center gap-2">
            <Link href="/professionals" className="text-sm text-gray-600 hover:text-gray-900 transition-colors mr-2">
              View all
            </Link>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollLeft}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollRight}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 mb-8"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {professionals.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              No featured professionals available.
            </div>
          ) : (
            professionals.map((professional) => (
              <Link
                key={professional.id}
                href={professional.href}
                className="group cursor-pointer flex-none w-80 sm:w-72 md:w-60 lg:w-64 xl:w-72"
                style={{ scrollSnapAlign: "start" }}
              >
                <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
                  <img
                    src={professional.image || "/placeholder.svg?height=300&width=300"}
                    alt={professional.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <button
                    className="absolute top-3 right-3 p-1 text-gray-600 hover:text-red-500 transition-colors"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Heart className="h-6 w-6" />
                  </button>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-gray-900 group-hover:text-gray-600 transition-colors">
                    {professional.name}
                  </h3>
                  <p className="text-sm text-gray-600">{professional.location}</p>
                  <div className="flex items-center gap-2">
                    {professional.rating > 0 ? (
                      <>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium text-gray-900">{professional.rating.toFixed(1)}</span>
                        </div>
                        <span className="text-sm text-gray-500">({professional.reviews} reviews)</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">No reviews yet</span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
