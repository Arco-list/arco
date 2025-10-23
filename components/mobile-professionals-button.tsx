"use client"

import { useState } from "react"
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
      <div className="fixed bottom-4 left-4 right-4 z-50 lg:hidden">
        <Button 
          onClick={() => setShowModal(true)}
          className="w-full bg-red-600 hover:bg-red-700 text-white rounded-full py-3 px-6 font-medium shadow-lg"
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
