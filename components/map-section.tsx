"use client"

import { useState } from "react"

import { useProjectPreview } from "@/contexts/project-preview-context"

export function MapSection() {
  const { location } = useProjectPreview()
  const [mapFailed, setMapFailed] = useState(false)

  const hasSummary = Boolean(location.city || location.region || location.addressFormatted || location.summary)
  if (!hasSummary) {
    return null
  }

  const summaryLabel = [location.city, location.region].filter(Boolean).join(", ") || location.summary || ""
  const preciseLabel = location.canViewExact && location.addressFormatted ? location.addressFormatted : null
  const label = preciseLabel || summaryLabel
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const hasCoordinates =
    location.canViewExact &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number"

  let staticMapUrl: string | null = null
  if (mapsApiKey) {
    if (hasCoordinates) {
      const coords = `${location.latitude},${location.longitude}`
      const marker = encodeURIComponent(`color:0x111827|${coords}`)
      const zoom = location.shareExact ? 15 : 13
      staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${coords}&zoom=${zoom}&size=800x320&scale=2&markers=${marker}&key=${mapsApiKey}`
    } else if (summaryLabel) {
      const encodedSummary = encodeURIComponent(summaryLabel)
      const marker = encodeURIComponent(`color:0x4b5563|${summaryLabel}`)
      const zoom = location.shareExact ? 13 : 11
      staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedSummary}&zoom=${zoom}&size=800x320&scale=2&markers=${marker}&key=${mapsApiKey}`
    }
  }

  const shouldShowPlaceholder = !staticMapUrl || mapFailed

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-black">Explore the area</h2>
      {label && <p className="text-gray-600">{label}</p>}

      <div className="relative h-64 bg-gray-200 rounded-lg overflow-hidden">
        <img
          src={shouldShowPlaceholder ? "/placeholder.svg?height=300&width=800" : staticMapUrl}
          alt={`Map of ${label || "project location"}`}
          className="w-full h-full object-cover"
          onError={() => setMapFailed(true)}
        />
        {!location.canViewExact && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm">
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-sm text-center">
              <p className="text-sm text-gray-600">Exact address hidden until approved.</p>
            </div>
          </div>
        )}
      </div>

      {!mapsApiKey && (
        <p className="text-xs text-gray-500">
          Add a Google Maps API key to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to render the precise map preview.
        </p>
      )}

      {mapFailed && mapsApiKey && (
        <p className="text-xs text-red-600">
          Google Maps rejected the static map request. Ensure the Static Maps API is enabled for this API key and
          that the domain is authorised.
        </p>
      )}
    </div>
  )
}
