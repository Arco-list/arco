"use client"

import { Fragment, useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import { ChevronRight } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { ProfessionalCard as ProfessionalCardComponent } from "@/components/professional-card"
import { MapPreviewCard, ProfessionalsMap } from "@/components/professionals-map"
import { Footer } from "@/components/footer"
import { useProfessionalFilters, PROFESSIONAL_SORT_OPTIONS } from "@/contexts/professional-filter-context"
import { BreadcrumbSelect, type BreadcrumbSelectItem } from "@/components/project/breadcrumb-select"
import { PROVINCES, cityLabel } from "@/lib/provinces"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import type { ProfessionalCard } from "@/lib/professionals/types"
import { useProfessionalsForMap, useProfessionalsQuery } from "@/hooks/use-professionals-query"
import { SortLinks } from "@/components/sort-links"
import { pluralizeLabel } from "@/lib/pluralize-label"

// Map preview card: positioned via CSS order (3rd on desktop, 2nd on iPad, hidden on mobile)

export function ProfessionalsGrid({
  professionals = [],
  initialTotal,
  hubMode = false,
  preFooter,
}: {
  professionals?: ProfessionalCard[]
  initialTotal?: number
  /** Hub pages: render the page title as the crawlable h1. */
  hubMode?: boolean
  /** Rendered between the grid and the Footer (this component owns the
   *  Footer) — service hubs pass their editorial prose + FAQ here. */
  preFooter?: React.ReactNode
}) {
  const [showMap, setShowMap] = useState(false)
  const t = useTranslations("professionals")
  const gridLocale = useLocale()

  const {
    selectedCategories,
    selectedServices,
    selectedCities,
    setSelectedCities,
    selectedRegions,
    setSelectedRegions,
    regionCityMap,
    cities,
    keyword,
    taxonomyLabelMap,
    sortBy,
    setSortBy,
    clearAllFilters,
  } = useProfessionalFilters()

  const { savedProfessionalIds, saveProfessional, removeProfessional, mutatingProfessionalIds } =
    useSavedProfessionals()

  const {
    professionals: queryProfessionals,
    total,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    hasMore,
    loadMore,
  } = useProfessionalsQuery(professionals, initialTotal)

  // Sort is applied server-side in the search_professionals RPC so it stays
  // stable across "Load more". The grid just consumes the ordered list.
  const sortedProfessionals = queryProfessionals

  const displayCount = total > sortedProfessionals.length ? total : sortedProfessionals.length

  // ── Filter-driven header (same system as the projects discover) ─────
  const nl = gridLocale === "nl"
  const regionLabel = (r: string) => (PROVINCES[r] ? (nl ? PROVINCES[r].nl : PROVINCES[r].en) : r)
  const derivedRegions = Array.from(
    new Set(
      selectedCities
        .map((c) => Object.keys(regionCityMap).find((r) => (regionCityMap[r] ?? []).includes(c)))
        .filter((r): r is string => Boolean(r)),
    ),
  )
  const cityChoices = (
    selectedRegions.length > 0
      ? Array.from(new Set([...selectedRegions.flatMap((r) => regionCityMap[r] ?? []), ...selectedCities]))
      : cities
  ).slice().sort((a, b) => a.localeCompare(b))
  const crumbItems = (role: "provinces" | "cities"): BreadcrumbSelectItem[] =>
    role === "provinces"
      ? Object.keys(regionCityMap).map((r) => ({
          label: regionLabel(r),
          checked: selectedRegions.includes(r) || derivedRegions.includes(r),
          onToggle: () => {
            if (selectedRegions.includes(r)) {
              setSelectedRegions(selectedRegions.filter((x) => x !== r))
            } else if (derivedRegions.includes(r)) {
              setSelectedCities(selectedCities.filter((c) => !(regionCityMap[r] ?? []).includes(c)))
            } else {
              setSelectedRegions([...selectedRegions, r])
            }
          },
        }))
      : cityChoices.map((c) => ({
          label: cityLabel(c, gridLocale),
          checked: selectedCities.includes(c),
          onToggle: () => {
            if (selectedCities.includes(c)) {
              setSelectedCities(selectedCities.filter((x) => x !== c))
              return
            }
            // Breadcrumb = drill-down: a city REPLACES the province(s)
            // containing it (the Locatie pill accumulates instead).
            setSelectedCities([...selectedCities, c])
            const remaining = selectedRegions.filter((r) => !(regionCityMap[r] ?? []).includes(c))
            if (remaining.length !== selectedRegions.length) setSelectedRegions(remaining)
          },
        }))
  const showCityLevel = selectedRegions.length > 0 || selectedCities.length > 0
  const provinceLabelSource = Array.from(new Set([...selectedRegions, ...derivedRegions]))
  const provinceCrumbLabel =
    provinceLabelSource.length === 0
      ? (nl ? "Kies provincie" : "Choose province")
      : provinceLabelSource.length === 1
        ? regionLabel(provinceLabelSource[0])
        : `${provinceLabelSource.length} ${nl ? "provincies" : "provinces"}`
  const cityCrumbLabel =
    selectedCities.length === 0
      ? (nl ? "Kies plaats" : "Choose city")
      : selectedCities.length === 1
        ? cityLabel(selectedCities[0], gridLocale)
        : `${selectedCities.length} ${nl ? "plaatsen" : "cities"}`

  // Title: "{Types} in {Locations}", capped at two named items per axis.
  // Service GROUPS (categories) read as "{Group} professionals" in the
  // TITLE ("Design & Planning professionals in North Brabant") but stay
  // plain in the breadcrumb leaf.
  const typeIds = [...selectedCategories, ...selectedServices]
  const typesResolved = typeIds.every((id) => taxonomyLabelMap.has(id))
  const plainTypeLabels = typesResolved
    ? [
        ...selectedCategories.map((id) => taxonomyLabelMap.get(id) ?? id),
        ...selectedServices.map((id) => pluralizeLabel(taxonomyLabelMap.get(id) ?? id, 2, gridLocale)),
      ].filter(Boolean)
    : []
  const typeLabels = typesResolved
    ? [
        ...selectedCategories.map((id) => `${taxonomyLabelMap.get(id) ?? id} professionals`),
        ...selectedServices.map((id) => pluralizeLabel(taxonomyLabelMap.get(id) ?? id, 2, gridLocale)),
      ].filter(Boolean)
    : []
  const leafCrumb = plainTypeLabels.length > 0 && plainTypeLabels.length <= 2 ? plainTypeLabels.join(" & ") : null
  const joinAmp = (items: string[]) =>
    items.length === 1 ? items[0] : items.length === 2 ? `${items[0]} & ${items[1]}` : `${items.slice(0, -1).join(", ")} & ${items.at(-1)}`
  const titleRegions = selectedRegions.filter(
    (r) => !(regionCityMap[r] ?? []).some((m) => selectedCities.includes(m)),
  )
  const titleLocations = [...titleRegions.map(regionLabel), ...selectedCities.map((c) => cityLabel(c, gridLocale))]
  const typePart = typeLabels.length === 0 || typeLabels.length > 2 ? t("title") : joinAmp(typeLabels)
  const locationPart =
    titleLocations.length === 0
      ? t("heading_default_location")
      : titleLocations.length > 2
        ? `${titleLocations.length} ${nl ? "locaties" : "locations"}`
        : joinAmp(titleLocations)
  const pageTitle = typesResolved ? `${typePart} in ${locationPart}` : t("browse")

  // The H1 above describes the filter state; the count line stays minimal.
  const headingText = displayCount === 1 ? "professional" : "professionals"

  // Full result set for the map — the list is paginated, so previously the
  // map only saw whatever was already loaded (14 pros on first paint).
  // This hook fetches the complete filter-matched set when the map opens
  // and refetches whenever filters change while the map is open. Capped at
  // MAP_MAX_MARKERS; see the note in use-professionals-query.ts.
  const { mapProfessionals, isMapLoading } = useProfessionalsForMap(showMap)

  // Check if any professionals have map coordinates
  const hasMappable = sortedProfessionals.some(
    (p) => typeof p.latitude === "number" && typeof p.longitude === "number"
  )

  // When map is shown, replace everything below filter bar with full-width map
  if (showMap) {
    return (
      <ProfessionalsMap
        professionals={mapProfessionals}
        onClose={() => setShowMap(false)}
      />
    )
  }

  return (
    <>
      {/* Page title section — hidden when map is shown */}
      <div className="discover-page-title">
        <div className="wrap">
          <nav aria-label="Breadcrumb" className="discover-breadcrumb">
            <Link href="/professionals" className="discover-breadcrumb-item">
              {t("title")}
            </Link>
            <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
            <span className="discover-breadcrumb-item">
              {t("breadcrumb_netherlands")}
            </span>
            <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
            <BreadcrumbSelect label={provinceCrumbLabel} items={crumbItems("provinces")} muted={provinceLabelSource.length === 0} />
            {showCityLevel && (
              <>
                <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
                <BreadcrumbSelect label={cityCrumbLabel} items={crumbItems("cities")} muted={selectedCities.length === 0} />
              </>
            )}
            {leafCrumb && (
              <>
                <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
                <span className="discover-breadcrumb-item discover-breadcrumb-current">{leafCrumb}</span>
              </>
            )}
          </nav>
          {hubMode
            ? <h1 className="arco-section-title">{pageTitle}</h1>
            : <h2 className="arco-section-title">{pageTitle}</h2>}
        </div>
      </div>

      <div className="discover-results">
        <div className="wrap">

          {/* Result meta */}
          <div className="discover-results-meta" style={{ justifyContent: "space-between" }}>
            <p className="discover-results-count">
              <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>
                {(total > sortedProfessionals.length ? total : sortedProfessionals.length).toLocaleString()}
              </strong>{" "}
              {headingText}
            </p>
            <SortLinks options={PROFESSIONAL_SORT_OPTIONS} current={sortBy} onChange={setSortBy} namespace="professionals" />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                borderRadius: 4,
                padding: "12px 16px",
                marginBottom: 24,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span>{error}</span>
              <button
                onClick={refetch}
                style={{
                  fontSize: 13,
                  background: "none",
                  border: "1px solid #fecaca",
                  borderRadius: 4,
                  padding: "4px 10px",
                  cursor: "pointer",
                  color: "#dc2626",
                  flexShrink: 0,
                }}
              >
                {t("retry")}
              </button>
            </div>
          )}

          {/* Grid */}
          <div className="discover-grid">
            {sortedProfessionals.map((professional, index) => {
              const professionalId = professional.id ?? ""
              const isSaved = professionalId ? savedProfessionalIds.has(professionalId) : false
              const isMutating = professionalId ? mutatingProfessionalIds.has(professionalId) : false

              return (
                <Fragment key={`${professional.companyId}-${professional.professionalId}`}>
                  {/* Map card at position 1 — visible only on iPad (2nd card in 2-col row) */}
                  {index === 1 && hasMappable && (
                    <MapPreviewCard
                      className="map-card-tablet"
                      professionals={sortedProfessionals}
                      onClick={() => setShowMap(true)}
                    />
                  )}
                  {/* Map card at position 2 — visible only on desktop (3rd card in 3-col row) */}
                  {index === 2 && hasMappable && (
                    <MapPreviewCard
                      className="map-card-desktop"
                      professionals={sortedProfessionals}
                      onClick={() => setShowMap(true)}
                    />
                  )}
                  <ProfessionalCardComponent
                    professional={professional}
                    isSaved={isSaved}
                    isMutating={isMutating}
                    onToggleSave={(prof) => {
                      if (isSaved) {
                        removeProfessional(professionalId)
                      } else {
                        saveProfessional(prof)
                      }
                    }}
                  />
                </Fragment>
              )
            })}

            {/* Show map card at end if fewer items than positions */}
            {sortedProfessionals.length > 0 && sortedProfessionals.length <= 1 && hasMappable && (
              <MapPreviewCard
                professionals={sortedProfessionals}
                onClick={() => setShowMap(true)}
              />
            )}

            {isLoading && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  justifyContent: "center",
                  padding: "48px 0",
                }}
              >
                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{t("loading")}</p>
              </div>
            )}
          </div>

          {!isLoading && sortedProfessionals.length === 0 && !error && (
            <div className="empty-state">
              <h2 className="arco-section-title empty-state__title">{t("no_results")}</h2>
              <p className="arco-body-text empty-state__description">{t("no_results_description")}</p>
              <button type="button" onClick={clearAllFilters} className="btn-primary empty-state__action">
                {t("clear_filters")}
              </button>
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="discover-load-more">
              <button
                className="discover-load-more-btn"
                onClick={loadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? t("loading_more") : t("load_more")}
                <ChevronRight size={16} />
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Floating map button */}
      {hasMappable && sortedProfessionals.length > 0 && (
        <button
          className="floating-map-btn"
          onClick={() => setShowMap(true)}
          aria-label={t("show_on_map")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1C5.24 1 3 3.13 3 5.75C3 9.5 8 15 8 15C8 15 13 9.5 13 5.75C13 3.13 10.76 1 8 1Z" />
            <circle cx="8" cy="5.75" r="1.75" />
          </svg>
          {t("show_on_map")}
        </button>
      )}

      {preFooter}

      <Footer />
    </>
  )
}
