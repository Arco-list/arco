"use client"

import type React from "react"
import type { Editor } from "@tiptap/react"
import { EditorContent } from "@tiptap/react"

import type { ProjectDetailsDescriptionCommand } from "@/lib/project-details"

type ProjectDescriptionEditorProps = {
  editor: Editor | null
  onCommand: (command: ProjectDetailsDescriptionCommand) => void
  validationError?: string
  plainTextLength: number
  wordCount: number
  minDescriptionLength: number
  placeholder?: string
}

export const ProjectDescriptionEditor = ({
  editor,
  onCommand,
  validationError,
  plainTextLength,
  wordCount,
  minDescriptionLength,
  placeholder = "Describe the project, its scope, and unique details",
}: ProjectDescriptionEditorProps) => {
  const getFormattingButtonClass = (active: boolean) => {
    return `flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900 ${
      active ? "bg-gray-200 text-gray-900" : "text-gray-600 hover:bg-gray-100"
    } disabled:cursor-not-allowed disabled:opacity-40`
  }

  const handleCommandClick = (command: ProjectDetailsDescriptionCommand) => (event: React.MouseEvent) => {
    event.preventDefault()
    onCommand(command)
  }

  const isTooShort = plainTextLength > 0 && plainTextLength < minDescriptionLength

  return (
    <div
      className={`rounded-md border bg-white transition-colors focus-within:ring-2 ${
        validationError
          ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-500"
          : "border-gray-300 focus-within:border-transparent focus-within:ring-gray-900"
      }`}
    >
      {editor ? (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
            <button
              type="button"
              className={getFormattingButtonClass(editor.isActive("bold"))}
              aria-label="Bold"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleCommandClick("bold")}
            >
              B
            </button>
            <button
              type="button"
              className={getFormattingButtonClass(editor.isActive("italic"))}
              aria-label="Italic"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleCommandClick("italic")}
            >
              <span className="italic">I</span>
            </button>
            <button
              type="button"
              className={getFormattingButtonClass(editor.isActive("underline"))}
              aria-label="Underline"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleCommandClick("underline")}
            >
              <span className="underline">U</span>
            </button>
            <span className="mx-1 h-8 w-px bg-gray-200" aria-hidden="true" />
            <button
              type="button"
              className={getFormattingButtonClass(editor.isActive("bulletList"))}
              aria-label="Bulleted list"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleCommandClick("bulletList")}
            >
              •
            </button>
            <button
              type="button"
              className={getFormattingButtonClass(editor.isActive("orderedList"))}
              aria-label="Numbered list"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleCommandClick("orderedList")}
            >
              1.
            </button>
          </div>
          <div className="relative">
            <EditorContent
              editor={editor}
              aria-label="Project description editor"
              className="px-4 py-3 text-gray-900 focus:outline-none [&_.ProseMirror]:min-h-[180px] [&_.ProseMirror]:whitespace-pre-wrap [&_.ProseMirror]:break-words [&_.ProseMirror]:outline-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:text-base [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:space-y-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_li]:pl-1"
            />
            {plainTextLength === 0 && (
              <span className="pointer-events-none absolute left-4 top-3 text-sm text-gray-400">{placeholder}</span>
            )}
          </div>
        </>
      ) : (
        <div className="px-4 py-6 text-sm text-gray-500">Loading editor…</div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-4 pb-4 pt-2">
        <p className="text-sm text-gray-500">
          Provide a detailed description of your project, including key features and design elements
        </p>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{wordCount} words</span>
          <span className={isTooShort ? "text-red-600" : "text-gray-400"}>
            {plainTextLength}/{minDescriptionLength}+ characters
          </span>
        </div>
      </div>
      {validationError && <p className="px-4 pb-4 text-sm text-red-600">{validationError}</p>}
    </div>
  )
}
