"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useProfessionalFilters } from "@/contexts/professional-filter-context"
import type { Tables } from "@/lib/supabase/types"

type CategoryRow = Tables<"categories">

export type ProfessionalFilterSection = {
  category: CategoryRow
  services: CategoryRow[]
}

interface ProfessionalsFiltersModalProps {
  isOpen: boolean
  onClose: () => void
  sections: ProfessionalFilterSection[]
}

export function ProfessionalsFiltersModal({ isOpen, onClose, sections }: ProfessionalsFiltersModalProps) {
  const {
    selectedCategories,
    selectedServices,
    selectedCity,
    setSelectedCategories,
    setSelectedServices,
    setSelectedCity,
    clearAllFilters,
    taxonomy,
    cities,
  } = useProfessionalFilters()

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setExpandedCategories({})
  }, [sections])

  if (!isOpen) return null

  const toggleCategorySelection = (id: string) => {
    if (selectedCategories.includes(id)) {
      setSelectedCategories(selectedCategories.filter((value) => value !== id))
    } else {
      setSelectedCategories([...selectedCategories, id])
    }
  }

  const toggleServiceSelection = (id: string) => {
    if (selectedServices.includes(id)) {
      setSelectedServices(selectedServices.filter((value) => value !== id))
    } else {
      setSelectedServices([...selectedServices, id])
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 px-4">
      <div className="relative h-[90vh] w-full max-w-md bg-white rounded-lg shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h6 className="font-semibold">Filters</h6>
          <button onClick={onClose} className="p-1 hover:bg-surface rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {taxonomy.isLoading ? (
            <div className="text-sm text-text-secondary">Loading filter options…</div>
          ) : sections.length === 0 ? (
            <div className="text-sm text-text-secondary">No categories available at the moment.</div>
          ) : (
            <>
              <div>
                <h6 className="mb-3">Service Categories</h6>
                <div className="space-y-4">
                  {sections.map((section) => (
                    <div key={section.category.id}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border text-black focus:ring-black"
                            checked={selectedCategories.includes(section.category.id ?? "")}
                            onChange={() => toggleCategorySelection(section.category.id ?? "")}
                          />
                          <span className="text-sm">{section.category.name}</span>
                        </label>

                        {section.services.length > 0 && (
                          <button
                            className="flex items-center gap-1 text-xs text-text-secondary hover:text-foreground"
                            onClick={() =>
                              setExpandedCategories((prev) => ({
                                ...prev,
                                [section.category.id ?? ""]: !prev[section.category.id ?? ""],
                              }))
                            }
                          >
                            {expandedCategories[section.category.id ?? ""] ? "Show less" : "View all"}
                            {expandedCategories[section.category.id ?? ""] ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>

                      {expandedCategories[section.category.id ?? ""] && (
                        <div className="ml-6 space-y-2">
                          {section.services.map((service) => (
                            <label key={service.id} className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border text-black focus:ring-black"
                                checked={selectedServices.includes(service.id ?? "")}
                                onChange={() => toggleServiceSelection(service.id ?? "")}
                              />
                              <span className="text-sm">{service.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h6 className="mb-3">City</h6>
                <select
                  id="modal-city"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={selectedCity || ""}
                  onChange={(e) => setSelectedCity(e.target.value || null)}
                >
                  <option value="">All cities</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border p-4 flex gap-3">
          <Button
            variant="quaternary"
            onClick={() => {
              clearAllFilters()
              setExpandedCategories({})
              onClose()
            }}
            className="flex-1"
          >
            Clear filters
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}