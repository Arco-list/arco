"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useProjectPreview } from "@/contexts/project-preview-context"

export function ProfessionalsSidebar() {
  const { professionalServices } = useProjectPreview()

  if (professionalServices.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-6 sticky top-24 z-10">
        <h3 className="text-lg font-semibold">Professionals who built it</h3>

        <div className="space-y-4">
          {professionalServices.map((service) => (
            <div key={service.id} className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">{service.name}</p>
              {service.invites.length > 0 ? (
                <ul className="space-y-1 text-xs text-gray-600">
                  {service.invites.map((invite) => (
                    <li key={invite.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {invite.name ?? invite.email ?? "Pending invite"}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                        {invite.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">No invites yet</p>
              )}
            </div>
          ))}
        </div>

        <Button variant="outline" className="w-full bg-transparent">
          Show all professionals
        </Button>
      </Card>
    </div>
  )
}
