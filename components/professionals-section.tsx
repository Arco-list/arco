"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Link from "next/link"
import { useProjectPreview } from "@/contexts/project-preview-context"

export function ProfessionalsSection() {
  const [showModal, setShowModal] = useState(false)
  const { professionalServices, professionalsSummary } = useProjectPreview()

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
            })),
          )
          .slice(0, 3)

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-black">Professionals who built it</h2>

        {summaryCards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summaryCards.map((professional) => {
              const content = (
                <div className="space-y-2 block hover:opacity-80 transition-opacity">
                  <div className="w-full h-48 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                    {professional.badge ?? "Professional"}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{professional.name}</p>
                </div>
              )

              return professional.href ? (
                <Link key={professional.id} href={professional.href}>
                  {content}
                </Link>
              ) : (
                <div key={professional.id}>{content}</div>
              )
            })}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => setShowModal(true)}>
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
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                          {invite.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No professionals invited yet.</p>
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
