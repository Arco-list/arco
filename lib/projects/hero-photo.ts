/**
 * De foto voor de hero van een project. De hero is een liggend vlak
 * (2 : 1, .project-hero-frame); een staande foto wordt daarin zwaar
 * bijgesneden. Daarom:
 *
 * - de cover, als die liggend is (of als we zijn maten niet kennen);
 * - anders de eerste liggende foto in de volgorde van de fototour;
 * - is er geen enkele liggende foto, dan toch de cover.
 *
 * De cover zelf verandert niet: kaarten en delen blijven de keuze van de
 * eigenaar tonen. Alleen de hero wijkt uit naar een liggende foto.
 */

/** Vanaf deze verhouding (breedte / hoogte) telt een foto als liggend. */
const LANDSCAPE_RATIO = 1.2

type Sized = { width?: number | null; height?: number | null }

export function isLandscape(photo: Sized): boolean | null {
  if (!photo.width || !photo.height) return null
  return photo.width / photo.height >= LANDSCAPE_RATIO
}

export function pickHeroPhoto<T extends Sized>(cover: T | undefined, photosInTourOrder: T[]): T | undefined {
  if (!cover) return undefined
  if (isLandscape(cover) !== false) return cover
  return photosInTourOrder.find((p) => isLandscape(p) === true) ?? cover
}
