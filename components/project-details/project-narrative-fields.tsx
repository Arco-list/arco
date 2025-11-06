"use client"

import type { Editor } from "@tiptap/react"

import {
  MAX_TITLE_LENGTH,
  type ProjectDetailsDescriptionCommand,
  type ProjectDetailsFormState,
  type ProjectDetailsTextField,
} from "@/lib/project-details"

import { ProjectDescriptionEditor } from "./project-description-editor"

type ProjectNarrativeFieldsProps = {
  formData: ProjectDetailsFormState
  validationErrors: Record<string, string>
  onInputChange: (field: ProjectDetailsTextField, value: string) => void
  editor: Editor | null
  onCommand: (command: ProjectDetailsDescriptionCommand) => void
  plainTextLength: number
  wordCount: number
  minDescriptionLength: number
  maxTitleLength?: number
}

export const ProjectNarrativeFields = ({
  formData,
  validationErrors,
  onInputChange,
  editor,
  onCommand,
  plainTextLength,
  wordCount,
  minDescriptionLength,
  maxTitleLength = MAX_TITLE_LENGTH,
}: ProjectNarrativeFieldsProps) => (
  <div className="space-y-8">
    <div>
      <label className="block text-base font-medium text-foreground mb-3">
        Project title <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={formData.projectTitle}
        onChange={(event) => onInputChange("projectTitle", event.target.value)}
        placeholder="Project title"
        className="w-full px-4 py-3 border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-border transition-colors"
      />
      <div className="flex items-center justify-between mt-2">
        <p className="text-sm text-text-secondary">Give your project a memorable and descriptive title</p>
        <span className={`text-sm ${formData.projectTitle.length > maxTitleLength ? "text-red-600" : "text-muted-foreground"}`}>
          {formData.projectTitle.length}/{maxTitleLength}
        </span>
      </div>
      {validationErrors.projectTitle && <p className="text-sm text-red-600 mt-2">{validationErrors.projectTitle}</p>}
    </div>

    <div>
      <label className="block text-base font-medium text-foreground mb-3">
        Project description <span className="text-red-500">*</span>
      </label>
      <ProjectDescriptionEditor
        editor={editor}
        onCommand={(command) => onCommand(command)}
        validationError={validationErrors.projectDescription}
        plainTextLength={plainTextLength}
        wordCount={wordCount}
        minDescriptionLength={minDescriptionLength}
      />
    </div>
  </div>
)
