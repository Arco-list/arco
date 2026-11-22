"use client"

import { useEffect, useRef, useState } from "react"
import { useLocale } from "next-intl"

import type { LocationInput } from "@/lib/locations/types"
import {
  resolveAddressDetails,
  resolveEstablishmentDetails,
  searchEstablishmentsByName,
  type EstablishmentResult,
} from "@/lib/places/resolve-address"

/**
 * "Showroom toevoegen": geen formulier, alleen kiezen. De locaties onder
 * de bedrijfs- of merknaam op Google Maps staan meteen in de lijst; vink
 * er een of meer aan en voeg ze in één keer toe. Adres, telefoon, website
 * en openingstijden komen van Google. Bewerken van een bestaande showroom
 * gaat via het formulier (LocationPopup).
 */

const COPY = {
  nl: {
    title: "Showrooms toevoegen",
    intro: (n: string) => `Locaties van ${n} op Google Maps. Kies welke showrooms op je pagina komen.`,
    introNoName: "Zoek je showroom op Google Maps.",
    loading: "Locaties zoeken…",
    none: "Geen locaties gevonden. Zoek op een andere naam.",
    added: "Al toegevoegd",
    searchPh: "Andere naam zoeken",
    cancel: "Annuleren",
    add: (n: number) => (n === 0 ? "Toevoegen" : `Toevoegen (${n})`),
    adding: "Toevoegen…",
  },
  en: {
    title: "Add showrooms",
    intro: (n: string) => `${n} locations on Google Maps. Pick the showrooms for your page.`,
    introNoName: "Find your showroom on Google Maps.",
    loading: "Finding locations…",
    none: "No locations found. Try another name.",
    added: "Already added",
    searchPh: "Search another name",
    cancel: "Cancel",
    add: (n: number) => (n === 0 ? "Add" : `Add (${n})`),
    adding: "Adding…",
  },
}

type Props = {
  suggestFor?: string | null
  existingPlaceIds?: string[]
  /** Slaat de gekozen showrooms op; de picker sluit zelf niet. */
  onAdd: (inputs: LocationInput[]) => Promise<void>
  onClose: () => void
}

export function ShowroomPicker({ suggestFor, existingPlaceIds = [], onAdd, onClose }: Props) {
  const locale = useLocale()
  const c = locale === "nl" ? COPY.nl : COPY.en
  const existing = new Set(existingPlaceIds)

  const [results, setResults] = useState<EstablishmentResult[] | null>(suggestFor?.trim() ? null : [])
  // Gekozen locaties blijven gekozen als je verder zoekt.
  const [selected, setSelected] = useState<Map<string, EstablishmentResult>>(new Map())
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!suggestFor?.trim()) return
    let cancelled = false
    void searchEstablishmentsByName(suggestFor).then((r) => { if (!cancelled) setResults(r) })
    return () => { cancelled = true }
  }, [suggestFor])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const search = (q: string) => {
    setQuery(q)
    if (timer.current) clearTimeout(timer.current)
    const term = q.trim() || suggestFor?.trim() || ""
    if (term.length < 2) return
    timer.current = setTimeout(async () => {
      setResults(null)
      setResults(await searchEstablishmentsByName(term))
    }, 400)
  }

  const toggle = (r: EstablishmentResult) => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(r.placeId)) next.delete(r.placeId); else next.set(r.placeId, r)
      return next
    })
  }

  const submit = async () => {
    if (selected.size === 0) return
    setBusy(true)
    const inputs: LocationInput[] = []
    for (const r of selected.values()) {
      const [business, address] = await Promise.all([
        resolveEstablishmentDetails(r.placeId),
        resolveAddressDetails(r.placeId),
      ])
      if (!address && !business?.formattedAddress) continue
      inputs.push({
        kind: "showroom",
        name: business?.name || r.name || null,
        address: address?.formattedAddress ?? business?.formattedAddress ?? r.address,
        streetAddress: address?.streetAddress || null,
        postalCode: address?.postalCode ?? null,
        city: address?.city ?? business?.city ?? null,
        stateRegion: address?.stateRegion ?? business?.stateRegion ?? null,
        country: address?.country ?? business?.country ?? null,
        googlePlaceId: r.placeId,
        latitude: address?.latitude ?? business?.latitude ?? null,
        longitude: address?.longitude ?? business?.longitude ?? null,
        phone: business?.phone ?? null,
        email: null,
        website: business?.website ?? null,
        openingHours: business?.openingHours ?? null,
      })
    }
    try {
      await onAdd(inputs)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="popup-overlay" onClick={() => !busy && onClose()}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="popup-header">
          <h3 className="arco-section-title">{c.title}</h3>
          <button type="button" className="popup-close" onClick={() => !busy && onClose()} aria-label="Close">✕</button>
        </div>

        <p className="arco-body-text" style={{ color: "#8c8c8a", margin: "0 0 16px" }}>
          {suggestFor?.trim() ? c.intro(suggestFor.trim()) : c.introNoName}
        </p>

        <div style={{ border: "1px solid #e8e8e6", borderRadius: 3, maxHeight: 320, overflowY: "auto" }}>
          {results === null ? (
            <p className="arco-body-text" style={{ color: "#a1a1a0", fontSize: 13, margin: 0, padding: "14px" }}>{c.loading}</p>
          ) : results.length === 0 ? (
            <p className="arco-body-text" style={{ color: "#a1a1a0", fontSize: 13, margin: 0, padding: "14px" }}>{c.none}</p>
          ) : (
            results.map((r) => {
              const done = existing.has(r.placeId)
              const checked = done || selected.has(r.placeId)
              return (
                <label
                  key={r.placeId}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px",
                    borderBottom: "1px solid #f0f0ee", cursor: done ? "default" : "pointer", opacity: done ? 0.5 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={done || busy}
                    onChange={() => toggle(r)}
                    style={{ marginTop: 3, accentColor: "var(--primary)" }}
                  />
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                    <span style={{ display: "flex", gap: 8, fontSize: 14, color: "#1c1c1a" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      {done && <span style={{ marginLeft: "auto", color: "#a1a1a0", fontSize: 12, flexShrink: 0 }}>{c.added}</span>}
                    </span>
                    {r.address && <span style={{ color: "#a1a1a0", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.address}</span>}
                  </span>
                </label>
              )
            })
          )}
        </div>

        <input
          className="input-base input-default"
          style={{ width: "100%", marginTop: 12 }}
          value={query}
          placeholder={c.searchPh}
          onChange={(e) => search(e.target.value)}
          disabled={busy}
        />

        <div className="popup-actions" style={{ marginTop: 24 }}>
          <button type="button" className="btn-tertiary" onClick={onClose} disabled={busy} style={{ flex: 1 }}>{c.cancel}</button>
          <button type="button" className="btn-secondary" onClick={() => void submit()} disabled={busy || selected.size === 0} style={{ flex: 1 }}>
            {busy ? c.adding : c.add(selected.size)}
          </button>
        </div>
      </div>
    </div>
  )
}
