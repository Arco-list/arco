"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useProfessionalFilters } from "@/contexts/professional-filter-context"

/**
 * Keeps the SEO bottom of the professionals discover/hub pages in step
 * with the CLIENT filter state. Filtering syncs URLs shallowly (no server
 * navigation), so the server-rendered FAQ/prose would otherwise go stale —
 * root FAQ still showing after filtering to architects, architect prose
 * still showing after clearing the filter.
 *
 * The pages pass every variant server-rendered; this component shows the
 * one matching the live state:
 *   - no filters        → the root outro (marketplace FAQ + platform text)
 *   - exactly 1 service → that service hub's prose, when it has any
 *   - anything else     → nothing (a filtered view is ephemeral; the hub
 *                         directory above stays either way)
 *
 * Until mounted it renders `initialMatch`'s variant, which equals what the
 * server rendered for the URL — SEO content stays in the HTML and
 * hydration stays clean.
 */
export function DiscoverBottomSwitcher({ initialMatch, rootOutro, proseBySlug }: {
  initialMatch: string
  rootOutro?: ReactNode
  proseBySlug: Record<string, ReactNode>
}) {
  const { selectedCategories, selectedServices, selectedCities, selectedRegions, keyword, taxonomy } = useProfessionalFilters()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  let match = initialMatch
  if (mounted) {
    const nonService =
      selectedCategories.length > 0 ||
      selectedCities.length > 0 ||
      selectedRegions.length > 0 ||
      keyword.trim().length > 0
    if (nonService || selectedServices.length > 1) {
      match = "none"
    } else if (selectedServices.length === 0) {
      match = "root"
    } else {
      const svc = taxonomy.services.find((s) => s.id === selectedServices[0])
      match = svc?.slug ?? "none"
    }
  }

  if (match === "root") return <>{rootOutro ?? null}</>
  return <>{proseBySlug[match] ?? null}</>
}
