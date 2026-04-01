"use client"

import { useCallback, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"
import { adminAddCompanyAction, type GooglePlaceInput } from "@/app/admin/professionals/add-company-actions"

type GooglePlaceResult = { placeId: string; name: string; city: string | null }

interface AdminAddCompanyModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AdminAddCompanyModal({ isOpen, onClose }: AdminAddCompanyModalProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<GooglePlaceResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isPending, startTransition] = useTransition()
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const googleService = useRef<any>(null)

  const resetState = () => {
    setSearchQuery("")
    setResults([])
    setIsSearching(false)
    googleService.current = null
  }

  const handleClose = () => {
    onClose()
    setTimeout(resetState, 300)
  }

  const searchCompanies = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (query.trim().length < 2) {
      setResults([])
      return
    }

    searchTimer.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const g = (window as any).google
        if (!g?.maps) { setIsSearching(false); return }

        if (!googleService.current) {
          const placesLib = await g.maps.importLibrary("places")
          if (!placesLib?.AutocompleteService) { setIsSearching(false); return }
          googleService.current = new placesLib.AutocompleteService()
        }

        const predictions = await new Promise<any>((resolve) => {
          googleService.current.getPlacePredictions(
            { input: query.trim(), types: ["establishment"], componentRestrictions: { country: "nl" } },
            (preds: any, status: string) => resolve(status === "OK" && preds ? preds : []),
          )
        })

        setResults(predictions.slice(0, 8).map((p: any) => ({
          placeId: p.place_id,
          name: p.structured_formatting?.main_text ?? p.description ?? "",
          city: (() => {
            const parts = (p.structured_formatting?.secondary_text ?? "").split(",").map((s: string) => s.trim())
            return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || null
          })(),
        })))
      } catch {
        setResults([])
      }
      setIsSearching(false)
    }, 300)
  }, [])

  const handleSelectResult = useCallback(async (result: GooglePlaceResult) => {
    startTransition(async () => {
      try {
        const g = (window as any).google
        if (!g?.maps) return

        const placesLib = await g.maps.importLibrary("places")
        const div = document.createElement("div")
        const service = new placesLib.PlacesService(div)

        const place = await new Promise<any>((resolve, reject) => {
          service.getDetails(
            {
              placeId: result.placeId,
              fields: ["name", "place_id", "formatted_address", "address_components", "formatted_phone_number", "website", "types"],
            },
            (place: any, status: string) => {
              if (status === "OK" && place) resolve(place)
              else reject(new Error("Failed to get place details"))
            },
          )
        })

        let city = ""
        let country = ""
        let stateRegion = ""
        for (const comp of place.address_components ?? []) {
          if (comp.types.includes("locality")) city = comp.long_name
          if (comp.types.includes("country")) country = comp.long_name
          if (comp.types.includes("administrative_area_level_1")) stateRegion = comp.long_name
        }

        let domain: string | null = null
        if (place.website) {
          try { domain = new URL(place.website).hostname.replace(/^www\./, "") } catch {}
        }

        const input: GooglePlaceInput = {
          name: place.name,
          placeId: place.place_id,
          formattedAddress: place.formatted_address ?? null,
          city: city || null,
          country: country || null,
          stateRegion: stateRegion || null,
          phone: place.formatted_phone_number ?? null,
          website: place.website ?? null,
          domain,
        }

        const actionResult = await adminAddCompanyAction(input)

        if (actionResult.success && actionResult.companyId) {
          toast.success(`${place.name} added to Arco`)
          handleClose()
          router.push(`/dashboard/company?company_id=${actionResult.companyId}`)
        } else {
          toast.error(actionResult.error ?? "Failed to add company")
        }
      } catch (e) {
        console.error("Failed to get place details:", e)
        toast.error("Could not load company details")
      }
    })
  }, [router])

  if (!isOpen) return null

  return (
    <div className="popup-overlay" onClick={handleClose}>
      <div
        className="popup-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, padding: 0, display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 28px",
            background: "var(--arco-off-white)",
            borderRadius: "12px 12px 0 0",
            flexShrink: 0,
          }}
        >
          <h3 className="arco-section-title" style={{ margin: 0 }}>Add company</h3>
          <button type="button" className="popup-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "12px 28px 28px" }}>
          <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 16 }}>
            Search for a company on Google to add it to Arco. The company will be listed without an owner and can be claimed by a user with the company domain.
          </p>

          <input
            type="text"
            className="form-input"
            placeholder="Search company name..."
            value={searchQuery}
            onChange={(e) => searchCompanies(e.target.value)}
            autoFocus
            style={{ marginBottom: 0 }}
          />

          {/* Results */}
          {searchQuery.trim().length >= 2 && (
            <div style={{ marginTop: 8, border: "1px solid var(--arco-rule)", borderRadius: 3, maxHeight: 320, overflowY: "auto" }}>
              {isSearching && (
                <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--arco-mid-grey)" }}>Searching...</div>
              )}

              {!isSearching && results.length === 0 && searchQuery.trim().length >= 2 && (
                <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--arco-mid-grey)" }}>No companies found</div>
              )}

              {results.map((r) => (
                <button
                  key={r.placeId}
                  type="button"
                  onClick={() => handleSelectResult(r)}
                  disabled={isPending}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "9px 14px",
                    fontSize: 13,
                    fontWeight: 300,
                    color: "var(--arco-black)",
                    cursor: "pointer",
                    gap: 8,
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    fontFamily: "var(--font-sans)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arco-off-white)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name}{r.city ? ` · ${r.city}` : ""}
                  </span>
                  {isPending ? (
                    <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite", flexShrink: 0, color: "var(--arco-mid-grey)" }} />
                  ) : (
                    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.04em", padding: "1px 5px", borderRadius: 3, textTransform: "uppercase", flexShrink: 0, background: "rgba(66,133,244,0.1)", color: "#4285F4" }}>
                      Google
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {searchQuery.trim().length < 2 && (
            <p style={{ fontSize: 13, color: "var(--arco-mid-grey)", marginTop: 8 }}>
              Start typing to search...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
