/**
 * De regel onder de naam van een collectie: soorten en designer op één
 * regel, maar uit elkaar te houden. De soorten (Loungesets · Tuintafels +1)
 * staan in de lichte tint en krimpen met een ellips als de kaart smal is;
 * de designer staat achter een punt, met "by" / "van" ervoor en in de
 * donkerder tint, en krimpt niet mee — de naam blijft dus altijd leesbaar.
 * Eén bron voor de publieke kaart en de kaart op de merkbewerkpagina.
 */
export function CollectionSub({ kinds, designer, nl = false }: { kinds: string | null; designer: string | null; nl?: boolean }) {
  if (!kinds && !designer) return null
  const clip = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const
  return (
    <p className="discover-card-sub" style={{ display: "flex", gap: 6, minWidth: 0 }}>
      {kinds && <span style={{ ...clip, minWidth: 0 }}>{kinds}</span>}
      {kinds && designer && <span aria-hidden="true" style={{ flexShrink: 0 }}>·</span>}
      {designer && (
        <span style={{ ...clip, flexShrink: kinds ? 0 : 1, maxWidth: kinds ? "55%" : "100%", color: "var(--arco-mid)" }}>
          {nl ? "van" : "by"} {designer}
        </span>
      )}
    </p>
  )
}
