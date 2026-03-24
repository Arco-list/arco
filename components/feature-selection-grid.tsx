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
          <div key={index} className="h-28 rounded-lg border-2 border-dashed border-border animate-pulse" />
        ))}
      </div>
    )
  }

  if (features.length === 0) {
    return <p className="body-small text-text-secondary">No features available yet.</p>
  }

  return (
    <>
      {errorMessage && <p className="body-small text-amber-600 mb-4">{errorMessage}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {features.map((feature) => {
          const IconComponent = resolveIcon(feature)
          const isAlreadyAdded = selectedFeatures.includes(feature.id)
          const isInTempSelection = tempSelectedFeatures.includes(feature.id)

          return (
            <button
              key={feature.id}
              onClick={() => !isAlreadyAdded && onToggle(feature.id)}
              disabled={isAlreadyAdded || isSaving}
              className={`flex h-full flex-col rounded-lg border-2 p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-900/40 ${
                isAlreadyAdded
                  ? "border-border bg-surface opacity-50 cursor-not-allowed"
                  : isInTempSelection
                    ? "border-foreground bg-surface"
                    : "border-border bg-white hover:border-border"
              } ${isSaving ? "opacity-60" : ""}`}
            >
              <IconComponent aria-hidden className="mb-3 h-6 w-6 text-foreground" />
              <span className="body-small font-medium text-foreground">{feature.name}</span>
              {isAlreadyAdded && (
                <span className="mt-1 text-xs text-text-secondary">Added</span>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}
