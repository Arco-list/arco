"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import {
  addPhotographerToProject,
  removePhotographerFromProject,
  type PhotographerLookupInput,
} from "./photographer-actions"

interface PhotographerSpecCellProps {
  projectId: string
  /** Optional pre-fetched credit. Pass when the parent already has it; otherwise the component fetches it on mount. */
  initial?: { companyId: string; name: string } | null
}

type GooglePrediction = {
  placeId: string
  name: string
  city: string | null
}

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

export function PhotographerSpecCell({ projectId, initial }: PhotographerSpecCellProps) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const t = useTranslations("project_edit.photographer")
  const tBadge = useTranslations("project_edit")
  const [photographer, setPhotographer] = useState<{ companyId: string; name: string } | null>(initial ?? null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [predictions, setPredictions] = useState<GooglePrediction[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [isRemoving, startRemoveTransition] = useTransition()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const autocompleteServiceRef = useRef<any>(null)

  // Fetch the current photographer credit on mount when the parent didn't
  // hand one in. Single-row, indexed lookup — costs ~5ms.
  useEffect(() => {
    if (initial !== undefined) return // parent supplied state; don't second-guess
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from("project_professionals")
        .select("company_id, companies!inner(id, name, audience)")
        .eq("project_id", projectId)
        .eq("companies.audience", "pro")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      const c: any = (data as any)?.companies
      if (c?.id && c?.name) {
        setPhotographer({ companyId: c.id, name: c.name })
      }
    })()
    return () => { cancelled = true }
  }, [initial, projectId, supabase])

  // Focus the input when the popup opens.
  useEffect(() => {
    if (isOpen) {
      // Wait one frame so the input mounts before we focus it.
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
    setQuery("")
    setPredictions([])
  }, [isOpen])

  const runSearch = useCallback((q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < MIN_QUERY_LENGTH) {
      setPredictions([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const g = (window as any).google
        if (!g?.maps) {
          setPredictions([])
          return
        }
        if (!autocompleteServiceRef.current) {
          const placesLib = await g.maps.importLibrary("places")
          if (!placesLib?.AutocompleteService) {
            setPredictions([])
            return
          }
          autocompleteServiceRef.current = new placesLib.AutocompleteService()
        }
        const response: any[] = await new Promise((resolve) => {
          autocompleteServiceRef.current.getPlacePredictions(
            { input: q.trim(), types: ["establishment"], componentRestrictions: { country: "nl" } },
            (preds: any, status: string) => {
              if (status === "OK" && Array.isArray(preds)) resolve(preds)
              else resolve([])
            },
          )
        })
        setPredictions(
          response.slice(0, 6).map((p) => ({
            placeId: p.place_id,
            name: p.structured_formatting?.main_text ?? p.description ?? "",
            city: (() => {
              const parts = (p.structured_formatting?.secondary_text ?? "")
                .split(",")
                .map((s: string) => s.trim())
              return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || null
            })(),
          })),
        )
      } catch {
        setPredictions([])
      } finally {
        setIsSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)
  }, [])

  // Fetch full place details so we can enrich the company row with website,
  // address, and phone before handing off to the server action.
  const fetchPlaceDetails = useCallback(async (placeId: string, fallbackName: string): Promise<PhotographerLookupInput> => {
    const fallback: PhotographerLookupInput = {
      name: fallbackName,
      placeId,
      formattedAddress: null,
      city: null,
      country: null,
      stateRegion: null,
      phone: null,
      website: null,
      domain: null,
    }
    try {
      const g = (window as any).google
      if (!g?.maps) return fallback
      const placesLib = await g.maps.importLibrary("places")
      if (!placesLib?.PlacesService) return fallback
      const div = document.createElement("div")
      const service = new placesLib.PlacesService(div)
      return await new Promise<PhotographerLookupInput>((resolve) => {
        service.getDetails(
          {
            placeId,
            fields: [
              "name",
              "website",
              "formatted_address",
              "address_components",
              "international_phone_number",
              "formatted_phone_number",
            ],
          },
          (place: any, status: string) => {
            if (status !== "OK" || !place) {
              resolve(fallback)
              return
            }
            const components = place.address_components ?? []
            const country = components.find((c: any) => c.types?.includes("country"))?.long_name ?? null
            const stateRegion = components.find((c: any) => c.types?.includes("administrative_area_level_1"))?.long_name ?? null
            const city =
              components.find((c: any) => c.types?.includes("locality"))?.long_name ??
              components.find((c: any) => c.types?.includes("postal_town"))?.long_name ??
              null

            let domain: string | null = null
            if (place.website) {
              try {
                const host = new URL(place.website).hostname.replace(/^www\./, "")
                if (!["facebook.com", "instagram.com", "linkedin.com", "pinterest.com"].includes(host)) {
                  domain = host
                }
              } catch { /* invalid URL — leave domain null */ }
            }

            resolve({
              name: place.name ?? fallbackName,
              placeId,
              formattedAddress: place.formatted_address ?? null,
              city,
              country,
              stateRegion,
              phone: place.international_phone_number ?? place.formatted_phone_number ?? null,
              website: place.website ?? null,
              domain,
            })
          },
        )
      })
    } catch {
      return fallback
    }
  }, [])

  const handleSelect = useCallback(async (prediction: GooglePrediction) => {
    setIsSelecting(true)
    try {
      const enriched = await fetchPlaceDetails(prediction.placeId, prediction.name)
      const result = await addPhotographerToProject(projectId, enriched)
      if (!result.success) {
        toast.error(result.error ?? t("could_not_add"))
        return
      }
      setPhotographer({ companyId: result.companyId!, name: enriched.name })
      setIsOpen(false)
      toast.success(t("credited_success", { name: enriched.name }))
    } finally {
      setIsSelecting(false)
    }
  }, [projectId, fetchPlaceDetails, t])

  const handleRemove = useCallback(() => {
    startRemoveTransition(async () => {
      const result = await removePhotographerFromProject(projectId)
      if (!result.success) {
        toast.error(result.error ?? t("could_not_remove"))
        return
      }
      setPhotographer(null)
      toast.success(t("removed_success"))
    })
  }, [projectId, t])

  const handleManualAdd = useCallback(async () => {
    const name = query.trim()
    if (!name) return
    setIsSelecting(true)
    try {
      const result = await addPhotographerToProject(projectId, {
        name,
        placeId: null,
        formattedAddress: null,
        city: null,
        country: null,
        stateRegion: null,
        phone: null,
        website: null,
        domain: null,
      })
      if (!result.success) {
        toast.error(result.error ?? t("could_not_add"))
        return
      }
      setPhotographer({ companyId: result.companyId!, name })
      setIsOpen(false)
      toast.success(t("credited_success", { name }))
    } finally {
      setIsSelecting(false)
    }
  }, [query, projectId, t])

  const trimmedQuery = query.trim()
  const showAddRow =
    !isSearching &&
    trimmedQuery.length >= MIN_QUERY_LENGTH &&
    !predictions.some((p) => p.name.toLowerCase() === trimmedQuery.toLowerCase())

  return (
    <div
      className={`spec-item-edit${isOpen ? " editing" : ""}`}
      style={{ position: "relative" }}
      onClick={() => !isOpen && setIsOpen(true)}
    >
      <span className="ec-badge">
        <span className="ec-ico">
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11.5 1.5l3 3L5 14H2v-3z" />
          </svg>
        </span>
        <span className="ec-txt">{tBadge("edit_badge")}</span>
      </span>

      <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>
        {t("label")}
      </span>

      {isOpen ? (
        <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="text"
            className="spec-inp"
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder={t("search_placeholder")}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false)
              } else if (e.key === "Enter" && showAddRow) {
                e.preventDefault()
                void handleManualAdd()
              }
            }}
            onBlur={() => {
              // Delay so onMouseDown on a row fires before close.
              setTimeout(() => setIsOpen((prev) => prev && !document.activeElement?.closest('.company-search-menu') ? false : prev), 150)
            }}
          />
          {(predictions.length > 0 || isSearching || showAddRow) && (
            <div className="company-search-menu">
              {predictions.map((p) => (
                <button
                  key={p.placeId}
                  type="button"
                  className="company-search-row"
                  onMouseDown={(e) => { e.preventDefault(); if (!isSelecting) void handleSelect(p) }}
                  style={{ opacity: isSelecting ? 0.6 : 1 }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}{p.city ? ` · ${p.city}` : ""}
                  </span>
                  <span className="tier-badge google">Google</span>
                </button>
              ))}
              {showAddRow && (
                <>
                  {predictions.length > 0 && <div className="company-search-divider" />}
                  <button
                    type="button"
                    className="company-search-add"
                    onMouseDown={(e) => { e.preventDefault(); if (!isSelecting) void handleManualAdd() }}
                    style={{ opacity: isSelecting ? 0.6 : 1 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M8 3v10M3 8h10" />
                    </svg>
                    <span>{t("add_quoted", { name: trimmedQuery })}</span>
                  </button>
                </>
              )}
              {isSearching && (
                <div className="company-search-row" style={{ color: "#a1a1a0", cursor: "default" }}>
                  {t("searching")}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="arco-card-title" style={{ color: photographer ? undefined : "#b0b0ae" }}>
            {photographer?.name ?? t("add")}
          </div>
          {photographer && (
            <button
              type="button"
              aria-label={t("remove_aria")}
              onClick={(e) => { e.stopPropagation(); handleRemove() }}
              disabled={isRemoving}
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "1px solid var(--arco-rule)",
                background: "white",
                color: "var(--arco-light)",
                fontSize: 11,
                lineHeight: 1,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                opacity: isRemoving ? 0.5 : 1,
              }}
            >
              ×
            </button>
          )}
        </>
      )}

    </div>
  )
}
