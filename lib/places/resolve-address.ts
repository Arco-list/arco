"use client"

/**
 * Shared client-side Google Places address resolution.
 *
 * One rule platform-wide: every location in the system comes from
 * Places — free text never enters `companies.address`. This module is
 * the single resolver behind that rule, used by the claim funnel and
 * company edit alike.
 *
 * It exists because the inline version in company-edit only requested
 * formatted_address + address_components and persisted address/city/
 * country — dropping place_id, state_region and coordinates on every
 * edit. That is why all nine companies credited on Hedendaags carry a
 * place_id (from import) but NULL latitude/longitude.
 *
 * Assumes the Maps JS script from app/[locale]/layout.tsx is present.
 */

export type AddressPrediction = {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
}

export type ResolvedAddress = {
  /** Full formatted address — what we store in companies.address. */
  formattedAddress: string
  /** Street + number, for display contexts that strip postcode/country. */
  streetAddress: string
  city: string | null
  stateRegion: string | null
  country: string | null
  placeId: string
  latitude: number | null
  longitude: number | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let autocompleteService: any = null

async function placesLib(): Promise<any | null> {
  const g = (window as any).google
  if (!g?.maps?.importLibrary) return null
  return g.maps.importLibrary("places")
}

/** Debounce-free prediction fetch — callers own their debounce. */
export async function searchAddressPredictions(query: string): Promise<AddressPrediction[]> {
  const q = query.trim()
  if (q.length < 2) return []
  try {
    if (!autocompleteService) {
      const lib = await placesLib()
      if (!lib?.AutocompleteService) return []
      autocompleteService = new lib.AutocompleteService()
    }
    const predictions = await new Promise<any[]>((resolve) => {
      autocompleteService.getPlacePredictions(
        { input: q, types: ["address"] },
        (preds: any, status: string) => resolve(status === "OK" && preds ? preds : []),
      )
    })
    return predictions.slice(0, 5).map((p: any) => ({
      placeId: p.place_id,
      description: p.description ?? "",
      mainText: p.structured_formatting?.main_text ?? "",
      secondaryText: p.structured_formatting?.secondary_text ?? "",
    }))
  } catch {
    return []
  }
}

/** Resolve a picked prediction to the complete location record. */
export async function resolveAddressDetails(placeId: string): Promise<ResolvedAddress | null> {
  try {
    const lib = await placesLib()
    if (!lib?.PlacesService) return null
    const service = new lib.PlacesService(document.createElement("div"))
    const place = await new Promise<any>((resolve, reject) => {
      service.getDetails(
        { placeId, fields: ["formatted_address", "address_components", "geometry", "place_id"] },
        (p: any, status: string) => (status === "OK" && p ? resolve(p) : reject(new Error(status))),
      )
    })

    let city: string | null = null
    let stateRegion: string | null = null
    let country: string | null = null
    let street = ""
    let streetNumber = ""
    for (const comp of place.address_components ?? []) {
      if (comp.types.includes("locality")) city = comp.long_name
      if (comp.types.includes("administrative_area_level_1")) stateRegion = comp.long_name
      if (comp.types.includes("country")) country = comp.long_name
      if (comp.types.includes("route")) street = comp.long_name
      if (comp.types.includes("street_number")) streetNumber = comp.long_name
    }

    const loc = place.geometry?.location
    return {
      formattedAddress: place.formatted_address ?? [street, streetNumber].filter(Boolean).join(" "),
      streetAddress: [street, streetNumber].filter(Boolean).join(" "),
      city,
      stateRegion,
      country,
      placeId: place.place_id ?? placeId,
      latitude: typeof loc?.lat === "function" ? loc.lat() : null,
      longitude: typeof loc?.lng === "function" ? loc.lng() : null,
    }
  } catch {
    return null
  }
}

// ─── Establishment (company) lookup ────────────────────────────────────────
// The platform claim funnel's company search. Same library, different
// prediction type: establishments, not addresses.

export type EstablishmentPrediction = {
  placeId: string
  name: string
  city: string | null
}

export type ResolvedEstablishment = {
  name: string
  placeId: string
  formattedAddress: string | null
  city: string | null
  country: string | null
  stateRegion: string | null
  phone: string | null
  website: string | null
  domain: string | null
  editorialSummary: string | null
  googleTypes: string[] | null
  latitude: number | null
  longitude: number | null
}

export async function searchEstablishmentPredictions(query: string): Promise<EstablishmentPrediction[]> {
  const q = query.trim()
  if (q.length < 2) return []
  try {
    if (!autocompleteService) {
      const lib = await placesLib()
      if (!lib?.AutocompleteService) return []
      autocompleteService = new lib.AutocompleteService()
    }
    const predictions = await new Promise<any[]>((resolve) => {
      autocompleteService.getPlacePredictions(
        { input: q, types: ["establishment"], componentRestrictions: { country: "nl" } },
        (preds: any, status: string) => resolve(status === "OK" && preds ? preds : []),
      )
    })
    return predictions.slice(0, 5).map((p: any) => ({
      placeId: p.place_id,
      name: p.structured_formatting?.main_text ?? p.description ?? "",
      city: (() => {
        const parts = (p.structured_formatting?.secondary_text ?? "").split(",").map((s: string) => s.trim())
        return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || null
      })(),
    }))
  } catch {
    return []
  }
}

/** Full business record for a picked establishment — the create-company
 *  modal's getDetails call, shared. */
export async function resolveEstablishmentDetails(placeId: string): Promise<ResolvedEstablishment | null> {
  try {
    const lib = await placesLib()
    if (!lib?.PlacesService) return null
    const service = new lib.PlacesService(document.createElement("div"))
    const place = await new Promise<any>((resolve, reject) => {
      service.getDetails(
        {
          placeId,
          fields: ["name", "place_id", "formatted_address", "address_components", "formatted_phone_number", "website", "editorial_summary", "types", "geometry"],
        },
        (p: any, status: string) => (status === "OK" && p ? resolve(p) : reject(new Error(status))),
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
    const website: string | null = place.website ?? null
    let domain: string | null = null
    if (website) {
      try { domain = new URL(website).hostname.replace(/^www\./, "") } catch { domain = null }
    }

    return {
      name: place.name ?? "",
      placeId: place.place_id ?? placeId,
      formattedAddress: place.formatted_address ?? null,
      city: city || null,
      country: country || null,
      stateRegion: stateRegion || null,
      phone: place.formatted_phone_number ?? null,
      website,
      domain,
      editorialSummary: place.editorial_summary?.text ?? null,
      googleTypes: place.types ?? null,
      latitude: typeof place.geometry?.location?.lat === "function" ? place.geometry.location.lat() : null,
      longitude: typeof place.geometry?.location?.lng === "function" ? place.geometry.location.lng() : null,
    }
  } catch {
    return null
  }
}
