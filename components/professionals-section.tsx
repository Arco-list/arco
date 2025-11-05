"use client"

import { useState, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Link from "next/link"
import { useProjectPreview } from "@/contexts/project-preview-context"

export function ProfessionalsSection() {
  const [showModal, setShowModal] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { projectProfessionals } = useProjectPreview()

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

  if (!projectProfessionals || projectProfessionals.length === 0) {
    return null
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-black">Professionals who built it</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowModal(true)}
              className="text-sm text-foreground hover:text-foreground font-medium"
            >
              View all
            </button>
            <div className="flex gap-2">
              <button
                onClick={scrollLeft}
                className="p-2 rounded-full border border-border hover:bg-surface transition-colors"
                aria-label="Previous professionals"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={scrollRight}
                className="p-2 rounded-full border border-border hover:bg-surface transition-colors"
                aria-label="Next professionals"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {projectProfessionals.map((professional) => {
            const professionalHref = professional.companySlug
              ? `/professionals/${professional.companySlug}`
              : '#'
            const projectsHref = `${professionalHref}#projects`

            return (
              <div
                key={professional.id}
                className="flex-none w-80"
                style={{ scrollSnapAlign: "start" }}
              >
                <Link href={professionalHref}>
                  {professional.companyLogo ? (
                    <img
                      src={professional.companyLogo}
                      alt={professional.companyName || 'Company'}
                      className="aspect-square w-full object-cover rounded-lg transition-transform duration-300 hover:scale-105 mb-4"
                    />
                  ) : (
                    <div className="aspect-square w-full rounded-lg bg-surface transition-transform duration-300 hover:scale-105 mb-4"></div>
                  )}
                </Link>
                <Link href={professionalHref}>
                  <p className="text-sm font-medium text-foreground hover:text-foreground mb-1">
                    {professional.companyName}
                  </p>
                </Link>
                <p className="text-xs text-text-secondary">
                  {professional.serviceCategory}
                  {' · '}
                  <Link
                    href={projectsHref}
                    className="underline hover:text-foreground"
                  >
                    {professional.projectsCount || 0} project{professional.projectsCount !== 1 ? 's' : ''}
                  </Link>
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-lg font-semibold">Professionals who built it</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {projectProfessionals.map((professional) => {
              const professionalHref = professional.companySlug
                ? `/professionals/${professional.companySlug}`
                : '#'
              const projectsHref = `${professionalHref}#projects`

              return (
                <div key={professional.id} className="flex items-start gap-3 py-2">
                  <Link href={professionalHref}>
                    {professional.companyLogo ? (
                      <img
                        src={professional.companyLogo}
                        alt={professional.companyName || 'Company logo'}
                        className="w-12 h-12 rounded object-cover hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-surface flex items-center justify-center text-xs text-muted-foreground">
                        Logo
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={professionalHref}>
                      <p className="text-sm font-medium text-foreground truncate hover:text-foreground">
                        {professional.companyName}
                      </p>
                    </Link>
                    <p className="text-xs text-text-secondary">
                      {professional.serviceCategory}
                      {' · '}
                      <Link
                        href={projectsHref}
                        className="underline hover:text-foreground"
                      >
                        {professional.projectsCount || 0} project{professional.projectsCount !== 1 ? 's' : ''}
                      </Link>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
