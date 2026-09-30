import { logger } from "@/lib/logger"

/**
 * Turn a company's location fields into map coordinates.
 *
 * ONE PLACE, because this decision used to live in four and only one of
 * them knew the whole answer. Three creation paths — admin add,
 * create-company, the photographer import — geocoded only when a full
 * formatted address was supplied; the company-edit form had learned to
 * fall back to the city. Coordinates are derived once, when the row is
 * written, and nothing revisits it afterwards, so a company created
 * through one of those three with only a town to its name never got
 * coordinates and never appeared on /professionals' map. The edit path
 * would have placed it, but that only runs when an owner opens and
 * saves the page, which for an unclaimed prospect never happens.
 *
 * A CITY IS ASKED FOR WITH ITS COUNTRY. A full address carries its own
 * country in the text; a bare town name is exactly the case where the
 * context is thinnest, and "Gilze" or "Best" on their own are an
 * invitation to be placed on the wrong continent.
 *
 * Roughly placed beats absent. A city-level pin is honest about a
 * company being in Amsterdam, which is the question the map answers.
 */
export function buildGeocodeQuery(input: {
  /** A street address. May be a complete one from Places, or a bare
   *  line like "Steenfabriek 5" scraped off a contact page. */
  address?: string | null
  city?: string | null
  country?: string | null
}): string | null {
  const address = input.address?.trim()
  const city = input.city?.trim()
  if (!address && !city) return null

  const country = input.country?.trim() || "Netherlands"

  // Built up rather than picked, because an address is not reliably
  // whole. Places hands over "Keizersgracht 1, 1015 Amsterdam,
  // Netherlands"; a scraped contact page hands over "Steenfabriek 5",
  // which on its own is a street in several countries. Each part is
  // added only when the string does not already carry it, so a complete
  // address is not padded with what it already says.
  const parts: string[] = []
  const has = (value: string) =>
    parts.some((p) => p.toLowerCase().includes(value.toLowerCase()))

  if (address) parts.push(address)
  if (city && !has(city)) parts.push(city)
  if (!has(country)) parts.push(country)

  return parts.join(", ")
}

/**
 * Resolve those fields to coordinates, or null.
 *
 * Returns null on every failure — no key, no result, a network error —
 * because a company without a pin is a smaller problem than a company
 * that cannot be saved. But it SAYS SO on the way out: this used to be
 * a bare `catch {}` in four files, which is how fourteen companies sat
 * off the map without anything anywhere recording that they had been
 * asked about.
 */
export async function geocodeCompanyLocation(input: {
  address?: string | null
  city?: string | null
  country?: string | null
}): Promise<{ latitude: number; longitude: number } | null> {
  const query = buildGeocodeQuery(input)
  if (!query) return null

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!mapsKey) {
    logger.warn("Geocoding skipped — no Google Maps key", { query })
    return null
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${mapsKey}`
    )
    const data = await res.json()
    const location = data?.results?.[0]?.geometry?.location
    if (typeof location?.lat === "number" && typeof location?.lng === "number") {
      return { latitude: location.lat, longitude: location.lng }
    }
    logger.warn("Geocoding returned no usable result", { query, status: data?.status })
    return null
  } catch (error) {
    logger.warn("Geocoding request failed", { query, error })
    return null
  }
}
