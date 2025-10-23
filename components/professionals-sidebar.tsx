"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProjectPreview } from "@/contexts/project-preview-context"

export function ProfessionalsSidebar() {
  const { projectProfessionals } = useProjectPreview()
  const [showModal, setShowModal] = useState(false)

  if (!projectProfessionals || projectProfessionals.length === 0) {
    return null
  }

  return (
    <>
      <div className="lg:sticky lg:top-8 lg:z-20">
        <Card className="p-6 space-y-6">
          <h3 className="text-lg font-semibold">Professionals who built it</h3>

          <div className="space-y-3">
            {projectProfessionals.map((professional) => (
              <div key={professional.id} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {professional.companyName}
                  </p>
                  <p className="text-xs text-gray-500">{professional.serviceCategory}</p>
                </div>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => professional.professionalId && window.open(`/professionals/${professional.professionalId}`, '_blank')}
                >
                  Visit
                </Button>
              </div>
            ))}
          </div>

          <Button variant="default" className="w-full" onClick={() => setShowModal(true)}>
            Show all professionals
          </Button>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-lg font-semibold">Professionals who built it</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {projectProfessionals.map((professional) => (
              <div key={professional.id} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {professional.companyName}
                  </p>
                  <p className="text-xs text-gray-500">{professional.serviceCategory}</p>
                </div>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => professional.professionalId && window.open(`/professionals/${professional.professionalId}`, '_blank')}
                >
                  Visit
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
