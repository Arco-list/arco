"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"

import type { ProjectDetailsDropdownOption, ProjectDetailsSelectField } from "@/lib/project-details"

type CustomDropdownProps = {
  field: ProjectDetailsSelectField
  placeholder: string
  value: string
  options: ProjectDetailsDropdownOption[]
  onSelect: (field: ProjectDetailsSelectField, value: string) => void
  disabled?: boolean
  isLoading?: boolean
  openDropdown: ProjectDetailsSelectField | null
  setOpenDropdown: (field: ProjectDetailsSelectField | null) => void
}

export const CustomDropdown = ({
  field,
  placeholder,
  value,
  options,
  onSelect,
  disabled = false,
  isLoading = false,
  openDropdown,
  setOpenDropdown,
}: CustomDropdownProps) => {
  const isOpen = openDropdown === field
  const selectedOption = options.find((opt) => opt.value === value)
  const buttonLabel = selectedOption?.label ?? (isLoading ? "Loading options..." : placeholder)
  const isDisabled = disabled || isLoading
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (!isOpen && searchQuery !== "") {
      setSearchQuery("")
    }
  }, [isOpen, searchQuery])

  const filteredOptions = useMemo(() => {
    const term = searchQuery.trim().toLowerCase()
    if (!term) {
      return options
    }

    return options.filter((option) => option.label.toLowerCase().includes(term))
  }, [options, searchQuery])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (isDisabled) {
            return
          }
          setOpenDropdown(isOpen ? null : field)
        }}
        disabled={isDisabled}
        className={`w-full px-4 py-3 border border-border rounded-md bg-white text-left text-foreground focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors ${
          isDisabled ? "cursor-not-allowed opacity-60" : "hover:border-border"
        }`}
      >
        <span className={selectedOption ? "text-foreground" : "text-text-secondary"}>{buttonLabel}</span>
        <ChevronDown
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          } ${isDisabled ? "opacity-40" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-md shadow-lg">
          <div className="p-2 border-b border-border bg-surface">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search options"
              autoFocus
              className="w-full px-3 py-2 body-small border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div className="max-h-60 overflow-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 body-small text-text-secondary">
                {options.length === 0 && !searchQuery
                  ? isLoading
                    ? "Loading options..."
                    : "No options available"
                  : "No matches found"}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setOpenDropdown(null)
                    onSelect(field, option.value)
                  }}
                  className="w-full px-4 py-3 text-left text-foreground hover:bg-surface focus:bg-surface focus:outline-none transition-colors"
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
