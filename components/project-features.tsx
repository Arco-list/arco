"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProjectPreview } from "@/contexts/project-preview-context"

export function ProjectFeatures() {
  const [showModal, setShowModal] = useState(false)
  const { featureGroups } = useProjectPreview()

  if (featureGroups.length === 0) {
    return null
  }

  const featuredList = featureGroups.flatMap((group) => group.items.slice(0, 2)).slice(0, 6)

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-black">Features</h2>

      {featuredList.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {featuredList.map((feature) => (
            <div key={feature.id} className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-gray-400" aria-hidden="true" />
              <span className="text-gray-900">{feature.label}</span>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => setShowModal(true)}>
        Show all features
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg font-semibold">Features</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {featureGroups.map((group) => (
              <div key={group.id}>
                <h3 className="text-sm font-medium text-gray-900 mb-3">{group.name}</h3>
                <div className="space-y-3">
                  {group.items.map((feature) => (
                    <div key={feature.id} className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-gray-400" aria-hidden="true" />
                      <span className="text-gray-900 underline">{feature.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
