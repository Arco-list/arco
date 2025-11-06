"use client"

import {
  CURRENT_YEAR,
  type ProjectDetailsDropdownOption,
  type ProjectDetailsFormState,
  type ProjectDetailsSelectField,
  type ProjectDetailsTextField,
} from "@/lib/project-details"

import { CustomDropdown } from "./custom-dropdown"

type ProjectMetricsFieldsProps = {
  formData: ProjectDetailsFormState
  validationErrors: Record<string, string>
  sizeOptions: ProjectDetailsDropdownOption[]
  budgetOptions: ProjectDetailsDropdownOption[]
  openDropdown: ProjectDetailsSelectField | null
  setOpenDropdown: (field: ProjectDetailsSelectField | null) => void
  onDropdownSelect: (field: ProjectDetailsSelectField, value: string) => void
  onInputChange: (field: ProjectDetailsTextField, value: string) => void
  currentYear?: number
}

export const ProjectMetricsFields = ({
  formData,
  validationErrors,
  sizeOptions,
  budgetOptions,
  openDropdown,
  setOpenDropdown,
  onDropdownSelect,
  onInputChange,
  currentYear = CURRENT_YEAR,
}: ProjectMetricsFieldsProps) => (
  <div className="space-y-8">
    <div>
      <label className="block text-base font-medium text-foreground mb-3">
        Size <span className="text-red-500">*</span>
      </label>
      <CustomDropdown
        field="size"
        placeholder="Select size"
        value={formData.size}
        options={sizeOptions}
        onSelect={onDropdownSelect}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
      />
      <p className="text-sm text-text-secondary mt-2">Choose the overall size category of your project</p>
      {validationErrors.size && <p className="text-sm text-red-600 mt-2">{validationErrors.size}</p>}
    </div>

    <div>
      <label className="block text-base font-medium text-foreground mb-3">
        Budget <span className="text-red-500">*</span>
      </label>
      <CustomDropdown
        field="budget"
        placeholder="Select budget range"
        value={formData.budget}
        options={budgetOptions}
        onSelect={onDropdownSelect}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
      />
      <p className="text-sm text-text-secondary mt-2">Select the tier that best represents your total investment</p>
      {validationErrors.budget && <p className="text-sm text-red-600 mt-2">{validationErrors.budget}</p>}
    </div>

    <div>
      <label className="block text-base font-medium text-foreground mb-3">
        Year built <span className="text-red-500">*</span>
      </label>
      <input
        type="number"
        value={formData.yearBuilt}
        onChange={(event) => onInputChange("yearBuilt", event.target.value)}
        placeholder="2022"
        min="1800"
        max={currentYear}
        className="w-full px-4 py-3 border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-border transition-colors"
      />
      <p className="text-sm text-text-secondary mt-2">Enter the year when construction was completed</p>
      {validationErrors.yearBuilt && <p className="text-sm text-red-600 mt-2">{validationErrors.yearBuilt}</p>}
    </div>

    <div>
      <label className="block text-base font-medium text-foreground mb-3">
        Building year <span className="text-red-500">*</span>
      </label>
      <input
        type="number"
        value={formData.buildingYear}
        onChange={(event) => onInputChange("buildingYear", event.target.value)}
        placeholder="1930"
        min="1800"
        max={currentYear}
        className="w-full px-4 py-3 border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-border transition-colors"
      />
      <p className="text-sm text-text-secondary mt-2">Enter the original construction year if different from completion</p>
      {validationErrors.buildingYear && (
        <p className="text-sm text-red-600 mt-2">{validationErrors.buildingYear}</p>
      )}
    </div>
  </div>
)
