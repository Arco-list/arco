"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useLocale } from "next-intl"

import { LOCATION_KINDS, locationKindLabel, type LocationInput, type LocationKind, type LocationRecord } from "@/lib/locations/types"
import { resolveAddressDetails, resolveEstablishmentDetails, searchAddressPredictions, searchEstablishmentPredictions, type AddressPrediction, type EstablishmentPrediction } from "@/lib/places/resolve-address"

/**
 * Eén formulier om een showroom te BEWERKEN (toevoegen gaat via
 * components/showroom-picker.tsx): soort, naam, adres via
 * Places (zoals elk adres op het platform — vrije tekst komt niet in de
 * database), telefoon, website, openingstijden. Gebruikt door de
 * bedrijfseditor (Vestigingen) en de merkadmin (Showrooms).
 */

const DROPDOWN: CSSProperties = {
  position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 20,
  border: "1px solid #e8e8e6", borderRadius: 3, boxShadow: "0 8px 28px rgba(0,0,0,.14)",
  maxHeight: 280, overflowY: "auto", padding: "4px 0", background: "#fff",
}
const ROW: CSSProperties = {
  display: "flex", alignItems: "center", width: "100%", padding: "9px 14px", fontSize: 13, fontWeight: 300,
  color: "#1c1c1a", cursor: "pointer", gap: 8, background: "none", border: "none", textAlign: "left",
}

type Props = {
  initial?: LocationRecord | null
  saving?: boolean
  onSave: (input: LocationInput) => void | Promise<void>
  onClose: () => void
  onDelete?: () => void
}

const COPY = {
  nl: {
    add: "Showroom toevoegen",
    edit: "Showroom bewerken",
    kind: "Soort",
    name: "Naam",
    namePh: "Bijv. Showroom Amsterdam",
    address: "Adres",
    addressPh: "Zoek een adres…",
    searching: "Zoeken…",
    noResults: "Geen resultaten",
    phone: "Telefoon",
    website: "Website",
    hours: "Openingstijden",
    hoursPh: "Ma–vr 9:00–17:30, za op afspraak",
    cancel: "Annuleren",
    save: "Opslaan",
    saving: "Opslaan…",
    delete: "Verwijderen",
    needAddress: "Kies een adres uit de lijst.",
    google: "Zoek op Google Maps",
    googlePh: "Naam van de showroom, bijv. Brouwer Maatkeukens",
    googleHint: "Vult adres, telefoon, website en openingstijden in. Je kunt alles daarna aanpassen.",
    googleFilled: "Ingevuld vanuit Google Maps",
  },
  en: {
    add: "Add showroom",
    edit: "Edit showroom",
    kind: "Type",
    name: "Name",
    namePh: "E.g. Showroom Amsterdam",
    address: "Address",
    addressPh: "Search an address…",
    searching: "Searching…",
    noResults: "No results",
    phone: "Phone",
    website: "Website",
    hours: "Opening hours",
    hoursPh: "Mon–Fri 9:00–17:30, Sat by appointment",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    delete: "Delete",
    needAddress: "Pick an address from the list.",
    google: "Find on Google Maps",
    googlePh: "Showroom name, e.g. Brouwer Maatkeukens",
    googleHint: "Fills in address, phone, website and opening hours. You can edit everything afterwards.",
    googleFilled: "Filled in from Google Maps",
  },
}

export function LocationPopup({ initial, saving = false, onSave, onClose, onDelete }: Props) {
  const locale = useLocale()
  const c = locale === "nl" ? COPY.nl : COPY.en

  const [kind, setKind] = useState<LocationKind>(initial?.kind ?? "showroom")
  const [name, setName] = useState(initial?.name ?? "")
  const [phone, setPhone] = useState(initial?.phone ?? "")
  const [website, setWebsite] = useState(initial?.website ?? "")
  const [hours, setHours] = useState(initial?.openingHours ?? "")
  const [address, setAddress] = useState<Pick<LocationInput, "address" | "streetAddress" | "postalCode" | "city" | "stateRegion" | "country" | "googlePlaceId" | "latitude" | "longitude">>({
    address: initial?.address ?? null,
    streetAddress: initial?.streetAddress ?? null,
    postalCode: initial?.postalCode ?? null,
    city: initial?.city ?? null,
    stateRegion: initial?.stateRegion ?? null,
    country: initial?.country ?? null,
    googlePlaceId: initial?.googlePlaceId ?? null,
    latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null,
  })
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AddressPrediction[]>([])
  const [searching, setSearching] = useState(false)
  const [editingAddress, setEditingAddress] = useState(!initial?.address)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const search = (q: string) => {
    setQuery(q)
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setSearching(true)
      setResults(await searchAddressPredictions(q))
      setSearching(false)
    }, 300)
  }

  // Google Maps: zoek het bedrijf, vul adres, telefoon, website en
  // openingstijden in één keer. De naam alleen als die nog leeg is.
  const [gQuery, setGQuery] = useState("")
  const [gResults, setGResults] = useState<EstablishmentPrediction[]>([])
  const [gSearching, setGSearching] = useState(false)
  const [gFilled, setGFilled] = useState(false)
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (gTimer.current) clearTimeout(gTimer.current) }, [])
  const searchGoogle = (q: string) => {
    setGQuery(q)
    setGFilled(false)
    if (gTimer.current) clearTimeout(gTimer.current)
    if (q.trim().length < 2) { setGResults([]); return }
    gTimer.current = setTimeout(async () => {
      setGSearching(true)
      setGResults(await searchEstablishmentPredictions(q))
      setGSearching(false)
    }, 300)
  }
  const pickGoogle = async (prediction: EstablishmentPrediction) => {
    setGSearching(true)
    const [business, resolved] = await Promise.all([
      resolveEstablishmentDetails(prediction.placeId),
      resolveAddressDetails(prediction.placeId),
    ])
    setGSearching(false)
    if (!business && !resolved) return
    if (resolved) {
      setAddress({
        address: resolved.formattedAddress,
        streetAddress: resolved.streetAddress || null,
        postalCode: resolved.postalCode,
        city: resolved.city,
        stateRegion: resolved.stateRegion,
        country: resolved.country,
        googlePlaceId: resolved.placeId,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      })
      setEditingAddress(false)
      setError(null)
    }
    if (business) {
      if (!name.trim() && business.name) setName(business.name)
      if (business.phone) setPhone(business.phone)
      if (business.website) setWebsite(business.website)
      if (business.openingHours) setHours(business.openingHours)
    }
    setGQuery("")
    setGResults([])
    setGFilled(true)
  }

  const pick = async (placeId: string) => {
    const resolved = await resolveAddressDetails(placeId)
    if (!resolved) return
    setAddress({
      address: resolved.formattedAddress,
      streetAddress: resolved.streetAddress || null,
      postalCode: resolved.postalCode,
      city: resolved.city,
      stateRegion: resolved.stateRegion,
      country: resolved.country,
      googlePlaceId: resolved.placeId,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    })
    setQuery("")
    setResults([])
    setEditingAddress(false)
    setError(null)
  }

  const submit = () => {
    if (!address.address) { setError(c.needAddress); return }
    void onSave({
      id: initial?.id ?? null,
      kind,
      name: name.trim() || null,
      ...address,
      phone: phone.trim() || null,
      email: null,
      website: website.trim() || null,
      openingHours: hours.trim() || null,
    })
  }

  const shownAddress = [address.streetAddress ?? address.address?.split(",")[0]?.trim(), address.postalCode, address.city].filter(Boolean).join(", ")

  return (
    <div className="popup-overlay" onClick={() => !saving && onClose()}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="popup-header">
          <h3 className="arco-section-title">{initial ? c.edit : c.add}</h3>
          <button type="button" className="popup-close" onClick={() => !saving && onClose()} aria-label="Close">✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{c.google}</span>
            <div style={{ position: "relative" }}>
              <input
                autoFocus={!initial}
                className="input-base input-default"
                style={{ width: "100%" }}
                value={gQuery}
                placeholder={c.googlePh}
                onChange={(e) => searchGoogle(e.target.value)}
              />
              {gQuery.trim().length >= 2 && (
                <div style={DROPDOWN}>
                  {gResults.map((r) => (
                    <button key={r.placeId} type="button" style={ROW} onMouseDown={(e) => { e.preventDefault(); void pickGoogle(r) }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 400 }}>{r.name}</span>
                        {r.city && <span style={{ color: "#a1a1a0", marginLeft: 4 }}>{r.city}</span>}
                      </span>
                    </button>
                  ))}
                  {gSearching && <div style={{ ...ROW, color: "#a1a1a0", cursor: "default" }}>{c.searching}</div>}
                  {!gSearching && gResults.length === 0 && <div style={{ ...ROW, color: "#a1a1a0", cursor: "default" }}>{c.noResults}</div>}
                </div>
              )}
            </div>
            <p className="arco-body-text" style={{ color: gFilled ? "var(--primary)" : "#a1a1a0", fontSize: 12, margin: "6px 0 0" }}>
              {gFilled ? c.googleFilled : c.googleHint}
            </p>
          </div>

          <div>
            <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{c.kind}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {LOCATION_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="filter-pill"
                  data-active={kind === k ? "true" : undefined}
                  onClick={() => setKind(k)}
                  style={{ fontSize: 13 }}
                >
                  {locationKindLabel(k, locale)}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: "block" }}>
            <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{c.name}</span>
            <input className="input-base input-default" style={{ width: "100%" }} value={name} placeholder={c.namePh} onChange={(e) => setName(e.target.value)} />
          </label>

          <div>
            <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{c.address}</span>
            {editingAddress ? (
              <div style={{ position: "relative" }}>
                <input
                  autoFocus={Boolean(initial?.address)}
                  className="input-base input-default"
                  style={{ width: "100%" }}
                  value={query}
                  placeholder={c.addressPh}
                  onChange={(e) => search(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape" && address.address) setEditingAddress(false) }}
                />
                {query.trim().length >= 2 && (
                  <div style={DROPDOWN}>
                    {results.map((r) => (
                      <button key={r.placeId} type="button" style={ROW} onMouseDown={(e) => { e.preventDefault(); void pick(r.placeId) }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 400 }}>{r.mainText}</span>
                          {r.secondaryText && <span style={{ color: "#a1a1a0", marginLeft: 4 }}>{r.secondaryText}</span>}
                        </span>
                      </button>
                    ))}
                    {searching && <div style={{ ...ROW, color: "#a1a1a0", cursor: "default" }}>{c.searching}</div>}
                    {!searching && results.length === 0 && <div style={{ ...ROW, color: "#a1a1a0", cursor: "default" }}>{c.noResults}</div>}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="input-base input-default"
                style={{ width: "100%", textAlign: "left", cursor: "text" }}
                onClick={() => setEditingAddress(true)}
                title={address.address ?? undefined}
              >
                {shownAddress}
              </button>
            )}
            {error && <p style={{ color: "#b42318", fontSize: 12, marginTop: 6 }}>{error}</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "block" }}>
              <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{c.phone}</span>
              <input className="input-base input-default" style={{ width: "100%" }} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label style={{ display: "block" }}>
              <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{c.website}</span>
              <input className="input-base input-default" style={{ width: "100%" }} value={website} placeholder="https://…" onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>

          <label style={{ display: "block" }}>
            <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{c.hours}</span>
            <textarea className="input-base input-default" style={{ width: "100%", minHeight: 64, resize: "vertical" }} value={hours} placeholder={c.hoursPh} onChange={(e) => setHours(e.target.value)} />
          </label>
        </div>

        <div className="popup-actions" style={{ marginTop: 24 }}>
          {initial && onDelete && (
            <button type="button" className="btn-tertiary" onClick={onDelete} disabled={saving} style={{ color: "#b42318" }}>{c.delete}</button>
          )}
          <button type="button" className="btn-tertiary" onClick={onClose} disabled={saving} style={{ flex: 1 }}>{c.cancel}</button>
          <button type="button" className="btn-secondary" onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? c.saving : c.save}</button>
        </div>
      </div>
    </div>
  )
}
