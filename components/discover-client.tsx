"use client"

import { useState } from "react"
import { Link } from "@/i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useFilters } from "@/contexts/filter-context"
import { FilterBar, type SortOption, DEFAULT_PROJECT_SORT } from "@/components/filter-bar"
import { BreadcrumbSelect, type BreadcrumbSelectItem } from "@/components/project/breadcrumb-select"
import { ProjectsGrid } from "@/components/projects-grid"
import type { DiscoverProject } from "@/lib/projects/queries"
import { discoverHeading } from "@/lib/discover-heading"
import { pluralizeLabel } from "@/lib/pluralize-label"
import { PROVINCES, cityLabel } from "@/lib/provinces"
import { scopeLabel } from "@/lib/type-labels"

interface DiscoverClientProps {
  initialProjects: DiscoverProject[]
  initialSort?: SortOption
  /** Hub mode: server-provided H1 fallback for states the dynamic title
   *  doesn't cover (scope hubs) and h1-vs-h2 selection. The breadcrumb
   *  is always client-computed from filter state, so it stays correct
   *  across shallow URL transitions. */
  hubHeader?: {
    title: string
  }
  /** Server-rendered extras below the grid on hub pages (sibling-hub
   *  links, all-projects link). */
  hubFooter?: React.ReactNode
}

export function DiscoverClient({ initialProjects, initialSort = DEFAULT_PROJECT_SORT, hubHeader, hubFooter }: DiscoverClientProps) {
  const [sortBy, setSortBy] = useState<SortOption>(initialSort)
  const t = useTranslations("projects")
  const locale = useLocale()
  const nl = locale === "nl"
  const {
    selectedLocations, setSelectedLocations,
    selectedRegions, setSelectedRegions,
    selectedTypes, selectedBuildingTypes, selectedScopes, taxonomyLabelMap,
    regionCityMap, taxonomy,
  } = useFilters()

  // ── Location dropdowns for the breadcrumb ──────────────────────────
  // Same lists and accumulation semantics as the Locatie filter pill:
  // all provinces and cities, checkmarks for current selections, and
  // the filter write-back maps the resulting state to a hub URL when it
  // matches exactly one preset (single city -> /projects/amsterdam).
  const regionLabel = (r: string) => (PROVINCES[r] ? (nl ? PROVINCES[r].nl : PROVINCES[r].en) : r)
  // City choices narrow to the selected provinces' cities once a
  // province is picked (already-selected cities always stay listed so
  // they can be unchecked).
  const cityChoices = (
    selectedRegions.length > 0
      ? Array.from(new Set([...selectedRegions.flatMap((r) => regionCityMap[r] ?? []), ...selectedLocations]))
      : (taxonomy.cities ?? [])
  ).slice().sort((a, b) => a.localeCompare(b))
  // Provinces containing a selected city count as covered (derived) —
  // they show checked even without an explicit region chip.
  const derivedRegions = Array.from(
    new Set(
      selectedLocations
        .map((c) => Object.keys(regionCityMap).find((r) => (regionCityMap[r] ?? []).includes(c)))
        .filter((r): r is string => Boolean(r)),
    ),
  )
  const roleItems = (role: "provinces" | "cities"): BreadcrumbSelectItem[] =>
    role === "provinces"
      ? Object.keys(regionCityMap).map((r) => ({
          label: regionLabel(r),
          checked: selectedRegions.includes(r) || derivedRegions.includes(r),
          onToggle: () => {
            if (selectedRegions.includes(r)) {
              setSelectedRegions(selectedRegions.filter((x) => x !== r))
            } else if (derivedRegions.includes(r)) {
              // Derived check-off: drop this province's selected cities.
              setSelectedLocations(selectedLocations.filter((c) => !(regionCityMap[r] ?? []).includes(c)))
            } else {
              setSelectedRegions([...selectedRegions, r])
            }
          },
        }))
      : cityChoices.map((c) => ({
          label: cityLabel(c, locale),
          checked: selectedLocations.includes(c),
          onToggle: () => {
            if (selectedLocations.includes(c)) {
              setSelectedLocations(selectedLocations.filter((x) => x !== c))
              return
            }
            // Breadcrumb = drill-down: picking a city REPLACES the
            // province(s) containing it, so the chip bar shows just the
            // city (and a lone city can mint its hub URL). The Locatie
            // pill keeps accumulation semantics instead.
            setSelectedLocations([...selectedLocations, c])
            const remaining = selectedRegions.filter((r) => !(regionCityMap[r] ?? []).includes(c))
            if (remaining.length !== selectedRegions.length) setSelectedRegions(remaining)
          },
        }))
  const roleMuted = (role: "provinces" | "cities") =>
    role === "provinces" ? selectedRegions.length === 0 : selectedLocations.length === 0
  // JamesEdition-style progressive disclosure: the city level only
  // appears once a province is chosen (or a city is already selected).
  const showCityLevel = selectedRegions.length > 0 || selectedLocations.length > 0

  // Base-page geo crumb labels: placeholder when empty, the selection's
  // own name for one, a count beyond that. With only cities selected the
  // province level is DERIVED from them (display-only — no region chips):
  // one shared province shows its name, several show a count.
  // Label counts effective coverage — explicit regions plus provinces
  // derived from selected cities — matching the dropdown's checkmarks.
  const provinceLabelSource = Array.from(new Set([...selectedRegions, ...derivedRegions]))
  const provinceCrumbLabel =
    provinceLabelSource.length === 0
      ? (nl ? "Kies provincie" : "Choose province")
      : provinceLabelSource.length === 1
        ? regionLabel(provinceLabelSource[0])
        : `${provinceLabelSource.length} ${nl ? "provincies" : "provinces"}`
  const cityCrumbLabel =
    selectedLocations.length === 0
      ? (nl ? "Kies plaats" : "Choose city")
      : selectedLocations.length === 1
        ? cityLabel(selectedLocations[0], locale)
        : `${selectedLocations.length} ${nl ? "plaatsen" : "cities"}`

  // Non-geo leaf after the geo spine — keeps "Interieur" / "Villa's" in
  // the trail when a scope or type filter rides along with locations on
  // the base path (the hub crumb shows it server-side; this is the same
  // leaf for query-URL states). Named up to two, omitted beyond that.
  const typesResolvedForLeaf = selectedTypes.every((id) => taxonomyLabelMap.has(id))
  const leafLabels = [
    ...(typesResolvedForLeaf
      ? selectedTypes.map((id) => pluralizeLabel(taxonomyLabelMap.get(id) ?? id, 2, locale)).filter(Boolean)
      : []),
    ...selectedScopes.map((sc) => scopeLabel(sc, locale)),
  ]
  const leafCrumb = leafLabels.length > 0 && leafLabels.length <= 2 ? leafLabels.join(" & ") : null

  // Title mirrors the count line's grammar ("Villa's in Amsterdam &
  // Utrecht") so a hub link and the equivalent filter state render the
  // same page. With nothing selected the base page keeps its own title
  // and non-geo hubs (scope) fall back to their server-provided H1.
  const hasTitleFilters =
    selectedTypes.length + selectedBuildingTypes.length + selectedLocations.length + selectedRegions.length > 0
  // Until the taxonomy loads, selected category ids may still be raw URL
  // tokens — hold the server/fallback title rather than render them.
  const typesResolved = typesResolvedForLeaf
  const dynamicTitle = typesResolved && (hasTitleFilters || !hubHeader)
    ? discoverHeading({
        typeLabels: selectedTypes
          .map((id) => pluralizeLabel(taxonomyLabelMap.get(id) ?? id, 2, locale))
          .filter(Boolean),
        buildingTypes: selectedBuildingTypes,
        locations: selectedLocations,
        // A province refined by a selected city inside it stays out of
        // the title — "Villa's in 's-Hertogenbosch", not "... in
        // Noord-Brabant & 's-Hertogenbosch" (mirrors the query logic).
        regions: selectedRegions.filter(
          (r) => !(regionCityMap[r] ?? []).some((m) => selectedLocations.includes(m)),
        ),
        locale,
        defaultTypeLabel: t("title"),
        defaultLocationLabel: t("heading_default_location"),
      })
    : null

  return (
    <>
      {/* Filter bar — sticky directly below header */}
      <FilterBar sortBy={sortBy} onSortChange={setSortBy} />

      {/* Page title section — below filter bar */}
      <div className="discover-page-title">
        <div className="wrap">

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="discover-breadcrumb">
            <Link href="/projects" className="discover-breadcrumb-item">
              {t("title")}
            </Link>
            <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
            <span className="discover-breadcrumb-item">
              {t("breadcrumb_netherlands")}
            </span>
            <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
            <BreadcrumbSelect label={provinceCrumbLabel} items={roleItems("provinces")} muted={selectedRegions.length === 0} />
            {showCityLevel && (
              <>
                <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
                <BreadcrumbSelect label={cityCrumbLabel} items={roleItems("cities")} muted={selectedLocations.length === 0} />
              </>
            )}
            {leafCrumb && (
              <>
                <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
                <span className="discover-breadcrumb-item discover-breadcrumb-current">{leafCrumb}</span>
              </>
            )}
          </nav>

          {/* Page title — filter-driven; hub pages carry their
              search-targeted H1 as the no-divergence fallback */}
          {hubHeader ? (
            <h1 className="arco-section-title">{dynamicTitle ?? hubHeader.title}</h1>
          ) : (
            <h2 className="arco-section-title">{dynamicTitle ?? t("browse")}</h2>
          )}

        </div>
      </div>

      {/* Results */}
      <main>
        <ProjectsGrid initialProjects={initialProjects} sortBy={sortBy} onSortChange={setSortBy} />
        {hubFooter}
      </main>
    </>
  )
}
