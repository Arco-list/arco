/**
 * Alle rijen van een query, in blokken van 1000.
 *
 * Supabase (PostgREST) geeft per verzoek hooguit 1000 rijen terug, zonder
 * foutmelding: een lijst van 1039 merken kwam zo als precies 1000 binnen,
 * en 2282 merkcategorieën als 1000. Geef een functie die de query bouwt
 * (met een volgorde die uniek is, anders kunnen rijen tussen blokken
 * schuiven); die wordt per blok opnieuw gebouwd met .range().
 *
 *   const { data } = await selectAll(() =>
 *     supabase.from("brands").select("id, name").order("name").order("id"))
 *
 * Geeft { data, error } terug, zodat het in een Promise.all met gewone
 * queries past.
 */
const PAGE = 1000

export async function selectAll<T = any>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> },
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) return { data: rows, error }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) return { data: rows, error: null }
  }
}
