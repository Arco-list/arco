"use client"

import type {
  ProjectDetailsDropdownOption,
  ProjectDetailsFormState,
  ProjectDetailsSelectField,
} from "@/lib/project-details"

import { CustomDropdown } from "./custom-dropdown"

type ProjectBasicsFieldsProps = {
  formData: ProjectDetailsFormState
  validationErrors: Record<string, string>
  categoryOptions: ProjectDetailsDropdownOption[]
  projectTypeOptions: ProjectDetailsDropdownOption[]
  buildingTypeOptions: ProjectDetailsDropdownOption[]
  projectStyleOptions: ProjectDetailsDropdownOption[]
  openDropdown: ProjectDetailsSelectField | null
  setOpenDropdown: (field: ProjectDetailsSelectField | null) => void
  onDropdownSelect: (field: ProjectDetailsSelectField, value: string) => void
  isLoadingTaxonomy?: boolean
  taxonomyError?: string | null
  projectTaxonomyError?: string | null
}

export const ProjectBasicsFields = ({
  formData,
  validationErrors,
  categoryOptions,
  projectTypeOptions,
  buildingTypeOptions,
  projectStyleOptions,
  openDropdown,
  setOpenDropdown,
  onDropdownSelect,
  isLoadingTaxonomy = false,
  taxonomyError,
  projectTaxonomyError,
}: ProjectBasicsFieldsProps) => (
  <div className="space-y-8">
    {projectTaxonomyError && (
      <p className="text-sm text-amber-600">
        We could not load the latest taxonomy data, so fallback values are shown for now.
      </p>
    )}

    <div>
      <label className="block text-base font-medium text-foreground mb-3">
        What is the category of your project? <span className="text-red-500">*</span>
      </label>
      <CustomDropdown
        field="category"
        placeholder="Select a category"
        value={formData.category}
        options={categoryOptions}
        isLoading={isLoadingTaxonomy}
        onSelect={onDropdownSelect}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
      />
      <p className="text-sm text-text-secondary mt-2">Choose the main category that best describes your project</p>
      {taxonomyError && (
        <p className="text-sm text-amber-600 mt-2">
          We could not reach Supabase; showing fallback taxonomy options for now.
        </p>
      )}
      {validationErrors.category && <p className="text-sm text-red-600 mt-2">{validationErrors.category}</p>}
    </div>

    <div>
      <label className="block text-base font-medium text-foreground mb-3">
        Project type <span className="text-red-500">*</span>
      </label>
      <CustomDropdown
        field="projectType"
        placeholder="Select a project type"
        value={formData.projectType}
        options={projectTypeOptions}
        disabled={!formData.category || isLoadingTaxonomy}
        isLoading={isLoadingTaxonomy}
        onSelect={onDropdownSelect}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
      />
      <p className="text-sm text-text-secondary mt-2">
        Select the specific subtype within your chosen category (e.g., Villa, Kitchen)
      </p>
      {validationErrors.projectType && <p className="text-sm text-red-600 mt-2">{validationErrors.projectType}</p>}
    </div>

    <div>
      <label className="block text-base font-medium text-foreground mb-3">
        Building type <span className="text-red-500">*</span>
      </label>
      <CustomDropdown
        field="buildingType"
        placeholder="Select a building type"
        value={formData.buildingType}
        options={buildingTypeOptions}
        onSelect={onDropdownSelect}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
      />
      <p className="text-sm text-text-secondary mt-2">
        Indicate whether the project was a new build, renovation, or interior design scope
      </p>
      {validationErrors.buildingType && <p className="text-sm text-red-600 mt-2">{validationErrors.buildingType}</p>}
    </div>

    <div>
      <label className="block text-base font-medium text-foreground mb-3">
        Project style <span className="text-red-500">*</span>
      </label>
      <CustomDropdown
        field="projectStyle"
        placeholder="Select a project style"
        value={formData.projectStyle}
        options={projectStyleOptions}
        onSelect={onDropdownSelect}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
      />
      <p className="text-sm text-text-secondary mt-2">
        Choose the architectural or design style that best represents your project
      </p>
      {validationErrors.projectStyle && <p className="text-sm text-red-600 mt-2">{validationErrors.projectStyle}</p>}
    </div>
  </div>
)
