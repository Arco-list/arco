"use client"

import type { LucideIcon } from "lucide-react"

type FeatureOption = {
  id: string
  name: string
  slug?: string | null
  iconKey?: string | null
  sortOrder?: number | null
}

type FeatureSelectionGridProps = {
  features: FeatureOption[]
  selectedFeatures: string[]
  tempSelectedFeatures: string[]
  projectTypeCategoryId: string | null
  isLoading: boolean
  isSaving: boolean
  onToggle: (featureId: string) => void
  resolveIcon: (feature: FeatureOption) => LucideIcon
  errorMessage?: string | null
}

export function FeatureSelectionGrid({
  features,
  selectedFeatures,
  tempSelectedFeatures,
  projectTypeCategoryId,
  isLoading,
  isSaving,
  onToggle,
  resolveIcon,
  errorMessage,
}: FeatureSelectionGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 rounded-lg border-2 border-dashed border-gray-200 animate-pulse" />
        ))}
      </div>
    )
  }

  if (features.length === 0) {
    return <p className="text-sm text-gray-500">No features available yet.</p>
  }

  return (
    <>
      {errorMessage && <p className="text-sm text-amber-600 mb-4">{errorMessage}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {features.map((feature) => {
          const IconComponent = resolveIcon(feature)
          const isAlreadyAdded = selectedFeatures.includes(feature.id)
          const isInTempSelection = tempSelectedFeatures.includes(feature.id)

          return (
            <button
              key={feature.id}
              onClick={() => !isAlreadyAdded && onToggle(feature.id)}
              disabled={isAlreadyAdded || isSaving}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                isAlreadyAdded
                  ? "border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed"
                  : isInTempSelection
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
              } ${isSaving ? "opacity-60" : ""}`}
            >
              <IconComponent className="w-6 h-6 text-gray-700 mb-2" />
              <p className="font-medium text-gray-900 text-sm">{feature.name}</p>
            </button>
          )
        })}
      </div>
    </>
  )
}
