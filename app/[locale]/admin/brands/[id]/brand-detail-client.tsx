"use client"

import { LocationCards } from "@/components/locations/location-cards"
import { ShowroomPicker } from "@/components/showroom-picker"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ImageIcon, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { handlePlainTextPaste, handlePlainTextDrop } from "@/lib/plain-text-paste"
import {
  deleteProductCollection,
  updateBrand,
  updateBrandCategories,
  updateBrandStatus,
  updateProductCollection,
  uploadBrandLogo,
  uploadProductCollectionImage,
  upsertProductCollection,
  saveBrandLocation,
  uploadBrandLocationPhoto,
  deleteBrandLocation,
} from "../actions"
import { EDIT_PAGE_CSS, EditBadge, PILL, scrollToSection } from "../edit-chrome"
import { LocationPopup } from "@/components/location-form"
import { locationKindLabel, type LocationRecord } from "@/lib/locations/types"
import { ALL_STATUSES, STATUS_DESC, STATUS_DOT, STATUS_LABEL, type BrandStatus } from "../status"
import { BrandLogo } from "@/components/brand/brand-logo"
import { CollectionSub } from "@/components/catalog/collection-sub"

/**
 * Merkpagina voor admins, gebouwd als de bedrijfspagina
 * (components/company-edit/company-edit-client.tsx): dezelfde kop, dezelfde
 * detailbalk, dezelfde kaarten, dezelfde contactrij. Wat bij een bedrijf
 * de dienst is ("Architect") is bij een merk de categorie ("Lighting");
 * wat daar de projecten zijn, zijn hier de collecties.
 *
 * Alles slaat op blur op, per veld; de pagina ververst daarna (router
 * .refresh) zodat de teller in de balk en de tabel elders kloppen. Een
 * collectie heeft een eigen pagina (collection/[collectionId]); hier staan de kaarten.
 */

export type BrandEditBrand = {
  id: string
  slug: string
  name: string
  domain: string | null
  website: string | null
  logo_url: string | null
  description: string | null
  country: string | null
  founded_year: number | null
  status: BrandStatus
}

export type BrandEditCollection = {
  id: string
  slug: string
  name: string
  description: string | null
  hero_image_url: string | null
  designer: string | null
  launch_year: number | null
  url: string | null
  /** Soorten van de collectie (Fauteuils · Banken …), alleen te wijzigen op de collectiepagina. */
  kinds_label: string | null
}

export type BrandEditCategory = {
  id: string
  slug: string
  name: string
  parentId: string | null
  orderIndex: number
}

export type BrandEditApplied = {
  id: string
  note: string | null
  photoId: string | null
  project: { id: string; title: string; status: string; city: string | null }
  collectionName: string | null
  spaceName: string | null
}

type Props = {
  brand: BrandEditBrand
  collections: BrandEditCollection[]
  categories: BrandEditCategory[]
  /** Gekozen categorieën, op positie: de eerste is de primaire. */
  categoryIds: string[]
  /** Categorieën volgen de collecties: niet met de hand te wijzigen. */
  categoriesAuto: boolean
  applied: BrandEditApplied[]
  /** Eigen showrooms van het merk. */
  locations: LocationRecord[]
}

// ── Sub-nav: sections left, status and preview right ───────────────────

const SECTIONS = [
  { id: "header", label: "Details" },
  { id: "collections", label: "Collections" },
  { id: "applied", label: "Projects" },
  { id: "showrooms", label: "Showrooms" },
] as const

function BrandEditSubNav({ status, previewHref, onStatusClick }: { status: BrandStatus; previewHref: string; onStatusClick: () => void }) {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [scrollDirection, setScrollDirection] = useState<"down" | "up">("down")
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY
      setScrollDirection(y > lastScrollY.current ? "down" : "up")
      lastScrollY.current = y
      let active: string | null = null
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= window.innerHeight / 3 && rect.bottom >= 0) active = id
      }
      setActiveSection(active)
    }
    let timeout: ReturnType<typeof setTimeout>
    const debounced = () => { clearTimeout(timeout); timeout = setTimeout(handleScroll, 10) }
    window.addEventListener("scroll", debounced, { passive: true })
    handleScroll()
    return () => { window.removeEventListener("scroll", debounced); clearTimeout(timeout) }
  }, [])

  const linkClass = (id: string) =>
    `sub-nav-link arco-eyebrow${activeSection === id ? (scrollDirection === "down" ? " active" : " active-reverse") : ""}`

  return (
    <div className="sub-nav" data-direction={scrollDirection}>
      <div className="wrap">
        <div className="sub-nav-content">
          <div className="sub-nav-left">
            <div className="sub-nav-links" style={{ paddingRight: 0, marginRight: 0 }}>
              {SECTIONS.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={linkClass(id)}
                  onClick={(e) => { e.preventDefault(); scrollToSection(id === "header" ? "header-anchor" : id) }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
          <div className="sub-nav-actions">
            <button type="button" className="filter-pill" onClick={onStatusClick}>
              <span className="inline-block rounded-full" style={{ width: 7, height: 7, flexShrink: 0, background: STATUS_DOT[status] }} />
              {STATUS_LABEL[status]}
            </button>
            {/* Het voorbeeld is de publieke merkpagina, zoals op de projectbewerkpagina. */}
            <a className="filter-pill" href={previewHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 6L11 2L7 2M11 2L5 8M6 3H3C1.89543 3 1 3.89543 1 5V12C1 13.1046 1.89543 14 3 14H10C11.1046 14 12 13.1046 12 12V9" />
              </svg>
              <span className="sub-nav-pill-label">Preview</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Collection card (the ListingCard of a collection) ──────────────────────────

function CollectionCard({
  collection, menuOpen, onMenuOpenChange, onEdit, onChangeCover, onDelete,
}: {
  collection: BrandEditCollection
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  onEdit: () => void
  onChangeCover: () => void
  onDelete: () => void
}) {
  // Zoals de publieke kaart: soorten · designer. Beide komen van de collectiepagina en worden alleen daar ingevuld; zonder waarde blijft de regel weg.
  const hasMeta = Boolean(collection.kinds_label || collection.designer)
  const actions = [
    { key: "edit", label: "Edit collection", run: onEdit },
    { key: "cover", label: "Change cover", run: onChangeCover },
    ...(collection.url ? [{ key: "open", label: "Open at the brand", run: () => window.open(collection.url!, "_blank", "noopener,noreferrer") }] : []),
    { key: "delete", label: "Delete collection", run: onDelete, destructive: true },
  ]

  return (
    <div
      className="discover-card"
      style={{ position: "relative", cursor: "pointer" }}
      onClick={(e) => { if (!(e.target as Element).closest(".dropdown-menu")) onEdit() }}
    >
      <div
        className="discover-card-image-wrap"
        style={{ position: "relative" }}
        onMouseEnter={(e) => {
          const overlay = e.currentTarget.querySelector<HTMLElement>(".collection-card-hover-overlay")
          const pill = e.currentTarget.querySelector<HTMLElement>(".collection-card-hover-pill")
          if (overlay) overlay.style.background = "rgba(0,0,0,.35)"
          if (pill) pill.style.opacity = "1"
        }}
        onMouseLeave={(e) => {
          const overlay = e.currentTarget.querySelector<HTMLElement>(".collection-card-hover-overlay")
          const pill = e.currentTarget.querySelector<HTMLElement>(".collection-card-hover-pill")
          if (overlay) overlay.style.background = "transparent"
          if (pill) pill.style.opacity = "0"
        }}
      >
        <div className="discover-card-image-layer">
          {collection.hero_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={collection.hero_image_url} alt={collection.name} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8c8c6", background: "var(--arco-surface)" }}>
              <ImageIcon size={32} />
            </div>
          )}
        </div>
        <div
          className="collection-card-hover-overlay"
          style={{ position: "absolute", inset: 0, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", transition: "background .2s", pointerEvents: "none" }}
        >
          <span className="collection-card-hover-pill" style={{ ...PILL, background: "rgba(0,0,0,.6)", opacity: 0, transition: "opacity .2s" }}>
            Edit collection
          </span>
        </div>
      </div>

      <div className="dropdown-menu" style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="filter-pill"
          onClick={() => onMenuOpenChange(!menuOpen)}
          data-open={menuOpen ? "true" : undefined}
          aria-label="Collection options"
          style={{ padding: "6px 8px", gap: 0 }}
        >
          <MoreHorizontal style={{ width: 16, height: 16 }} />
        </button>
        <div className="filter-dropdown" data-open={menuOpen ? "true" : undefined} data-align="right" style={{ minWidth: 180, top: "calc(100% + 6px)" }}>
          {actions.map(({ key, label, run, destructive }) => (
            <div
              key={key}
              className={`filter-dropdown-option${destructive ? " filter-dropdown-option--destructive" : ""}`}
              onClick={() => { onMenuOpenChange(false); run() }}
              role="menuitem"
            >
              <span className="filter-dropdown-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <h3 className="discover-card-title">{collection.name}</h3>
      {hasMeta && <CollectionSub kinds={collection.kinds_label} designer={collection.designer} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════

export function BrandEditClient({ brand, collections, categories, categoryIds, categoriesAuto, applied, locations }: Props) {
  const [locPopup, setLocPopup] = useState<{ open: boolean; editing: LocationRecord | null }>({ open: false, editing: null })
  const [locSaving, setLocSaving] = useState(false)
  const router = useRouter()

  // ── Header state ──
  const [name, setName] = useState(brand.name)
  const [description, setDescription] = useState(brand.description ?? "")
  const [activeEditField, setActiveEditField] = useState<"name" | "desc" | "website" | null>(null)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  // ── Categories ──
  const [selectedCats, setSelectedCats] = useState<string[]>(categoryIds)
  const [catOpen, setCatOpen] = useState(false)
  const catSnapshotRef = useRef<string[]>(categoryIds)
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  // Hoofdcategorie, dan haar subcategorieën, in volgorde van order_index.
  const categoryRows = useMemo(() => {
    const parents = categories.filter((c) => !c.parentId).sort((a, b) => a.orderIndex - b.orderIndex)
    const rows: Array<{ cat: BrandEditCategory; child: boolean }> = []
    for (const p of parents) {
      rows.push({ cat: p, child: false })
      for (const c of categories.filter((c) => c.parentId === p.id).sort((a, b) => a.orderIndex - b.orderIndex)) rows.push({ cat: c, child: true })
    }
    return rows
  }, [categories])
  const catLabel = selectedCats.map((id) => catById.get(id)?.name).filter(Boolean).join(" · ")

  // ── Specs bar ──
  const [country, setCountry] = useState(brand.country ?? "")
  const [foundedYear, setFoundedYear] = useState<string>(brand.founded_year ? String(brand.founded_year) : "")
  const [editingSpecBar, setEditingSpecBar] = useState<"country" | "founded" | "website" | null>(null)
  const countryRef = useRef<HTMLInputElement | null>(null)
  const foundedRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (editingSpecBar === "country") countryRef.current?.focus()
    if (editingSpecBar === "founded") foundedRef.current?.focus()
  }, [editingSpecBar])

  // ── Contact ──
  const [website, setWebsite] = useState(brand.website ?? "")

  // ── Status ──
  const [statusOpen, setStatusOpen] = useState(false)
  const [statusValue, setStatusValue] = useState<BrandStatus>(brand.status)
  const [statusSaving, setStatusSaving] = useState(false)

  // ── Collection ──
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BrandEditCollection | null>(null)
  const [deleting, setDeleting] = useState(false)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const coverTargetRef = useRef<BrandEditCollection | null>(null)

  // Het kaartmenu sluit bij een klik erbuiten — zoals op de bedrijfspagina.
  useEffect(() => {
    if (!menuOpenId) return
    const onDown = (e: MouseEvent) => { if (!(e.target as Element).closest(".dropdown-menu")) setMenuOpenId(null) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [menuOpenId])

  const projectCount = useMemo(() => new Set(applied.map((a) => a.project.id)).size, [applied])

  // ── Saves ─────────────────────────────────────────────────────────────

  const saveBrand = async (patch: Parameters<typeof updateBrand>[1], okMessage = "Saved") => {
    const result = await updateBrand(brand.id, patch)
    if ("error" in result) toast.error(result.error)
    else toast.success(okMessage)
    router.refresh()
  }

  const handleNameBlur = (e: React.FocusEvent<HTMLHeadingElement>) => {
    setActiveEditField(null)
    const val = e.currentTarget.textContent?.trim() ?? ""
    if (!val) {
      e.currentTarget.textContent = name
      toast.error("Name can't be empty")
      return
    }
    if (val !== name) { setName(val); void saveBrand({ name: val }) }
  }

  const handleDescBlur = (e: React.FocusEvent<HTMLParagraphElement>) => {
    setActiveEditField(null)
    const val = e.currentTarget.textContent?.trim() ?? ""
    if (val !== description) { setDescription(val); void saveBrand({ description: val }) }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (logoInputRef.current) logoInputRef.current.value = ""
    if (!file) return
    const fd = new FormData()
    fd.append("file", file)
    const result = await uploadBrandLogo(brand.id, fd)
    if ("error" in result) toast.error(result.error)
    else { toast.success("Logo updated"); router.refresh() }
  }

  const openCats = () => { catSnapshotRef.current = [...selectedCats]; setCatOpen(true) }
  const closeCats = async () => {
    setCatOpen(false)
    const before = catSnapshotRef.current
    const same = before.length === selectedCats.length && before.every((id, i) => id === selectedCats[i])
    if (same) return
    const result = await updateBrandCategories(brand.id, selectedCats)
    if ("error" in result) { toast.error(result.error); setSelectedCats(before) }
    else toast.success("Saved")
    router.refresh()
  }
  const toggleCat = (id: string) => {
    setSelectedCats((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const commitWebsite = (raw: string) => {
    setActiveEditField(null)
    setEditingSpecBar(null)
    const val = raw.trim()
    if (val === website) return
    setWebsite(val)
    void saveBrand({ website: val || null })
  }

  const saveStatus = async () => {
    setStatusSaving(true)
    const result = await updateBrandStatus(brand.id, statusValue)
    setStatusSaving(false)
    if ("error" in result) { toast.error(result.error); return }
    toast.success(`${brand.name} → ${STATUS_LABEL[statusValue]}`)
    setStatusOpen(false)
    router.refresh()
  }

  // Collection
  const createCollection = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setCreating(true)
    const result = await upsertProductCollection(brand.id, trimmed)
    setCreating(false)
    if ("error" in result) { toast.error(result.error); return }
    toast.success(`Added ${result.name}`)
    setNewName(""); setShowCreate(false)
    router.push(`/admin/brands/${brand.id}/collections/${result.id}`)
  }

  // Een collectie heeft een eigen pagina onder het merk — de kaart gaat
  // erheen, zoals een projectkaart naar de projecteditor.
  const openCollection = (collection: BrandEditCollection) => router.push(`/admin/brands/${brand.id}/collections/${collection.id}`)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteProductCollection(deleteTarget.id)
    setDeleting(false)
    if ("error" in result) { toast.error(result.error); return }
    toast.success(`Deleted ${deleteTarget.name}`)
    setDeleteTarget(null)
    router.refresh()
  }

  const pickCover = (collection: BrandEditCollection) => { coverTargetRef.current = collection; coverInputRef.current?.click() }
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const collection = coverTargetRef.current
    if (coverInputRef.current) coverInputRef.current.value = ""
    coverTargetRef.current = null
    if (!file || !collection) return
    const fd = new FormData()
    fd.append("file", file)
    const result = await uploadProductCollectionImage(collection.id, fd)
    if ("error" in result) toast.error(result.error)
    else { toast.success("Cover updated"); router.refresh() }
  }

  const specYear = new Date().getFullYear()

  return (
    <>
      <style>{EDIT_PAGE_CSS}</style>

      <BrandEditSubNav status={brand.status} previewHref={`/brands/${brand.slug}`} onStatusClick={() => { setStatusValue(brand.status); setStatusOpen(true) }} />

      {/* ════════════════════ HEADER ════════════════════ */}
      {/* Zonder "← All brands": de pagina is alleen voor admins, die via het
          menu terug kunnen. Kop op dezelfde afstand als company edit. */}
      <div className="wrap" style={{ marginTop: 120, marginBottom: 60 }} id="header">
        <section className="professional-header">
          {/* Logo */}
          <div className="company-icon ec" onClick={() => logoInputRef.current?.click()} style={{ display: "inline-block" }}>
            <EditBadge />
            <BrandLogo logoUrl={brand.logo_url} name={name} />
            <input ref={logoInputRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={handleLogoUpload} />
          </div>

          <div id="header-anchor" />

          {/* Name */}
          <div className={`ec${activeEditField === "name" ? " on" : ""}`}>
            <EditBadge />
            <h1
              className="arco-page-title"
              contentEditable
              suppressContentEditableWarning
              onPaste={handlePlainTextPaste}
              onDrop={handlePlainTextDrop}
              onFocus={() => setActiveEditField("name")}
              onBlur={handleNameBlur}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur() } }}
              data-placeholder="Brand name"
            >
              {name}
            </h1>
          </div>

          {/* Categories — what the brand makes; the service line of a company.
              Zodra de collecties soorten hebben volgen de categorieën die
              (groep per soort, maximaal drie) en is er niets te wijzigen. */}
          {categoriesAuto ? (
            <p className="professional-badge" title="Set from the kinds of the collections" style={{ marginTop: 12, marginBottom: 24 }}>
              {catLabel || "—"}
            </p>
          ) : (
          <div
            className={`ec ec--inline${catOpen ? " on" : ""}`}
            onClick={() => { if (!catOpen) openCats() }}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 24 }}
          >
            <p className="professional-badge service-popup-badge" style={{ margin: 0, cursor: "pointer", ...(selectedCats.length === 0 ? { color: "var(--primary)" } : undefined) }}>
              {catLabel || "Add categories"}
            </p>
            <span className="ec-badge ec-badge--inline">
              <span className="ec-ico">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </span>
              <span className="ec-txt">Edit</span>
            </span>
            {catOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={(e) => { e.stopPropagation(); void closeCats() }} />
                <div className="dd-panel" style={{ maxHeight: 320, overflowY: "auto", minWidth: 240, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
                  {categoryRows.map(({ cat, child }) => {
                    const sel = selectedCats.includes(cat.id)
                    return (
                      <div key={cat.id} className={`dd-row${sel ? " sel" : ""}${child ? " child" : ""}`} onClick={(e) => { e.stopPropagation(); toggleCat(cat.id) }}>
                        <span>{cat.name}</span>
                        {sel && <span className="dd-check">✓</span>}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          )}

          {/* Description */}
          <div className={`ec${activeEditField === "desc" ? " on" : ""}`}>
            <EditBadge />
            <p
              className="arco-body-text"
              contentEditable
              suppressContentEditableWarning
              onPaste={(e) => handlePlainTextPaste(e, { multiline: true })}
              onDrop={(e) => handlePlainTextDrop(e, { multiline: true })}
              onFocus={() => setActiveEditField("desc")}
              onBlur={handleDescBlur}
              data-placeholder="Add a short description of this brand."
              style={{ minHeight: 40, margin: 0 }}
            >
              {description}
            </p>
          </div>
        </section>

        {/* ════════════════════ DETAILS BAR ════════════════════ */}
        <div className="edit-specs-bar" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 32, padding: "32px 0", borderTop: "1px solid #e8e8e6", borderBottom: "1px solid #e8e8e6" }}>
          {/* Country */}
          <div
            className={`spec-item-edit${editingSpecBar === "country" ? " editing" : ""}`}
            onClick={() => { if (editingSpecBar !== "country") setEditingSpecBar("country") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Country</span>
            <input
              ref={countryRef}
              type="text"
              className="spec-inp-inline"
              value={country}
              readOnly={editingSpecBar !== "country"}
              placeholder="Add country"
              onChange={(e) => setCountry(e.target.value)}
              onBlur={(e) => {
                const val = e.target.value.trim()
                setCountry(val)
                setEditingSpecBar(null)
                if (val !== (brand.country ?? "")) void saveBrand({ country: val || null })
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              onClick={(e) => { if (editingSpecBar === "country") e.stopPropagation() }}
            />
          </div>

          {/* Founded */}
          <div
            className={`spec-item-edit${editingSpecBar === "founded" ? " editing" : ""}`}
            onClick={() => { if (editingSpecBar !== "founded") setEditingSpecBar("founded") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Founded</span>
            <input
              ref={foundedRef}
              type="number"
              className="spec-inp-inline"
              value={foundedYear}
              readOnly={editingSpecBar !== "founded"}
              placeholder="Add year"
              min={1500}
              max={specYear}
              onChange={(e) => setFoundedYear(e.target.value)}
              onBlur={(e) => {
                const val = e.target.value.trim()
                setFoundedYear(val)
                setEditingSpecBar(null)
                const year = val ? parseInt(val, 10) : null
                if (year !== brand.founded_year) void saveBrand({ founded_year: year })
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              onClick={(e) => { if (editingSpecBar === "founded") e.stopPropagation() }}
            />
          </div>

          {/* Collection — read-only, scrolls to the section */}
          <div className="spec-item-edit" style={{ cursor: "pointer" }} onClick={() => scrollToSection("collections")}>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Collections</span>
            <span className="spec-inp-inline" style={{ display: "block", color: collections.length > 0 ? undefined : "#b0b0ae" }}>
              {collections.length > 0 ? collections.length : "—"}
            </span>
          </div>

          {/* In projects — read-only, scrolls to the section */}
          <div className="spec-item-edit" style={{ cursor: "pointer" }} onClick={() => scrollToSection("applied")}>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>In projects</span>
            <span className="spec-inp-inline" style={{ display: "block", color: projectCount > 0 ? undefined : "#b0b0ae" }}>
              {projectCount > 0 ? projectCount : "—"}
            </span>
          </div>

          {/* Website — laatste in de balk, zoals bij bedrijven; het contactblok
              onderaan is weg. Het domein (de sleutel die het merk herkent)
              staat eronder als het van de website afwijkt. */}
          {(() => {
            const host = website ? website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "") : ""
            const href = website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null
            return (
              <div
                className={`spec-item-edit${editingSpecBar === "website" ? " editing" : ""}`}
                onClick={() => { if (editingSpecBar !== "website") setEditingSpecBar("website") }}
              >
                <EditBadge />
                <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Website</span>
                {editingSpecBar === "website" ? (
                  <input
                    autoFocus
                    type="url"
                    className="spec-inp-inline"
                    defaultValue={website}
                    placeholder="https://…"
                    onBlur={(e) => commitWebsite(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur()
                      if (e.key === "Escape") { e.currentTarget.value = website; e.currentTarget.blur() }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="spec-inp-inline" style={{ display: "block", color: website ? undefined : "#b0b0ae", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-link-plain" onClick={(e) => e.stopPropagation()}>{host} →</a>
                    ) : "Add website"}
                  </span>
                )}
                {brand.domain && brand.domain !== host && (
                  <span className="text-[11px] text-[#a1a1a0]" style={{ display: "block", marginTop: 4 }} title="Set when the brand was added; recognises it if added again.">Domain: {brand.domain}</span>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* ════════════════════ COLLECTION ════════════════════ */}
      <section id="collections" style={{ marginBottom: 60 }}>
        <div className="wrap">
          <div className="section-header">
            <h2 className="arco-section-title">Collections</h2>
            {collections.length > 0 && (
              <button type="button" className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }} onClick={() => setShowCreate(true)}>
                Add collection
              </button>
            )}
          </div>
          <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleCoverChange} />
          {collections.length > 0 ? (
            <div className="discover-grid">
              {collections.map((collection) => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                  menuOpen={menuOpenId === collection.id}
                  onMenuOpenChange={(open) => setMenuOpenId(open ? collection.id : null)}
                  onEdit={() => openCollection(collection)}
                  onChangeCover={() => pickCover(collection)}
                  onDelete={() => setDeleteTarget(collection)}
                />
              ))}
            </div>
          ) : (
            <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "80px 24px", textAlign: "center" }}>
              <p className="arco-eyebrow" style={{ marginBottom: 16 }}>No collections yet</p>
              <h2 className="arco-section-title" style={{ marginBottom: 12 }}>Add the collections this brand is known for</h2>
              <p className="arco-body-text" style={{ maxWidth: 400, margin: "0 auto 32px" }}>
                A collection is what architects specify and what a photo shows — Mito, Spa, Tobi-Ishi. No individual products.
              </p>
              <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>Add collection</button>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════ APPLIED IN PROJECTS ════════════════════ */}
      <section id="applied" style={{ marginBottom: 60 }}>
        <div className="wrap">
          <div className="section-header" style={{ marginBottom: 8 }}>
            <h2 className="arco-section-title">Projects</h2>
          </div>
          <p className="arco-body-text" style={{ color: "#8c8c8a", marginBottom: 24, maxWidth: 600 }}>
            Tagged from the project editor (admins only for now). Brand, collection and room; which photo comes later.
          </p>
          {applied.length === 0 ? (
            <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "48px 24px", textAlign: "center" }}>
              <p className="arco-body-text" style={{ color: "#a1a1a0", margin: 0 }}>Not tagged on any project yet.</p>
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, maxWidth: 820 }}>
              {applied.map((l) => (
                <li key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 150px 130px 1fr 110px", gap: 12, alignItems: "center", border: "1px solid #e5e5e4", borderRadius: 4, padding: "10px 12px", fontSize: 13 }}>
                  <Link href={`/dashboard/edit/${l.project.id}`} style={{ fontWeight: 500, color: "#1c1c1a" }}>
                    {l.project.title}
                    {l.project.city ? <span style={{ color: "#8c8c8a", fontWeight: 400 }}> · {l.project.city}</span> : null}
                  </Link>
                  <span style={{ color: "#1c1c1a" }}>{l.collectionName ?? <span style={{ color: "#a1a1a0" }}>—</span>}</span>
                  <span style={{ color: "#8c8c8a" }}>{l.spaceName ?? "—"}</span>
                  <span style={{ color: "#8c8c8a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.note ?? ""}</span>
                  <span className="arco-eyebrow" style={{ color: l.photoId ? "#016D75" : "#a1a1a0", textAlign: "right" }}>
                    {l.photoId ? "photo pinned" : l.project.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ════════════════════ SHOWROOMS ════════════════════ */}
      <section id="showrooms" style={{ marginBottom: 60 }}>
        <div className="wrap">
          <div className="section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h2 className="arco-section-title">Showrooms</h2>
            <button type="button" className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }} onClick={() => setLocPopup({ open: true, editing: null })}>
              Add showroom
            </button>
          </div>
          <p className="arco-body-text" style={{ color: "#8c8c8a", marginBottom: 24, maxWidth: 600 }}>
            The brand&apos;s own stores and showrooms. Dealers&apos; showrooms live on their company pages; the brand page lists those companies under &quot;Where to buy&quot;.
          </p>
          {locations.length === 0 ? null : (
            <LocationCards
              mode="edit"
              locale="en"
              locations={locations}
              fallbackLogoUrl={brand.logo_url}
              onEdit={(loc) => setLocPopup({ open: true, editing: loc })}
              onUpload={async (loc, file) => {
                const fd = new FormData()
                fd.set("file", file)
                const res = await uploadBrandLocationPhoto(brand.id, loc.id, fd)
                if ("error" in res) { toast.error(res.error); return }
                toast.success("Photo saved")
                router.refresh()
              }}
            />
          )}
        </div>
      </section>

      {/* ════════════════════ POPUPS ════════════════════ */}

      {/* Showroom add/edit */}
      {locPopup.open && !locPopup.editing && (
        <ShowroomPicker
          suggestFor={brand.name}
          existingPlaceIds={locations.map((l) => l.googlePlaceId).filter((id): id is string => Boolean(id))}
          onAdd={async (inputs) => {
            setLocSaving(true)
            let ok = 0
            for (const input of inputs) {
              const res = await saveBrandLocation(brand.id, input)
              if ("error" in res) toast.error(res.error)
              else ok += 1
            }
            setLocSaving(false)
            if (ok > 0) toast.success(ok === 1 ? "Showroom added" : `${ok} showrooms added`)
            setLocPopup({ open: false, editing: null })
            router.refresh()
          }}
          onClose={() => !locSaving && setLocPopup({ open: false, editing: null })}
        />
      )}
      {locPopup.open && locPopup.editing && (
        <LocationPopup
          initial={locPopup.editing}
          saving={locSaving}
          onSave={(input) => {
            setLocSaving(true)
            void saveBrandLocation(brand.id, input).then((res) => {
              setLocSaving(false)
              if ("error" in res) { toast.error(res.error); return }
              toast.success("Showroom saved")
              setLocPopup({ open: false, editing: null })
              router.refresh()
            })
          }}
          onClose={() => !locSaving && setLocPopup({ open: false, editing: null })}
          onDelete={locPopup.editing ? () => {
            if (!window.confirm("Remove this showroom?")) return
            setLocSaving(true)
            void deleteBrandLocation(locPopup.editing!.id).then((res) => {
              setLocSaving(false)
              if ("error" in res) { toast.error(res.error); return }
              toast.success("Showroom removed")
              setLocPopup({ open: false, editing: null })
              router.refresh()
            })
          } : undefined}
        />
      )}

      {/* Add collection */}
      {showCreate && (
        <div className="popup-overlay" onClick={() => !creating && setShowCreate(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Add collection</h3>
              <button type="button" className="popup-close" onClick={() => !creating && setShowCreate(false)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 16 }}>
              The name the brand uses — Mito, Spa, Tobi-Ishi. Designer, year and cover come after.
            </p>
            <input
              type="text"
              autoFocus
              placeholder="Collection name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) void createCollection() }}
              className="input-base input-default"
              style={{ width: "100%", marginBottom: 20 }}
              disabled={creating}
            />
            <div className="popup-actions">
              <button type="button" className="btn-tertiary" onClick={() => setShowCreate(false)} disabled={creating} style={{ flex: 1 }}>Cancel</button>
              <button type="button" className="btn-secondary" onClick={() => void createCollection()} disabled={creating || !newName.trim()} style={{ flex: 1 }}>
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete collection */}
      {deleteTarget && (
        <div className="popup-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete {deleteTarget.name}?</h3>
              <button type="button" className="popup-close" onClick={() => !deleting && setDeleteTarget(null)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 20 }}>
              Projects tagged with this collection keep the brand; the collection on them is cleared.
            </p>
            <div className="popup-actions">
              <button type="button" className="btn-tertiary" onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ flex: 1 }}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1, background: "var(--destructive)" }} onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete collection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      {statusOpen && (
        <div className="popup-overlay" onClick={() => !statusSaving && setStatusOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{brand.name}</h3>
              <button type="button" className="popup-close" onClick={() => !statusSaving && setStatusOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="status-modal-options">
              {ALL_STATUSES.map((s) => (
                <button key={s} type="button" className={`status-modal-option${statusValue === s ? " selected" : ""}`} onClick={() => setStatusValue(s)}>
                  <span className="status-modal-dot" style={{ background: STATUS_DOT[s] }} />
                  <div className="status-modal-option-text">
                    <span className="status-modal-option-label">{STATUS_LABEL[s]}</span>
                    <span className="arco-table-secondary" style={{ display: "block", marginTop: 2 }}>{STATUS_DESC[s]}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="popup-actions" style={{ marginTop: 20 }}>
              <button type="button" className="btn-tertiary" style={{ flex: 1 }} onClick={() => setStatusOpen(false)} disabled={statusSaving}>Cancel</button>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => void saveStatus()} disabled={statusSaving || statusValue === brand.status}>
                {statusSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
