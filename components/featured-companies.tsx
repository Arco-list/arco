"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { ProfessionalCard } from "@/components/professional-card"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import { featuredItemToProfessionalCard } from "@/lib/professionals/utils"
import { textButtonStyles } from "@/lib/utils"

export type FeaturedCompany = {
  id: string
  name: string
  title: string
  location: string
  rating: number
  reviews: number
  image: string | null
  href: string
}

type FeaturedCompaniesProps = {
  companies: FeaturedCompany[]
}

export function FeaturedCompanies({ companies }: FeaturedCompaniesProps) {
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
    <section className="py-10 px-4 md:px-8">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Featured professionals</h2>
          <div className="hidden md:flex items-center gap-2">
            <Link href="/professionals" className={textButtonStyles}>
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
          {companies.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              No featured companies available.
            </div>
          ) : (
            companies.map((company) => {
              const professionalCard = featuredItemToProfessionalCard(company)
              const isSaved = savedProfessionalIds.has(company.id)
              const isMutating = mutatingProfessionalIds.has(company.id)

              return (
                <div
                  key={company.id}
                  className="flex-none w-80 sm:w-72 md:w-60 lg:w-64 xl:w-72"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <ProfessionalCard
                    professional={professionalCard}
                    isSaved={isSaved}
                    isMutating={isMutating}
                    onToggleSave={(prof) => {
                      if (isSaved) {
                        removeProfessional(company.id)
                      } else {
                        saveProfessional(prof)
                      }
                    }}
                  />
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
