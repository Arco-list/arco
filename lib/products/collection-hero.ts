/**
 * Welke foto bovenaan een collectie staat — één regel voor de publieke pagina
 * en de bewerkpagina, zodat de admin ziet wat de bezoeker ziet. Liefst de
 * omslag; is die een png (meestal een studiobeeld op een effen of
 * doorzichtige achtergrond, dat groot slecht staat), dan de eerste foto
 * die dat niet is; is er geen, dan toch de omslag.
 */
const isCutout = (url: string) => /\.png(\?|$)/i.test(url)

/** Een studiobeeld op een effen of doorzichtige achtergrond: in de hero
 *  heel op grijs (contain), nooit bijgesneden. Al het andere vult de
 *  volle breedte, bijgesneden rond het focuspunt (migratie 326). */
export const isCutoutPhoto = (p: { url: string; kind?: string | null }) =>
  p.kind === "product" || (p.kind !== "ambiance" && isCutout(p.url))

/** Liggend: breed genoeg voor de hero (migratie 322); null als de maten
 *  onbekend zijn. */
const LANDSCAPE_RATIO = 1.2
const landscape = (p: { width?: number | null; height?: number | null }): boolean | null =>
  p.width && p.height ? p.width / p.height >= LANDSCAPE_RATIO : null

export function pickCollectionHero<T extends { url: string; isPrimary: boolean; kind?: string | null; width?: number | null; height?: number | null }>(photos: T[]): T | null {
  // Ingedeeld (migratie 318): een sfeerbeeld. Liefst de omslag, maar alleen
  // als die liggend is; anders het eerste liggende sfeerbeeld, want de hero
  // is een breed vlak. Geen liggend sfeerbeeld: toch de omslag (of het
  // eerste sfeerbeeld). Zonder sfeerbeelden de oude regel hieronder.
  const ambiance = photos.filter((p) => p.kind === "ambiance")
  if (ambiance.length > 0) {
    const preferred = ambiance.find((p) => p.isPrimary) ?? ambiance[0]
    if (landscape(preferred) !== false) return preferred
    return ambiance.find((p) => landscape(p) === true) ?? preferred
  }
  // Nog niet ingedeeld: geen png (studiobeeld), en ook hier liefst liggend.
  const cover = photos.find((p) => p.isPrimary) ?? photos[0] ?? null
  if (!cover) return null
  if (!isCutout(cover.url) && landscape(cover) !== false) return cover
  return photos.find((p) => !isCutout(p.url) && landscape(p) === true)
    ?? (!isCutout(cover.url) ? cover : photos.find((p) => !isCutout(p.url)) ?? cover)
}
