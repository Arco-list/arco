"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ImageIcon, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { handlePlainTextPaste, handlePlainTextDrop } from "@/lib/plain-text-paste"
import {
  deleteProductFamily,
  updateBrand,
  updateBrandCategories,
  updateBrandStatus,
  updateProductFamily,
  uploadBrandLogo,
  uploadProductFamilyImage,
  upsertProductFamily,
  saveBrandLocation,
  deleteBrandLocation,
} from "../actions"
import { EDIT_PAGE_CSS, EditBadge, PILL, scrollToSection } from "../edit-chrome"
import { LocationPopup } from "@/components/location-form"
import { locationKindLabel, type LocationRecord } from "@/lib/locations/types"
import { ALL_STATUSES, STATUS_DESC, STATUS_DOT, STATUS_LABEL, type BrandStatus } from "../status"

/**
 * Merkpagina voor admins, gebouwd als de bedrijfspagina
 * (components/company-edit/company-edit-client.tsx): dezelfde kop, dezelfde
 * detailbalk, dezelfde kaarten, dezelfde contactrij. Wat bij een bedrijf
 * de dienst is ("Architect") is bij een merk de categorie ("Lighting");
 * wat daar de projecten zijn, zijn hier de series.
 *
 * Alles slaat op blur op, per veld; de pagina ververst daarna (router
 * .refresh) zodat de teller in de balk en de tabel elders kloppen. Een
 * serie heeft een eigen pagina (series/[familyId]); hier staan de kaarten.
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

export type BrandEditFamily = {
  id: string
  slug: string
  name: string
  description: string | null
  hero_image_url: string | null
  designer: string | null
  launch_year: number | null
  url: string | null
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
  familyName: string | null
  spaceName: string | null
}

type Props = {
  brand: BrandEditBrand
  families: BrandEditFamily[]
  categories: BrandEditCategory[]
  /** Gekozen categorieën, op positie: de eerste is de primaire. */
  categoryIds: string[]
  applied: BrandEditApplied[]
  /** Eigen showrooms van het merk. */
  locations: LocationRecord[]
}

// ── Sub-nav: sections left, status and website right ───────────────────

const SECTIONS = [
  { id: "header", label: "Details" },
  { id: "series", label: "Series" },
  { id: "applied", label: "Projects" },
  { id: "showrooms", label: "Showrooms" },
  { id: "contact", label: "Contact" },
] as const

function BrandEditSubNav({ status, website, onStatusClick }: { status: BrandStatus; website: string | null; onStatusClick: () => void }) {
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
            {website && (
              <a className="filter-pill" href={website} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 6L11 2L7 2M11 2L5 8M6 3H3C1.89543 3 1 3.89543 1 5V12C1 13.1046 1.89543 14 3 14H10C11.1046 14 12 13.1046 12 12V9" />
                </svg>
                <span className="sub-nav-pill-label">Website</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Series card (the ListingCard of a series) ──────────────────────────

function SeriesCard({
  family, menuOpen, onMenuOpenChange, onEdit, onChangeCover, onDelete,
}: {
  family: BrandEditFamily
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  onEdit: () => void
  onChangeCover: () => void
  onDelete: () => void
}) {
  const meta = [family.designer, family.launch_year].filter(Boolean).join(" · ")
  const actions = [
    { key: "edit", label: "Edit series", run: onEdit },
    { key: "cover", label: "Change cover", run: onChangeCover },
    ...(family.url ? [{ key: "open", label: "Open at the brand", run: () => window.open(family.url!, "_blank", "noopener,noreferrer") }] : []),
    { key: "delete", label: "Delete series", run: onDelete, destructive: true },
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
          const overlay = e.currentTarget.querySelector<HTMLElement>(".series-card-hover-overlay")
          const pill = e.currentTarget.querySelector<HTMLElement>(".series-card-hover-pill")
          if (overlay) overlay.style.background = "rgba(0,0,0,.35)"
          if (pill) pill.style.opacity = "1"
        }}
        onMouseLeave={(e) => {
          const overlay = e.currentTarget.querySelector<HTMLElement>(".series-card-hover-overlay")
          const pill = e.currentTarget.querySelector<HTMLElement>(".series-card-hover-pill")
          if (overlay) overlay.style.background = "transparent"
          if (pill) pill.style.opacity = "0"
        }}
      >
        <div className="discover-card-image-layer">
          {family.hero_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={family.hero_image_url} alt={family.name} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8c8c6", background: "var(--arco-surface)" }}>
              <ImageIcon size={32} />
            </div>
          )}
        </div>
        <div
          className="series-card-hover-overlay"
          style={{ position: "absolute", inset: 0, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", transition: "background .2s", pointerEvents: "none" }}
        >
          <span className="series-card-hover-pill" style={{ ...PILL, background: "rgba(0,0,0,.6)", opacity: 0, transition: "opacity .2s" }}>
            Edit series
          </span>
        </div>
      </div>

      <div className="dropdown-menu" style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="filter-pill"
          onClick={() => onMenuOpenChange(!menuOpen)}
          data-open={menuOpen ? "true" : undefined}
          aria-label="Series options"
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

      <h3 className="discover-card-title">{family.name}</h3>
      <p className="discover-card-sub" style={meta ? undefined : { color: "#b0b0ae" }}>{meta || "Add designer and year"}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════

export function BrandEditClient({ brand, families, categories, categoryIds, applied, locations }: Props) {
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
  const [editingSpecBar, setEditingSpecBar] = useState<"country" | "founded" | null>(null)
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

  // ── Series ──
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BrandEditFamily | null>(null)
  const [deleting, setDeleting] = useState(false)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const coverTargetRef = useRef<BrandEditFamily | null>(null)

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

  // Series
  const createFamily = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setCreating(true)
    const result = await upsertProductFamily(brand.id, trimmed)
    setCreating(false)
    if ("error" in result) { toast.error(result.error); return }
    toast.success(`Added ${result.name}`)
    setNewName(""); setShowCreate(false)
    router.push(`/admin/brands/${brand.id}/series/${result.id}`)
  }

  // Een serie heeft een eigen pagina onder het merk — de kaart gaat
  // erheen, zoals een projectkaart naar de projecteditor.
  const openSeries = (family: BrandEditFamily) => router.push(`/admin/brands/${brand.id}/series/${family.id}`)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteProductFamily(deleteTarget.id)
    setDeleting(false)
    if ("error" in result) { toast.error(result.error); return }
    toast.success(`Deleted ${deleteTarget.name}`)
    setDeleteTarget(null)
    router.refresh()
  }

  const pickCover = (family: BrandEditFamily) => { coverTargetRef.current = family; coverInputRef.current?.click() }
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const family = coverTargetRef.current
    if (coverInputRef.current) coverInputRef.current.value = ""
    coverTargetRef.current = null
    if (!file || !family) return
    const fd = new FormData()
    fd.append("file", file)
    const result = await uploadProductFamilyImage(family.id, fd)
    if ("error" in result) toast.error(result.error)
    else { toast.success("Cover updated"); router.refresh() }
  }

  const specYear = new Date().getFullYear()

  return (
    <>
      <style>{EDIT_PAGE_CSS}</style>

      <BrandEditSubNav status={brand.status} website={brand.website} onStatusClick={() => { setStatusValue(brand.status); setStatusOpen(true) }} />

      {/* ════════════════════ HEADER ════════════════════ */}
      <div className="wrap" style={{ marginTop: 40, marginBottom: 60 }} id="header">
        <Link href="/admin/brands" className="arco-small-text" style={{ display: "inline-block", marginBottom: 40 }}>
          ← All brands
        </Link>

        <section className="professional-header">
          {/* Logo */}
          <div className="company-icon ec" onClick={() => logoInputRef.current?.click()} style={{ display: "inline-block" }}>
            <EditBadge />
            {brand.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={name} className="company-icon-image" />
            ) : (
              <div className="company-icon-initials">{name.charAt(0).toUpperCase()}</div>
            )}
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

          {/* Categories — what the brand makes; the service line of a company. */}
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

          {/* Series — read-only, scrolls to the section */}
          <div className="spec-item-edit" style={{ cursor: "pointer" }} onClick={() => scrollToSection("series")}>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Series</span>
            <span className="spec-inp-inline" style={{ display: "block", color: families.length > 0 ? undefined : "#b0b0ae" }}>
              {families.length > 0 ? families.length : "—"}
            </span>
          </div>

          {/* In projects — read-only, scrolls to the section */}
          <div className="spec-item-edit" style={{ cursor: "pointer" }} onClick={() => scrollToSection("applied")}>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>In projects</span>
            <span className="spec-inp-inline" style={{ display: "block", color: projectCount > 0 ? undefined : "#b0b0ae" }}>
              {projectCount > 0 ? projectCount : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════════ SERIES ════════════════════ */}
      <section id="series" style={{ marginBottom: 60 }}>
        <div className="wrap">
          <div className="section-header">
            <h2 className="arco-section-title">Series</h2>
            {families.length > 0 && (
              <button type="button" className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }} onClick={() => setShowCreate(true)}>
                Add series
              </button>
            )}
          </div>
          <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleCoverChange} />
          {families.length > 0 ? (
            <div className="discover-grid">
              {families.map((family) => (
                <SeriesCard
                  key={family.id}
                  family={family}
                  menuOpen={menuOpenId === family.id}
                  onMenuOpenChange={(open) => setMenuOpenId(open ? family.id : null)}
                  onEdit={() => openSeries(family)}
                  onChangeCover={() => pickCover(family)}
                  onDelete={() => setDeleteTarget(family)}
                />
              ))}
            </div>
          ) : (
            <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "80px 24px", textAlign: "center" }}>
              <p className="arco-eyebrow" style={{ marginBottom: 16 }}>No series yet</p>
              <h2 className="arco-section-title" style={{ marginBottom: 12 }}>Add the series this brand is known for</h2>
              <p className="arco-body-text" style={{ maxWidth: 400, margin: "0 auto 32px" }}>
                A series is what architects specify and what a photo shows — Mito, Spa, Tobi-Ishi. No individual products.
              </p>
              <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>Add series</button>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════ APPLIED IN PROJECTS ════════════════════ */}
      <section id="applied" style={{ marginBottom: 60 }}>
        <div className="wrap">
          <div className="section-header" style={{ marginBottom: 8 }}>
            <h2 className="arco-section-title">Applied in projects</h2>
          </div>
          <p className="arco-body-text" style={{ color: "#8c8c8a", marginBottom: 24, maxWidth: 600 }}>
            Tagged from the project editor (admins only for now). Brand, series and room; which photo comes later.
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
                  <span style={{ color: "#1c1c1a" }}>{l.familyName ?? <span style={{ color: "#a1a1a0" }}>—</span>}</span>
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
          {locations.length === 0 ? (
            <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "48px 24px", textAlign: "center" }}>
              <p className="arco-body-text" style={{ color: "#a1a1a0", margin: 0 }}>No showrooms yet.</p>
            </div>
          ) : (
            <div className="contact-grid">
              {locations.map((loc) => {
                const street = loc.streetAddress ?? loc.address?.split(",")[0]?.trim() ?? null
                const cityLine = [loc.postalCode, loc.city].filter(Boolean).join(" ")
                return (
                  <button
                    key={loc.id}
                    type="button"
                    className="contact-card"
                    onClick={() => setLocPopup({ open: true, editing: loc })}
                    style={{ background: "none", border: "1px solid transparent", borderRadius: 6, padding: 12, margin: -12, cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#e5e5e4" }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent" }}
                  >
                    <span className="arco-eyebrow">{locationKindLabel(loc.kind, "en")}</span>
                    <p className="arco-card-title" style={{ margin: "12px 0 4px" }}>{loc.name ?? loc.city ?? street}</p>
                    {street && <p className="arco-body-text" style={{ margin: 0 }}>{street}</p>}
                    {cityLine && <p className="arco-body-text" style={{ margin: 0 }}>{cityLine}</p>}
                    {loc.openingHours && <p className="arco-body-text" style={{ margin: "8px 0 0", color: "#6b6b68", whiteSpace: "pre-line" }}>{loc.openingHours}</p>}
                    <span style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "#a1a1a0" }}>Edit →</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════ CONTACT ════════════════════ */}
      <section id="contact" className="contact-section" style={{ marginBottom: 80 }}>
        <div className="wrap">
          <div className="section-header">
            <h2 className="arco-section-title">Contact information</h2>
          </div>
          <div className="contact-row">
            {/* Website */}
            <div
              className={`contact-row-item${activeEditField === "website" ? " on" : ""}`}
              onClick={() => { if (activeEditField !== "website") setActiveEditField("website") }}
            >
              <EditBadge />
              <span className="arco-eyebrow">Website</span>
              {activeEditField === "website" ? (
                <input
                  autoFocus
                  type="url"
                  className="contact-edit-input"
                  defaultValue={website}
                  placeholder="https://…"
                  onBlur={(e) => commitWebsite(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur()
                    if (e.key === "Escape") { e.currentTarget.value = website; e.currentTarget.blur() }
                  }}
                />
              ) : (
                <p className="contact-row-value">
                  {website ? website.replace(/^https?:\/\//i, "").replace(/\/$/, "") : <span className="contact-row-placeholder">Add website</span>}
                </p>
              )}
            </div>

            {/* Domain — derived at scrape time, the key that recognises the brand */}
            <div className="contact-row-item static">
              <span className="arco-eyebrow">Domain</span>
              <p className="contact-row-value">{brand.domain ?? <span className="contact-row-placeholder">—</span>}</p>
              <p className="contact-row-sub">Set when the brand was added; recognises it if added again.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ POPUPS ════════════════════ */}

      {/* Showroom add/edit */}
      {locPopup.open && (
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

      {/* Add series */}
      {showCreate && (
        <div className="popup-overlay" onClick={() => !creating && setShowCreate(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Add series</h3>
              <button type="button" className="popup-close" onClick={() => !creating && setShowCreate(false)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 16 }}>
              The name the brand uses — Mito, Spa, Tobi-Ishi. Designer, year and cover come after.
            </p>
            <input
              type="text"
              autoFocus
              placeholder="Series name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) void createFamily() }}
              className="input-base input-default"
              style={{ width: "100%", marginBottom: 20 }}
              disabled={creating}
            />
            <div className="popup-actions">
              <button type="button" className="btn-tertiary" onClick={() => setShowCreate(false)} disabled={creating} style={{ flex: 1 }}>Cancel</button>
              <button type="button" className="btn-secondary" onClick={() => void createFamily()} disabled={creating || !newName.trim()} style={{ flex: 1 }}>
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete series */}
      {deleteTarget && (
        <div className="popup-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete {deleteTarget.name}?</h3>
              <button type="button" className="popup-close" onClick={() => !deleting && setDeleteTarget(null)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 20 }}>
              Projects tagged with this series keep the brand; the series on them is cleared.
            </p>
            <div className="popup-actions">
              <button type="button" className="btn-tertiary" onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ flex: 1 }}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1, background: "var(--destructive)" }} onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete series"}
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
