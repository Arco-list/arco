"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"

import { ProfessionalCard as ProfessionalCardComponent } from "@/components/professional-card"
import { MapPreviewCard, ProfessionalsMap } from "@/components/professionals-map"
import { Footer } from "@/components/footer"
import { useProfessionalFilters, PROFESSIONAL_SORT_OPTIONS } from "@/contexts/professional-filter-context"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import type { ProfessionalCard } from "@/lib/professionals/types"
import { useProfessionalsQuery } from "@/hooks/use-professionals-query"
import { SortLinks } from "@/components/sort-links"

// Map preview card: positioned via CSS order (3rd on desktop, 2nd on iPad, hidden on mobile)

export function ProfessionalsGrid({ professionals = [] }: { professionals?: ProfessionalCard[] }) {
  const [showMap, setShowMap] = useState(false)
  const t = useTranslations("professionals")

  const {
    selectedCategories,
    selectedServices,
    selectedCities,
    keyword,
    taxonomyLabelMap,
    sortBy,
    setSortBy,
  } = useProfessionalFilters()

  const { savedProfessionalIds, saveProfessional, removeProfessional, mutatingProfessionalIds } =
    useSavedProfessionals()

  const {
    professionals: queryProfessionals,
    allProfessionals,
    total,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    hasMore,
    loadMore,
  } = useProfessionalsQuery(professionals)

  const sortedProfessionals = useMemo(() => {
    const next = [...queryProfessionals]
    switch (sortBy) {
      case "Most popular":
        // TODO: Replace with actual project views (last 7 days) when available
        return next.sort((a, b) => b.reviewCount - a.reviewCount)
      case "Most recent":
        return next.sort((a, b) => b.name.localeCompare(a.name))
      case "Best match":
      default:
        return next
    }
  }, [queryProfessionals, sortBy])

  const headingText = useMemo(() => {
    const locationLabel =
      selectedCities.length === 1
        ? selectedCities[0]
        : selectedCities.length === 2
          ? `${selectedCities[0]} & ${selectedCities[1]}`
          : selectedCities.length > 2
            ? `${selectedCities.slice(0, -1).join(", ")} & ${selectedCities.at(-1)}`
            : t("heading_default_location")

    if (selectedCategories.length > 0) {
      const labels = selectedCategories
        .map((id) => taxonomyLabelMap.get(id) ?? id)
        .filter(Boolean)
      const part =
        labels.length === 1
          ? labels[0]
          : labels.length === 2
            ? `${labels[0]} & ${labels[1]}`
            : `${labels.slice(0, -1).join(", ")} & ${labels.at(-1)}`
      return `${part} in ${locationLabel}`
    }
    if (selectedCities.length > 0) return t("heading_in", { location: locationLabel })
    return t("heading_in", { location: t("heading_default_location") })
  }, [selectedCategories, selectedCities, taxonomyLabelMap, t])

  // Client-side filtered professionals for instant map updates
  const mapProfessionals = useMemo(() => {
    const searchLower = keyword.trim().toLowerCase()
    return allProfessionals.filter((p) => {
      // Category filter: check if any selected category matches specialty_parent_ids
      if (selectedCategories.length > 0) {
        const parentIds = p.specialtyParentIds ?? []
        if (!selectedCategories.some((catId) => parentIds.includes(catId))) return false
      }
      // Service filter: check if any selected service matches specialty_ids
      if (selectedServices.length > 0) {
        const specIds = p.specialtyIds ?? []
        if (!selectedServices.some((svcId) => specIds.includes(svcId))) return false
      }
      // City filter
      if (selectedCities.length > 0) {
        const lowerCities = selectedCities.map((c) => c.toLowerCase().trim())
        if (!p.city || !lowerCities.includes(p.city)) return false
      }
      // Keyword filter
      if (searchLower.length > 0) {
        const haystack = `${p.name} ${p.profession} ${p.location} ${(p.specialties ?? []).join(" ")}`.toLowerCase()
        if (!haystack.includes(searchLower)) return false
      }
      return true
    })
  }, [allProfessionals, selectedCategories, selectedServices, selectedCities, keyword])

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
            <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
            <span className="discover-breadcrumb-item discover-breadcrumb-current">
              {t("breadcrumb_netherlands")}
            </span>
          </nav>
          <h2 className="arco-section-title">{t("browse")}</h2>
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
            <div style={{ textAlign: "center", padding: "64px 0" }}>
              <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>
                {t("no_results_filters")}
              </p>
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

      <Footer />
    </>
  )
}
