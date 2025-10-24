"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Link from "next/link"
import { useProjectPreview } from "@/contexts/project-preview-context"

export function ProfessionalsSection() {
  const [showModal, setShowModal] = useState(false)
  const [isSticky, setIsSticky] = useState(true)
  const sectionRef = useRef<HTMLDivElement>(null)
  const { projectProfessionals, professionalsSummary } = useProjectPreview()

  // Sticky positioning logic - stop being sticky when similar projects section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // When similar projects section becomes visible, disable sticky
          setIsSticky(!entry.isIntersecting)
        })
      },
      { 
        threshold: 0.1,
        rootMargin: '0px 0px -10% 0px' // Trigger slightly before the section is fully visible
      }
    )

    // Find the similar projects section
    const similarProjectsSection = document.querySelector('[data-section="similar-projects"]')
    if (similarProjectsSection) {
      observer.observe(similarProjectsSection)
    }

    return () => observer.disconnect()
  }, [])

  if (!projectProfessionals || projectProfessionals.length === 0) {
    return null
  }

  const summaryCards = professionalsSummary && professionalsSummary.length > 0
    ? professionalsSummary
    : projectProfessionals.slice(0, 3)

  return (
    <>
      <div 
        ref={sectionRef}
        className="space-y-6"
      >
        <h4>Professionals who built it</h4>

        {summaryCards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {summaryCards.map((professional) => (
              <div key={professional.id}>
                <div className="flex flex-col space-y-3 hover:opacity-80 transition-opacity h-full">
                  {professional.companyLogo ? (
                    <img 
                      src={professional.companyLogo} 
                      alt={professional.companyName || 'Company'} 
                      className="w-full h-32 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 rounded-lg bg-gray-100"></div>
                  )}
                  <div className="space-y-1 flex-1">
                    <h6 className="text-gray-900">{professional.companyName}</h6>
                    <p className="text-xs leading-relaxed text-gray-600">{professional.serviceCategory}</p>
                  </div>
                  <Button 
                    variant="tertiary" 
                    size="tertiary" 
                    className="self-start"
                    onClick={() => professional.companyId && window.open(`/professionals/${professional.companyId}`, '_blank')}
                  >
                    Visit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="default" onClick={() => setShowModal(true)}>
          Show all professionals
        </Button>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-lg font-semibold">Professionals who built it</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {projectProfessionals.map((professional) => (
              <div key={professional.id} className="flex items-start gap-3 py-2">
                {professional.companyLogo ? (
                  <img 
                    src={professional.companyLogo} 
                    alt={professional.companyName || 'Company logo'} 
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                    Logo
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {professional.companyName}
                  </p>
                  <p className="text-xs text-gray-500">{professional.serviceCategory}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
