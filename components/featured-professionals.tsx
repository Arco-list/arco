"use client"

import { Heart, ChevronLeft, ChevronRight, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRef } from "react"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import { featuredItemToProfessionalCard } from "@/lib/professionals/utils"

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
  const { savedProfessionalIds, saveProfessional, removeProfessional, mutatingProfessionalIds } = useSavedProfessionals()

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
          <h2 className="heading-4 font-semibold text-foreground">Featured professionals</h2>
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
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 mb-8"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {professionals.length === 0 ? (
            <div className="col-span-full text-center py-8 body-regular text-text-secondary">
              No featured professionals available.
            </div>
          ) : (
            professionals.map((professional) => {
              const isSaved = savedProfessionalIds.has(professional.id)
              const isMutating = mutatingProfessionalIds.has(professional.id)

              const handleSaveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault()
                e.stopPropagation()

                if (isMutating) return

                if (isSaved) {
                  removeProfessional(professional.id)
                } else {
                  saveProfessional(featuredItemToProfessionalCard(professional))
                }
              }

              return (
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
                      className="absolute top-3 right-3 p-1 text-text-secondary hover:text-red-500 transition-colors disabled:opacity-60"
                      onClick={handleSaveClick}
                      disabled={isMutating}
                      aria-label={isSaved ? "Unsave professional" : "Save professional"}
                      aria-pressed={isSaved}
                    >
                      <Heart className={`h-6 w-6 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <h3 className="heading-5 font-medium text-foreground group-hover:text-text-secondary transition-colors">
                      {professional.name}
                    </h3>
                    <p className="body-small text-text-secondary">{professional.location}</p>
                    <div className="flex items-center gap-2">
                      {professional.rating > 0 ? (
                        <>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="body-small font-medium text-foreground">{professional.rating.toFixed(1)}</span>
                          </div>
                          <span className="body-small text-text-secondary">({professional.reviews} reviews)</span>
                        </>
                      ) : (
                        <span className="body-small text-text-secondary">No reviews yet</span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
