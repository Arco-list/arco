"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, X } from "lucide-react"
import { toast } from "sonner"

import { chooseCollectionCandidates, listCollectionCandidates, type CollectionCandidate } from "./collection-actions"

/**
 * Keuze na de inventarisatie: alle gevonden collecties van een merk als
 * miniaturen, nieuw gevonden vooraf aangevinkt. Wat je toevoegt wordt
 * meteen een collectie (op /products met het overzichtsbeeld) en gaat de
 * ophaalrij in voor omschrijving, producten en sfeerbeelden. Al
 * toegevoegde collecties staan erbij, uitgegrijsd.
 */
export function CollectionPicker({ brand, onClose, onDone }: { brand: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const [candidates, setCandidates] = useState<CollectionCandidate[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    void listCollectionCandidates(brand.id).then((res) => {
      if (!alive) return
      if ("error" in res) { toast.error(res.error); onClose(); return }
      // Op naam, zodat je een collectie snel terugvindt.
      setCandidates([...res.candidates].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })))
      setSelected(new Set(res.candidates.filter((c) => c.status === "found").map((c) => c.id)))
    })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, saving])

  const open = useMemo(() => (candidates ?? []).filter((c) => c.status === "found"), [candidates])
  const added = (candidates ?? []).length - open.length
  const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  // Meteen dicht: het toevoegen loopt door, de melding volgt.
  const submit = () => {
    const ids = Array.from(selected)
    onClose()
    const id = toast.loading(`Adding ${ids.length} ${ids.length === 1 ? "collection" : "collections"} to ${brand.name}…`)
    void chooseCollectionCandidates(brand.id, ids).then((res) => {
      if ("error" in res) { toast.error(res.error, { id }); return }
      toast.success(`${res.added} ${res.added === 1 ? "collection" : "collections"} added — details and photos are being fetched in the background`, { id })
      onDone()
    })
  }

  return (
    <div className="popup-overlay" onClick={() => !saving && onClose()}>
      <div
        className="popup-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Collections of ${brand.name}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 960, width: "calc(100% - 32px)", padding: 0, display: "flex", flexDirection: "column", maxHeight: "calc(100dvh - 48px)", overflow: "hidden" }}
      >
        <div style={{ padding: "20px 24px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #f0f0ee" }}>
          <div>
            <h3 className="arco-section-title" style={{ margin: 0 }}>Collections of {brand.name}</h3>
            <p className="text-xs text-[#6b6b68]" style={{ margin: "6px 0 0" }}>
              {candidates == null ? "Loading…" : `${open.length} new${added ? ` · ${added} already added` : ""}. Untick what you don't want.`}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {open.length > 0 && (
              <>
                <button type="button" className="text-xs text-[#016D75] hover:underline" onClick={() => setSelected(new Set(open.map((c) => c.id)))}>Select all</button>
                <button type="button" className="text-xs text-[#6b6b68] hover:underline" onClick={() => setSelected(new Set())}>None</button>
              </>
            )}
            <button type="button" className="popup-close" onClick={onClose} aria-label="Close" disabled={saving}><X size={18} /></button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 24px", flex: 1 }}>
          {candidates == null ? null : candidates.length === 0 ? (
            <p className="text-sm text-[#6b6b68]" style={{ padding: "32px 0", textAlign: "center" }}>No collections were found on this brand's site.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {candidates.map((c) => {
                const isAdded = c.status === "chosen"
                const checked = isAdded || selected.has(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isAdded || saving}
                    onClick={() => toggle(c.id)}
                    title={c.description ?? c.name}
                    // Inhoud bovenaan: een knop centreert zijn inhoud anders
                    // verticaal, en tegels met en zonder categorieregel
                    // liepen dan scheef.
                    style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", alignSelf: "start", textAlign: "left", background: "none", border: 0, padding: 0, cursor: isAdded ? "default" : "pointer", opacity: isAdded ? 0.5 : 1 }}
                  >
                    <div style={{ position: "relative", aspectRatio: "1 / 1", background: "#f5f5f4", borderRadius: 4, overflow: "hidden", outline: checked && !isAdded ? "2px solid #1c1c1a" : "1px solid #ececea", outlineOffset: -1 }}>
                      {c.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt={c.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      )}
                      <span style={{ position: "absolute", top: 8, left: 8, width: 20, height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", background: checked ? "#1c1c1a" : "rgba(255,255,255,.92)", border: checked ? "none" : "1px solid #c4c4c2" }}>
                        {checked && <Check size={13} color="#fff" strokeWidth={2.5} />}
                      </span>
                      {isAdded && <span className="text-[10px]" style={{ position: "absolute", bottom: 8, left: 8, background: "#fff", padding: "2px 6px", borderRadius: 3 }}>Added</span>}
                    </div>
                    <div className="text-xs" style={{ marginTop: 6, fontWeight: 500, color: "#1c1c1a" }}>{c.name}</div>
                    {(c.category || c.productCount > 0) && (
                      <div className="text-[11px] text-[#a1a1a0]">
                        {[c.category, c.productCount > 0 ? `${c.productCount} ${c.productCount === 1 ? "product" : "products"}` : null].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid #f0f0ee", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving} style={{ fontSize: 13 }}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => void submit()} disabled={saving || selected.size === 0} style={{ fontSize: 13 }}>
            {saving ? "Adding…" : `Add ${selected.size} ${selected.size === 1 ? "collection" : "collections"}`}
          </button>
        </div>
      </div>
    </div>
  )
}
