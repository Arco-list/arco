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
  // Ingedeeld (migratie 318): een sfeerbeeld. Is de omslag een sfeerbeeld,
  // dan die — ook staand, want de hero snijdt bij rond het focuspunt
  // (migratie 326) en een gekozen cover moet bovenaan staan. Anders het
  // eerste liggende sfeerbeeld, of het eerste. Zonder sfeerbeelden de oude
  // regel hieronder.
  const ambiance = photos.filter((p) => p.kind === "ambiance")
  if (ambiance.length > 0) {
    const primary = ambiance.find((p) => p.isPrimary)
    if (primary) return primary
    return ambiance.find((p) => landscape(p) === true) ?? ambiance[0]
  }
  // Nog niet ingedeeld: de omslag als die geen png (studiobeeld) is;
  // anders liefst een liggende foto.
  const cover = photos.find((p) => p.isPrimary) ?? photos[0] ?? null
  if (!cover) return null
  if (!isCutout(cover.url) && (cover.isPrimary || landscape(cover) !== false)) return cover
  return photos.find((p) => !isCutout(p.url) && landscape(p) === true)
    ?? (!isCutout(cover.url) ? cover : photos.find((p) => !isCutout(p.url)) ?? cover)
}
