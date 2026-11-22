"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"

import type { LogoCandidate } from "@/lib/brands/find-logo"
import { findBrandLogoCandidates, setBrandLogoFromCandidate } from "./logo-actions"

/**
 * "Find logo": de logokandidaten van de website van het merk naast elkaar,
 * op dezelfde lichte schijf als in de tabel, zodat je ziet hoe het eruit
 * komt te zien. Klik er één aan om hem op te slaan.
 */
export function LogoPicker({ brand, onClose, onSaved }: { brand: { id: string; name: string }; onClose: () => void; onSaved: (url: string) => void }) {
  const [candidates, setCandidates] = useState<LogoCandidate[] | null>(null)
  const [broken, setBroken] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    void findBrandLogoCandidates(brand.id).then((res) => {
      if (!alive) return
      if ("error" in res) { toast.error(res.error); onClose(); return }
      setCandidates(res.candidates)
    })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand.id])

  const pick = async (i: number) => {
    const c = candidates?.[i]
    if (!c) return
    setSaving(i)
    const res = await setBrandLogoFromCandidate(brand.id, { url: c.url, svg: c.svg })
    setSaving(null)
    if ("error" in res) { toast.error(res.error); return }
    toast.success(`Logo saved for ${brand.name}`)
    onSaved(res.url)
  }

  const shown = (candidates ?? []).map((c, i) => ({ c, i })).filter(({ i }) => !broken.has(i))

  return (
    <div className="popup-overlay" onClick={() => saving == null && onClose()}>
      <div className="popup-card" role="dialog" aria-modal="true" aria-label={`Logo for ${brand.name}`} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="popup-header">
          <h3 className="arco-section-title">Logo for {brand.name}</h3>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close" disabled={saving != null}><X size={18} /></button>
        </div>
        {candidates == null ? (
          <p className="text-sm text-[#6b6b68]" style={{ padding: "24px 0" }}>Looking on the brand&apos;s website…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-[#6b6b68]" style={{ padding: "24px 0" }}>No logo found on the website. Upload one by clicking the logo.</p>
        ) : (
          <>
            <p className="text-xs text-[#6b6b68]" style={{ margin: "0 0 16px" }}>Found on the brand&apos;s website. Click the one to use.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {shown.map(({ c, i }) => (
                <button
                  key={i}
                  type="button"
                  disabled={saving != null}
                  onClick={() => void pick(i)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 12, background: "none", border: "1px solid #ececea", borderRadius: 6, cursor: "pointer", opacity: saving != null && saving !== i ? 0.4 : 1 }}
                  className="hover:border-[#1c1c1a] transition-colors"
                >
                  <span style={{ width: 96, height: 96, borderRadius: "50%", background: "#f5f5f4", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(c.svg)}` : c.url!}
                      alt=""
                      onError={() => setBroken((prev) => new Set(prev).add(i))}
                      style={{ maxWidth: "70%", maxHeight: "70%", objectFit: "contain" }}
                    />
                  </span>
                  <span className="text-[11px] text-[#6b6b68]">{saving === i ? "Saving…" : c.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
