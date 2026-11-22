/**
 * Cellen in de details-balk van een bedrijf die naar buiten linken:
 * de website (kaal domein + pijl, zodat duidelijk is dat het een externe
 * link is) en het kantooradres (straat, stad -> Google Maps).
 */

const ELLIPSIS = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const

export function SpecWebsite({ domain }: { domain: string }) {
  const host = domain.replace(/^https?:\/\//i, "")
  const bare = host.replace(/^www\./i, "").replace(/\/$/, "")
  return (
    <a href={`https://${host}`} target="_blank" rel="noopener noreferrer" className="text-link-plain" style={ELLIPSIS}>
      {bare} →
    </a>
  )
}

/**
 * Straat + stad (+ pijl) als link naar het bedrijf in Google Maps. Met een
 * place-id opent Maps de vermelding van het bedrijf zelf (reviews,
 * openingstijden); zonder zoekt het op "naam, adres", wat meestal ook
 * de vermelding vindt. Zonder straat alleen de stad, zonder link.
 */
export function SpecAddress({ name, address, city, placeId, fallback }: {
  name: string
  address: string | null
  city: string | null
  placeId: string | null
  fallback: string | null
}) {
  const street = address?.split(",")[0]?.trim() || null
  if (!street) return fallback ? <>{fallback}</> : null
  const label = [street, city].filter(Boolean).join(", ")
  const query = [name, address ?? label].join(", ")
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    + (placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : "")
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-link-plain">
      {label} →
    </a>
  )
}
