"use client"

import type { LucideIcon } from "lucide-react"

import { FeatureCheckboxGrid } from "./feature-checkbox-grid"

type FeatureItem = {
  value: string
  label: string
  icon: LucideIcon
}

type ProjectFeaturesFieldsProps = {
  locationItems: FeatureItem[]
  materialItems: FeatureItem[]
  selectedLocationFeatures: string[]
  selectedMaterialFeatures: string[]
  onToggle: (field: "locationFeatures" | "materialFeatures", value: string) => void
  validationErrors: Record<string, string>
  projectTaxonomyError?: string | null
}

export const ProjectFeaturesFields = ({
  locationItems,
  materialItems,
  selectedLocationFeatures,
  selectedMaterialFeatures,
  onToggle,
  validationErrors,
  projectTaxonomyError,
}: ProjectFeaturesFieldsProps) => (
  <div className="space-y-12">
    {projectTaxonomyError && (
      <p className="body-small text-amber-600">
        Feature options are using fallback values because taxonomy data is temporarily unavailable.
      </p>
    )}

    <FeatureCheckboxGrid
      title="Location features"
      items={locationItems}
      selectedValues={selectedLocationFeatures}
      onChange={(value) => onToggle("locationFeatures", value)}
      error={validationErrors.locationFeatures}
    />

    <FeatureCheckboxGrid
      title="Material features"
      items={materialItems}
      selectedValues={selectedMaterialFeatures}
      onChange={(value) => onToggle("materialFeatures", value)}
      error={validationErrors.materialFeatures}
    />
  </div>
)
