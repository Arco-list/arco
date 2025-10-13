"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProjectPreview } from "@/contexts/project-preview-context"

export function MobileProfessionalsButton() {
  const [showModal, setShowModal] = useState(false)
  const projectPreview = useProjectPreview()
  
  // Memoize only the values we need to prevent unnecessary re-renders
  const { professionalServices, canViewInviteDetails } = useMemo(() => ({
    professionalServices: projectPreview.professionalServices,
    canViewInviteDetails: projectPreview.canViewInviteDetails,
  }), [projectPreview.professionalServices, projectPreview.canViewInviteDetails])

  // Only show if there are professionals
  if (professionalServices.length === 0) {
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
