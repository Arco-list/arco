"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useLocale } from "next-intl"
import { BrandPickerPopup, BrandTileList, type BrandPickCategory, type BrandPickOption } from "@/components/brand/brand-picker"

import {
  addProjectBrandAction,
  loadProjectBrandsEditorAction,
  removeProjectBrandAction,
  type BrandCategoryOption,
  type BrandOption,
  type ProjectBrandRow,
} from "./brand-actions"

/**
 * Merken en collecties op dit project — admin-only, fase 1 van de merkenlaag.
 *
 * Merk + optioneel collectie + ruimte als hint + vrije notitie. Geen product,
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

  const [brands, setBrands] = useState<BrandOption[]>([])
  const [categories, setCategories] = useState<BrandCategoryOption[]>([])
  const [links, setLinks] = useState<ProjectBrandRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let alive = true
    void loadProjectBrandsEditorAction(projectId).then((res) => {
      if (!alive) return
      if ("error" in res) { setError(res.error); setLoaded(true); return }
      setBrands(res.brands)
      setCategories(res.categories)
      setLinks(res.links)
      setLoaded(true)
    })
    return () => { alive = false }
  }, [projectId])

  // Pills zoals in de bedrijfseditor: de hoofdcategorie van elke categorie
  // van een merk, gesorteerd op het aantal merken.
  const { options, filterCategories } = useMemo(() => {
    const parentById = new Map(categories.map((c) => [c.id, c.parentId]))
    const rootOf = (id: string) => {
      let cur = id
      for (let i = 0; i < 6; i++) { const p = parentById.get(cur); if (!p) break; cur = p }
      return cur
    }
    const opts: BrandPickOption[] = brands.map((b) => ({ id: b.id, name: b.name, logoUrl: b.logoUrl, categoryIds: Array.from(new Set(b.categoryIds.map(rootOf))) }))
    const count = new Map<string, number>()
    for (const o of opts) for (const id of o.categoryIds ?? []) count.set(id, (count.get(id) ?? 0) + 1)
    const byId = new Map(categories.map((c) => [c.id, c]))
    const cats: BrandPickCategory[] = Array.from(count.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter((c): c is BrandCategoryOption => Boolean(c))
      .map((c) => ({ id: c.id, name: c.name, nameNl: c.nameNl }))
    return { options: opts, filterCategories: cats }
  }, [brands, categories])

  const linkedBrandIds = useMemo(() => new Set(links.map((l) => l.brandId)), [links])
  const selectedBrands = options.filter((o) => linkedBrandIds.has(o.id))

  const add = (brandId: string) => {
    setError(null)
    setBusy(brandId)
    startTransition(async () => {
      const res = await addProjectBrandAction(projectId, brandId, null, null, null)
      setBusy(null)
      if ("error" in res) { setError(res.error); return }
      setLinks((prev) => (prev.some((l) => l.id === res.link.id) ? prev.map((l) => (l.id === res.link.id ? res.link : l)) : [...prev, res.link]))
    })
  }

  const addMany = (list: BrandPickOption[]) => {
    setError(null)
    startTransition(async () => {
      for (const o of list) {
        const res = await addProjectBrandAction(projectId, o.id, null, null, null)
        if ("error" in res) { setError(res.error); continue }
        setLinks((prev) => (prev.some((l) => l.id === res.link.id) ? prev : [...prev, res.link]))
      }
    })
  }

  // Een merk kan met meerdere collecties op het project staan (oude rijen);
  // weghalen ruimt dan alle rijen van het merk op.
  const remove = (brandId: string) => {
    setError(null)
    const ids = links.filter((l) => l.brandId === brandId).map((l) => l.id)
    startTransition(async () => {
      for (const id of ids) {
        const res = await removeProjectBrandAction(id)
        if ("error" in res) { setError(res.error); return }
      }
      setLinks((prev) => prev.filter((l) => l.brandId !== brandId))
    })
  }

  return (
    <section id="brands" className="wrap" style={{ paddingTop: 0, paddingBottom: 120 }}>
      {/* Zoals Merken in de bedrijfseditor: titel en intro als één blok,
          de knop ernaast, daaronder de gekozen merken als disc tiles. */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 className="arco-section-title">{nl ? "Merken" : "Brands"}</h2>
          <p className="arco-body-text" style={{ color: "#8c8c8a", marginTop: 6, marginBottom: 0, maxWidth: 600 }}>
            {nl ? "Welke merken zijn in dit project toegepast?" : "Which brands were used in this project?"}
          </p>
        </div>
        <button type="button" className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }} onClick={() => setOpen(true)} disabled={!loaded}>
          {nl ? "Merk toevoegen" : "Add brand"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", borderRadius: 4, padding: "10px 14px", marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      <BrandTileList brands={selectedBrands} onRemove={remove} />

      {open && (
        <BrandPickerPopup
          title={nl ? "Merk toevoegen" : "Add brand"}
          options={options}
          filterCategories={filterCategories}
          selectedIds={linkedBrandIds}
          busyId={busy}
          onAdd={(o) => add(o.id)}
          onRemove={remove}
          onAddMany={addMany}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  )
}
