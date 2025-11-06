"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProjectPreview } from "@/contexts/project-preview-context"

export function MobileProfessionalsButton() {
  const [showModal, setShowModal] = useState(false)
  const { projectProfessionals } = useProjectPreview()

  if (!projectProfessionals || projectProfessionals.length === 0) {
    return null
  }

  return (
    <>
      {/* Mobile sticky button */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 lg:hidden">
        <Button
          onClick={() => setShowModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white rounded-full py-4 px-8 font-medium shadow-lg text-base"
        >
          Show professionals
        </Button>
      </div>

      {/* Professionals modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-lg font-semibold">Professionals who built it</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {projectProfessionals.map((professional) => {
              const professionalHref = professional.companySlug ? `/professionals/${professional.companySlug}` : null

              const content = (
                <>
                  {professional.companyLogo ? (
                    <img
                      src={professional.companyLogo}
                      alt={professional.companyName || 'Company logo'}
                      className="w-12 h-12 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-surface flex items-center justify-center text-xs text-muted-foreground">
                      Logo
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {professional.companyName}
                    </p>
                    <p className="text-xs text-text-secondary">{professional.serviceCategory}</p>
                  </div>
                </>
              )

              return professionalHref ? (
                <Link
                  key={professional.id}
                  href={professionalHref}
                  className="flex items-start gap-3 py-2 hover:bg-surface -mx-2 px-2 rounded-lg transition-colors"
                  onClick={() => setShowModal(false)}
                >
                  {content}
                </Link>
              ) : (
                <div key={professional.id} className="flex items-start gap-3 py-2">
                  {content}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
