"use client"
import { createContext, useContext, useState, useEffect, useRef, Suspense, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"

interface FilterContextType {
  selectedTypes: string[]
  selectedStyles: string[]
  selectedLocation: string
  selectedFeatures: string[]
  setSelectedTypes: (types: string[]) => void
  setSelectedStyles: (styles: string[]) => void
  setSelectedLocation: (location: string) => void
  setSelectedFeatures: (features: string[]) => void
  clearAllFilters: () => void
  removeFilter: (type: string, value: string) => void
  hasActiveFilters: () => boolean
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

function FilterProviderInner({ children }: { children: ReactNode }) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const searchParams = useSearchParams()
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return

    const typeParam = searchParams.get("type")
    const styleParam = searchParams.get("style")
    const locationParam = searchParams.get("location")
    const featuresParam = searchParams.get("features")

    if (typeParam) {
      setSelectedTypes([typeParam])
    }
    if (styleParam) {
      setSelectedStyles([styleParam])
    }
    if (locationParam) {
      setSelectedLocation(locationParam)
    }
    if (featuresParam) {
      const features = featuresParam.split(",").map((f) => f.trim())
      setSelectedFeatures(features)
    }

    initializedRef.current = true
  }, [searchParams])

  const clearAllFilters = () => {
    setSelectedTypes([])
    setSelectedStyles([])
    setSelectedLocation("")
    setSelectedFeatures([])
  }

  const removeFilter = (type: string, value: string) => {
    switch (type) {
      case "type":
        setSelectedTypes((prev) => prev.filter((t) => t !== value))
        break
      case "style":
        setSelectedStyles((prev) => prev.filter((s) => s !== value))
        break
      case "location":
        setSelectedLocation("")
        break
      case "feature":
        setSelectedFeatures((prev) => prev.filter((f) => f !== value))
        break
    }
  }

  const hasActiveFilters = () => {
    return (
      selectedTypes.length > 0 || selectedStyles.length > 0 || selectedLocation !== "" || selectedFeatures.length > 0
    )
  }

  return (
    <FilterContext.Provider
      value={{
        selectedTypes,
        selectedStyles,
        selectedLocation,
        selectedFeatures,
        setSelectedTypes,
        setSelectedStyles,
        setSelectedLocation,
        setSelectedFeatures,
        clearAllFilters,
        removeFilter,
        hasActiveFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function FilterProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div>Loading filters...</div>}>
      <FilterProviderInner>{children}</FilterProviderInner>
    </Suspense>
  )
}

export function useFilters() {
  const context = useContext(FilterContext)
  if (context === undefined) {
    throw new Error("useFilters must be used within a FilterProvider")
  }
  return context
}
