"use client"

import { useProjectPreview } from "@/contexts/project-preview-context"

export function MapSection() {
  const { location } = useProjectPreview()

  if (!location.city && !location.region) {
    return null
  }

  const label = [location.city, location.region].filter(Boolean).join(", ")

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-black">Explore the area</h2>
      <p className="text-gray-600">{label}</p>

      <div className="relative h-64 bg-gray-200 rounded-lg overflow-hidden">
        <img
          src="/placeholder.svg?height=300&width=800"
          alt={`Map of ${label || "project location"}`}
          className="w-full h-full object-cover"
        />
        {!location.shareExact && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-sm text-center">
              <p className="text-sm text-gray-600">Exact address hidden until approved.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
