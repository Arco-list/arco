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
  const { professionalServices, professionalsSummary, canViewInviteDetails } = useProjectPreview()

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

  if (professionalServices.length === 0 && professionalsSummary.length === 0) {
    return null
  }

  const summaryCards =
    professionalsSummary.length > 0
      ? professionalsSummary
      : professionalServices
          .flatMap((service) =>
            service.invites.map((invite) => ({
              id: `${service.id}-${invite.id}`,
              name: invite.name ?? invite.email ?? "Pending invite",
              href: null,
              badge: null,
            })),
          )
          .slice(0, 3)

  return (
    <>
      <div 
        ref={sectionRef}
        className={`space-y-6 transition-all duration-300 ${
          isSticky ? 'lg:sticky lg:top-5 lg:z-10' : ''
        }`}
      >
        <h4 className="text-h4">Professionals who built it</h4>

        {summaryCards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {summaryCards.map((professional) => {
              const content = (
                <div className="flex flex-col space-y-3 hover:opacity-80 transition-opacity h-full">
                  <div className="w-full h-32 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                    Professional Image
                  </div>
                  <div className="space-y-1 flex-1">
                    <h6 className="text-h6 text-gray-900">{professional.name}</h6>
                    <p className="text-body-small text-gray-600">{professional.badge ?? "Architect"}</p>
                    <a href="#" className="text-body-small text-blue-600 hover:text-blue-800 underline-offset-2 hover:underline">
                      8 projects
                    </a>
                  </div>
                  <Button variant="tertiary" size="tertiary" className="self-start">
                    Visit
                  </Button>
                </div>
              )

              return professional.href ? (
                <Link key={professional.id} href={professional.href} className="block">
                  {content}
                </Link>
              ) : (
                <div key={professional.id}>{content}</div>
              )
            })}
          </div>
        )}

        <Button variant="secondary" onClick={() => setShowModal(true)}>
          Show all professionals
        </Button>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-lg font-semibold">Professionals who built it</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {professionalServices.map((service) => (
              <div key={service.id} className="space-y-2">
                <p className="font-medium text-gray-900">{service.name}</p>
                <div className="space-y-2">
                  {service.invites.length > 0 ? (
                    service.invites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between py-1 text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {invite.name ?? invite.email ?? "Pending invite"}
                          </span>
                          {invite.email && invite.email !== invite.name && (
                            <span className="text-xs text-gray-500">{invite.email}</span>
                          )}
                        </div>
                        {canViewInviteDetails && invite.status && (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                            {invite.status}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    canViewInviteDetails ? (
                      <p className="text-sm text-gray-500">No professionals invited yet.</p>
                    ) : null
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
