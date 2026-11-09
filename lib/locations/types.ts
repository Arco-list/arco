/**
 * Vestigingen: showrooms, winkels, kantoren en werkplaatsen van een
 * bedrijf óf van een merk (tabel `locations`, migratie 297). Eén vorm
 * voor de bedrijfspagina, de bedrijfseditor, de merkpagina en de
 * merkadmin, zodat het formulier (components/location-form.tsx) overal
 * hetzelfde is.
 */

export const LOCATION_KINDS = ["showroom", "store", "office", "workshop"] as const
export type LocationKind = (typeof LOCATION_KINDS)[number]

export type LocationRecord = {
  id: string
  kind: LocationKind
  name: string | null
  /** Volledig adres zoals Places het geeft. */
  address: string | null
  /** Straat en nummer, voor weergave zonder postcode en land. */
  streetAddress: string | null
  postalCode: string | null
  city: string | null
  stateRegion: string | null
  country: string | null
  googlePlaceId: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  website: string | null
  openingHours: string | null
  position: number
}

/** Wat het formulier oplevert en de server opslaat. `id` leeg = nieuw. */
export type LocationInput = Omit<LocationRecord, "id" | "position"> & { id?: string | null }

const KIND_LABELS: Record<LocationKind, { nl: string; en: string }> = {
  showroom: { nl: "Showroom", en: "Showroom" },
  store: { nl: "Winkel", en: "Store" },
  office: { nl: "Kantoor", en: "Office" },
  workshop: { nl: "Werkplaats", en: "Workshop" },
}

export function locationKindLabel(kind: string, locale: string): string {
  const entry = KIND_LABELS[(kind as LocationKind) in KIND_LABELS ? (kind as LocationKind) : "showroom"]
  return locale === "nl" ? entry.nl : entry.en
}

/** Straat + plaats, de korte regel onder een naam. */
export function locationShortAddress(loc: Pick<LocationRecord, "streetAddress" | "address" | "city">): string | null {
  const street = loc.streetAddress ?? loc.address?.split(",")[0]?.trim() ?? null
  return [street, loc.city].filter(Boolean).join(", ") || null
}

/** Databaserij → record. Houdt alle onbekende velden buiten. */
export function locationFromRow(row: Record<string, unknown>): LocationRecord {
  const kind = String(row.kind ?? "showroom")
  return {
    id: String(row.id),
    kind: (LOCATION_KINDS as readonly string[]).includes(kind) ? (kind as LocationKind) : "showroom",
    name: (row.name as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    streetAddress: (row.street_address as string | null) ?? null,
    postalCode: (row.postal_code as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    stateRegion: (row.state_region as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    googlePlaceId: (row.google_place_id as string | null) ?? null,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    openingHours: (row.opening_hours as string | null) ?? null,
    position: Number(row.position ?? 0),
  }
}

/** Record/invoer → kolommen voor insert/update. */
export function locationToRow(input: LocationInput): Record<string, unknown> {
  const clean = (v: string | null | undefined) => {
    const s = (v ?? "").trim()
    return s.length ? s : null
  }
  return {
    kind: (LOCATION_KINDS as readonly string[]).includes(input.kind) ? input.kind : "showroom",
    name: clean(input.name),
    address: clean(input.address),
    street_address: clean(input.streetAddress),
    postal_code: clean(input.postalCode),
    city: clean(input.city),
    state_region: clean(input.stateRegion),
    country: clean(input.country),
    google_place_id: clean(input.googlePlaceId),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    phone: clean(input.phone),
    email: clean(input.email),
    website: clean(input.website),
    opening_hours: clean(input.openingHours),
  }
}
