"use client"

import { useEffect, useState } from "react"
import { ChevronDown, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4">
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Filters</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close filters">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-6 space-y-6">
          {taxonomy.isLoading ? (
            <div className="text-sm text-gray-500">Loading filter options…</div>
          ) : sections.length === 0 ? (
            <div className="text-sm text-gray-500">No categories available at the moment.</div>
          ) : (
            <div className="space-y-5">
              {sections.map((section) => (
                <div key={section.category.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`modal-category-${section.category.id}`}
                        checked={selectedCategories.includes(section.category.id ?? "")}
                        onCheckedChange={() => toggleCategorySelection(section.category.id ?? "")}
                      />
                      <Label htmlFor={`modal-category-${section.category.id}`} className="text-sm font-semibold text-gray-900">
                        {section.category.name}
                      </Label>
                    </div>

                    {section.services.length > 0 && (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                        onClick={() =>
                          setExpandedCategories((prev) => ({
                            ...prev,
                            [section.category.id ?? ""]: !prev[section.category.id ?? ""],
                          }))
                        }
                      >
                        {expandedCategories[section.category.id ?? ""] ? "Hide" : "View all"}
                        <ChevronDown
                          className={`h-3 w-3 transition-transform ${
                            expandedCategories[section.category.id ?? ""] ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {expandedCategories[section.category.id ?? ""] && (
                    <div className="pl-6 space-y-2">
                      {section.services.map((service) => (
                        <div className="flex items-center gap-2" key={service.id}>
                          <Checkbox
                            id={`modal-service-${service.id}`}
                            checked={selectedServices.includes(service.id ?? "")}
                            onCheckedChange={() => toggleServiceSelection(service.id ?? "")}
                          />
                          <Label htmlFor={`modal-service-${service.id}`} className="text-sm text-gray-600">
                            {service.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="mobile-country" className="text-xs text-gray-500 uppercase">
                Country
              </Label>
              <select
                id="mobile-country"
                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={selectedCountry ?? ""}
                onChange={(event) => setSelectedCountry(event.target.value || null)}
              >
                <option value="">All countries</option>
                {locationOptions.countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="mobile-state" className="text-xs text-gray-500 uppercase">
                State / Region
              </Label>
              <select
                id="mobile-state"
                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                value={selectedState ?? ""}
                onChange={(event) => setSelectedState(event.target.value || null)}
                disabled={!selectedCountry || availableStates.length === 0}
              >
                <option value="">All regions</option>
                {availableStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="mobile-city" className="text-xs text-gray-500 uppercase">
                City
              </Label>
              <select
                id="mobile-city"
                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                value={selectedCity ?? ""}
                onChange={(event) => setSelectedCity(event.target.value || null)}
                disabled={!selectedCountry || availableCities.length === 0}
              >
                <option value="">All cities</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

        <div className="px-4 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearAllFilters()
              setExpandedCategories({})
              onClose()
            }}
            className="text-sm"
          >
            Clear filter
          </Button>
          <Button
            size="sm"
            onClick={onClose}
            className="text-sm"
          >
            Filter
          </Button>
        </div>
      </div>
    </div>
  )
}
