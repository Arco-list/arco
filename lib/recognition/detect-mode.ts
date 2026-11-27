/**
 * Stippen per productcategorie (migratie 363), te kiezen in admin ›
 * categorieën › producten. Los bestand zonder server-imports: de herkenning
 * en de admin-tabel rekenen er allebei mee.
 *
 *   auto  stippen; een soort die admins bijna altijd verwijderen wordt
 *         vanzelf verborgen
 *   show  stippen, nooit automatisch verbergen
 *   hide  stippen, maar meteen verborgen
 *   off   geen stippen (niet in de lijst voor Claude)
 *
 * Geen eigen stand: die van de dichtstbijzijnde ouder met een stand;
 * bovenaan auto. "Uit" hoger in de boom gaat altijd voor.
 */
export type DetectMode = "auto" | "show" | "hide" | "off"

export const DETECT_MODES: DetectMode[] = ["auto", "show", "hide", "off"]

type Node = { id: string; parent_id?: string | null; parentId?: string | null; detect_mode?: string | null; detectMode?: string | null }

const own = (n: Node): DetectMode | null => {
  const m = n.detect_mode ?? n.detectMode ?? null
  return m && (DETECT_MODES as string[]).includes(m) ? (m as DetectMode) : null
}
const parentOf = (n: Node) => n.parent_id ?? n.parentId ?? null

/** De stand die geldt, en van welke categorie hij komt (null = standaard). */
export function effectiveDetectMode<T extends Node>(node: T, byId: Map<string, T>): { mode: DetectMode; from: T | null } {
  const chain: T[] = []
  for (let cur: T | undefined = node; cur && chain.length < 8; cur = parentOf(cur) ? byId.get(parentOf(cur)!) : undefined) chain.push(cur)
  const off = chain.find((c) => own(c) === "off")
  if (off) return { mode: "off", from: off }
  const set = chain.find((c) => own(c) !== null)
  return set ? { mode: own(set)!, from: set } : { mode: "auto", from: null }
}
