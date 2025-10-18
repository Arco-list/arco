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
    selectedCountry,
    selectedState,
    selectedCity,
    setSelectedCategories,
    setSelectedServices,
    setSelectedCountry,
    setSelectedState,
    setSelectedCity,
    clearAllFilters,
    taxonomy,
    locationOptions,
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

  const availableStates = selectedCountry ? locationOptions.statesByCountry.get(selectedCountry) ?? [] : []
  const stateKey = selectedState ?? "__none__"
  const availableCities = selectedCountry
    ? locationOptions.citiesByCountryState.get(selectedCountry)?.get(stateKey) ?? []
    : []

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 px-4">
      <div className="relative h-[90vh] w-full max-w-md bg-white rounded-lg shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {taxonomy.isLoading ? (
            <div className="text-sm text-gray-500">Loading filter options…</div>
          ) : sections.length === 0 ? (
            <div className="text-sm text-gray-500">No categories available at the moment.</div>
          ) : (
            <>
              <div>
                <h3 className="text-base font-medium mb-3">Service Categories</h3>
                <div className="space-y-4">
                  {sections.map((section) => (
                    <div key={section.category.id}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={selectedCategories.includes(section.category.id ?? "")}
                            onChange={() => toggleCategorySelection(section.category.id ?? "")}
                          />
                          <h4 className="text-sm font-medium text-gray-700">{section.category.name}</h4>
                        </label>

                        {section.services.length > 0 && (
                          <button
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
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
                                className="h-4 w-4 rounded border-gray-300"
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
                <h3 className="text-base font-medium mb-3">Location</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="modal-country" className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2 block">
                      Country
                    </label>
                    <select
                      id="modal-country"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      value={selectedCountry || ""}
                      onChange={(e) => {
                        setSelectedCountry(e.target.value || null)
                        setSelectedState(null)
                        setSelectedCity(null)
                      }}
                    >
                      <option value="">All countries</option>
                      {Array.from(locationOptions.statesByCountry.keys()).map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCountry && (
                    <div>
                      <label htmlFor="modal-state" className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2 block">
                        State/Region
                      </label>
                      <select
                        id="modal-state"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                        value={selectedState || ""}
                        onChange={(e) => {
                          setSelectedState(e.target.value || null)
                          setSelectedCity(null)
                        }}
                      >
                        <option value="">All states/regions</option>
                        {availableStates.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedState && (
                    <div>
                      <label htmlFor="modal-city" className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2 block">
                        City
                      </label>
                      <select
                        id="modal-city"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                        value={selectedCity || ""}
                        onChange={(e) => setSelectedCity(e.target.value || null)}
                      >
                        <option value="">All cities</option>
                        {availableCities.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              clearAllFilters()
              setExpandedCategories({})
              onClose()
            }}
            className="flex-1 bg-transparent"
          >
            Clear filters
          </Button>
          <Button onClick={onClose} className="flex-1 bg-black text-white hover:bg-gray-800">
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}