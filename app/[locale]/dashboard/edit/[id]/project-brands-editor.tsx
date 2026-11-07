"use client"

import { useEffect, useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Plus, X } from "lucide-react"

import {
  addProjectBrandAction,
  loadProjectBrandsEditorAction,
  removeProjectBrandAction,
  updateProjectBrandAction,
  type BrandOption,
  type FamilyOption,
  type ProjectBrandRow,
  type SpaceOption,
} from "./brand-actions"

/**
 * Merken en series op dit project — admin-only, fase 1 van de merkenlaag.
 *
 * Merk + optioneel serie + ruimte als hint + vrije notitie. Geen product,
 * geen foto. Dat is wat de architect wéét ("Occhio Mito in de woonkamer");
 * op welke foto is de volgende stap, en die kan een vision-pass doen
 * zodra dit er staat.
 *
 * Eigen sectie, eigen acties, eigen state: raakt niets van de credits-
 * editor erboven, zodat de eigenaar hem later kan krijgen door alleen de
 * guard te verruimen.
 */
export function ProjectBrandsEditor({ projectId }: { projectId: string }) {
  const locale = useLocale()
  const nl = locale === "nl"
  const tSpaces = useTranslations("spaces")

  const [brands, setBrands] = useState<BrandOption[]>([])
  const [families, setFamilies] = useState<FamilyOption[]>([])
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [links, setLinks] = useState<ProjectBrandRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [pending, startTransition] = useTransition()

  const [draftBrandId, setDraftBrandId] = useState("")
  const [draftFamilyId, setDraftFamilyId] = useState("")
  const [draftSpaceId, setDraftSpaceId] = useState("")
  const [draftNote, setDraftNote] = useState("")

  useEffect(() => {
    let alive = true
    void loadProjectBrandsEditorAction(projectId).then((res) => {
      if (!alive) return
      if ("error" in res) { setError(res.error); setLoaded(true); return }
      setBrands(res.brands)
      setFamilies(res.families)
      setSpaces(res.spaces)
      setLinks(res.links)
      setLoaded(true)
    })
    return () => { alive = false }
  }, [projectId])

  const spaceLabel = (slug: string) => {
    try { return tSpaces(slug as never) } catch { return slug }
  }
  const familiesOf = (brandId: string) => families.filter((f) => f.brandId === brandId)

  // Een merk×serie staat hoogstens één keer op een project — de index dwingt
  // het af; de knop biedt het niet eens aan.
  const comboKey = (brandId: string, familyId: string | null) => `${brandId}|${familyId ?? ""}`
  const existing = new Set(links.map((l) => comboKey(l.brandId, l.familyId)))
  const draftExists = Boolean(draftBrandId) && existing.has(comboKey(draftBrandId, draftFamilyId || null))

  const add = () => {
    if (!draftBrandId || draftExists) return
    setError(null)
    startTransition(async () => {
      const res = await addProjectBrandAction(projectId, draftBrandId, draftFamilyId || null, draftSpaceId || null, draftNote || null)
      if ("error" in res) { setError(res.error); return }
      // Een verfijning (merk → merk › serie) komt terug met het id van de
      // bestaande rij; dan vervangen in plaats van toevoegen.
      setLinks((prev) => (prev.some((l) => l.id === res.link.id) ? prev.map((l) => (l.id === res.link.id ? res.link : l)) : [...prev, res.link]))
      setDraftBrandId(""); setDraftFamilyId(""); setDraftSpaceId(""); setDraftNote("")
    })
  }

  const patch = (linkId: string, fields: { familyId?: string | null; spaceId?: string | null; note?: string | null }) => {
    setError(null)
    startTransition(async () => {
      const res = await updateProjectBrandAction(linkId, fields)
      if ("error" in res) { setError(res.error); return }
      setLinks((prev) => prev.map((l) => (l.id === linkId ? res.link : l)))
    })
  }

  const remove = (linkId: string) => {
    setError(null)
    startTransition(async () => {
      const res = await removeProjectBrandAction(linkId)
      if ("error" in res) { setError(res.error); return }
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
    })
  }

  const field: React.CSSProperties = {
    height: 36, padding: "0 10px", border: "1px solid #e5e5e4", borderRadius: 4,
    fontSize: 13, background: "#fff", color: "#1c1c1a", minWidth: 0,
  }
  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1.1fr 1fr 150px 1fr 36px", gap: 8, alignItems: "center" }

  return (
    <section id="brands" className="wrap" style={{ paddingTop: 0, paddingBottom: 120 }}>
      <div style={{ marginBottom: 24, maxWidth: 600 }}>
        <h2 className="arco-section-title">{nl ? "Merken" : "Brands"}</h2>
        <p className="arco-body-text" style={{ marginTop: 6 }}>
          {nl
            ? "Welke merken en series zijn in dit project toegepast? Merk volstaat; serie en ruimte als je ze weet. Op welke foto komt later."
            : "Which brands and series were used in this project? Brand is enough; add series and room when known. Which photo comes later."}
        </p>
        <p className="arco-eyebrow" style={{ marginTop: 10, color: "#a1a1a0" }}>
          {nl ? "Alleen zichtbaar voor admins" : "Admins only"}
        </p>
      </div>

      {error && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", borderRadius: 4, padding: "10px 14px", marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loaded ? (
        <p className="arco-body-text" style={{ color: "#a1a1a0" }}>…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 920 }}>
          {links.length > 0 && (
            <div style={{ ...grid, padding: "0 4px" }} aria-hidden>
              <span className="arco-eyebrow">{nl ? "Merk" : "Brand"}</span>
              <span className="arco-eyebrow">{nl ? "Serie" : "Series"}</span>
              <span className="arco-eyebrow">{nl ? "Ruimte" : "Room"}</span>
              <span className="arco-eyebrow">{nl ? "Notitie" : "Note"}</span>
              <span />
            </div>
          )}

          {links.map((l) => {
            const options = familiesOf(l.brandId)
            return (
              <div key={l.id} style={{ ...grid, border: "1px solid #e5e5e4", borderRadius: 4, padding: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.brandName}</span>
                  {l.photoId && (
                    <span className="arco-eyebrow" style={{ color: "#016D75" }} title={nl ? "Aangewezen op een foto" : "Pinned to a photo"}>
                      {nl ? "foto" : "photo"}
                    </span>
                  )}
                </div>
                <select
                  style={field}
                  value={l.familyId ?? ""}
                  disabled={pending || options.length === 0}
                  onChange={(e) => patch(l.id, { familyId: e.target.value || null })}
                >
                  <option value="">{options.length === 0 ? (nl ? "geen series bekend" : "no series known") : (nl ? "— serie —" : "— series —")}</option>
                  {options.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <select
                  style={field}
                  value={l.spaceId ?? ""}
                  disabled={pending}
                  onChange={(e) => patch(l.id, { spaceId: e.target.value || null })}
                >
                  <option value="">{nl ? "— ruimte —" : "— room —"}</option>
                  {spaces.map((s) => <option key={s.id} value={s.id}>{spaceLabel(s.slug)}</option>)}
                </select>
                <input
                  style={field}
                  defaultValue={l.note ?? ""}
                  placeholder={nl ? "bijv. sospeso, brons" : "e.g. pendant, bronze"}
                  disabled={pending}
                  onBlur={(e) => { if ((e.target.value || "") !== (l.note ?? "")) patch(l.id, { note: e.target.value }) }}
                />
                <button
                  type="button"
                  onClick={() => remove(l.id)}
                  disabled={pending}
                  aria-label={nl ? "Verwijderen" : "Remove"}
                  style={{ height: 36, width: 36, display: "grid", placeItems: "center", border: "1px solid #e5e5e4", borderRadius: 4, background: "#fff", color: "#8c8c8a", cursor: "pointer" }}
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}

          <div style={{ ...grid, border: "1px dashed #d4d4d2", borderRadius: 4, padding: 8 }}>
            <select
              style={field}
              value={draftBrandId}
              disabled={pending}
              onChange={(e) => { setDraftBrandId(e.target.value); setDraftFamilyId("") }}
            >
              <option value="">{nl ? "— kies een merk —" : "— pick a brand —"}</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select
              style={field}
              value={draftFamilyId}
              disabled={pending || !draftBrandId || familiesOf(draftBrandId).length === 0}
              onChange={(e) => setDraftFamilyId(e.target.value)}
            >
              <option value="">
                {!draftBrandId
                  ? (nl ? "— serie —" : "— series —")
                  : familiesOf(draftBrandId).length === 0
                    ? (nl ? "geen series bekend" : "no series known")
                    : (nl ? "— serie (optioneel) —" : "— series (optional) —")}
              </option>
              {familiesOf(draftBrandId).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select style={field} value={draftSpaceId} disabled={pending} onChange={(e) => setDraftSpaceId(e.target.value)}>
              <option value="">{nl ? "— ruimte —" : "— room —"}</option>
              {spaces.map((s) => <option key={s.id} value={s.id}>{spaceLabel(s.slug)}</option>)}
            </select>
            <input
              style={field}
              value={draftNote}
              placeholder={nl ? "bijv. sospeso, brons" : "e.g. pendant, bronze"}
              disabled={pending}
              onChange={(e) => setDraftNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
            />
            <button
              type="button"
              onClick={add}
              disabled={pending || !draftBrandId || draftExists}
              aria-label={nl ? "Toevoegen" : "Add"}
              title={draftExists ? (nl ? "Staat er al op" : "Already linked") : undefined}
              className="btn-primary"
              style={{ height: 36, width: 36, padding: 0, display: "grid", placeItems: "center" }}
            >
              <Plus size={14} />
            </button>
          </div>

          <p className="arco-body-text" style={{ fontSize: 12, color: "#a1a1a0", marginTop: 4 }}>
            {nl
              ? "Ontbreekt een merk of serie? Voeg het toe onder Admin → Brands; daarna staat het hier in de lijst."
              : "Missing a brand or series? Add it under Admin → Brands; it then appears in this list."}
          </p>
        </div>
      )}
    </section>
  )
}
