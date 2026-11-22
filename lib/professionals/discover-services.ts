/**
 * Diensten die niet als keuze op /professionals staan: niet in het
 * dienstfilter (balk en lade) en niet in de rij met dienstkaarten.
 *
 * Fotografen staan op Arco als credit bij projecten (de fotograaf van de
 * beelden), niet als professional die een opdrachtgever zoekt voor zijn
 * huis. Hun bedrijfspagina's en credits blijven gewoon bestaan.
 */
export const HIDDEN_DISCOVER_SERVICE_SLUGS = new Set<string>(["photographer"])

export function isDiscoverService(slug: string | null | undefined): boolean {
  return !slug || !HIDDEN_DISCOVER_SERVICE_SLUGS.has(slug)
}
