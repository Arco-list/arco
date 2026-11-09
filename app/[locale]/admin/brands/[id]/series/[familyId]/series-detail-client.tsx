"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, ImageIcon, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { handlePlainTextPaste, handlePlainTextDrop } from "@/lib/plain-text-paste"
import {
  deleteProductFamily,
  deleteProductFamilyPhoto,
  fetchSeriesFromBrandPage,
  setProductFamilyCover,
  updateProductFamily,
  uploadProductFamilyImage,
  uploadProductFamilyPhotos,
} from "../../../actions"
import { EDIT_PAGE_CSS, EditBadge, scrollToSection } from "../../../edit-chrome"

/**
 * Seriepagina voor admins, in de vorm van de oude productpagina: hero
 * met beeld links en tekst rechts, detailbalk, foto's, projecten, links.
 * Alles bewerkt in place, op blur, zoals de merk- en bedrijfspagina.
 *
 * De cover is de primaire foto; de hero toont hem, de kaart op de
 * merkpagina leest hem uit hero_image_url, die de acties bijhouden.
 */

export type SeriesEditBrand = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  website: string | null
}

export type SeriesEditFamily = {
  id: string
  slug: string
  name: string
  description: string | null
  hero_image_url: string | null
  designer: string | null
  launch_year: number | null
  url: string | null
  category_id: string | null
  is_featured: boolean
}

export type SeriesEditCategory = {
  id: string
  slug: string
  name: string
  nameNl: string | null
  parentId: string | null
  orderIndex: number
}

export type SeriesEditPhoto = {
  id: string
  url: string
  alt_text: string | null
  is_primary: boolean
  order_index: number
}

export type SeriesEditApplied = {
  id: string
  note: string | null
  photoId: string | null
  project: { id: string; title: string; status: string; city: string | null }
  spaceName: string | null
}

type Props = { brand: SeriesEditBrand; family: SeriesEditFamily; photos: SeriesEditPhoto[]; applied: SeriesEditApplied[]; categories: SeriesEditCategory[] }

// Mirrors the photo grid of the former admin product page.
const PHOTO_GRID_CSS = `
  .photo-edit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  @media (max-width: 768px) { .photo-edit-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; } }
  .photo-edit-thumb { position: relative; aspect-ratio: 4/3; overflow: hidden; background: #f0f0ee; border-radius: 4px; }
  .photo-edit-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; background: #f0f0ee; }
  .photo-tile-btn { position: absolute; top: 8px; width: 30px; height: 30px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); color: #fff; border: 1px solid rgba(255,255,255,.2); cursor: pointer; opacity: 0; transition: opacity .15s, background .12s; z-index: 2; padding: 0; }
  .photo-edit-thumb:hover .photo-tile-btn { opacity: 1; }
  .photo-tile-btn.cover { left: 8px; }
  .photo-tile-btn.cover:hover { background: rgba(1,109,117,.8); border-color: transparent; }
  .photo-tile-btn.del { right: 8px; }
  .photo-tile-btn.del:hover { background: rgba(210,40,40,.75); border-color: transparent; }
  .photo-cover-badge { position: absolute; top: 8px; left: 8px; z-index: 1; font-size: 10px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; color: #fff; background: rgba(0,0,0,.6); padding: 3px 8px; border-radius: 3px; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
  .photo-del-confirm { position: absolute; inset: 0; background: rgba(0,0,0,.7); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 10; }
  .photo-del-confirm p { color: #fff; font-size: 13px; font-weight: 500; margin: 0; }
  .photo-del-confirm-btns { display: flex; gap: 8px; }
  .photo-del-yes { padding: 6px 18px; background: #d42828; color: #fff; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; border: none; cursor: pointer; transition: background .12s; }
  .photo-del-yes:hover { background: #b91c1c; }
  .photo-del-no { padding: 6px 18px; background: rgba(255,255,255,.15); color: #fff; border-radius: var(--radius-sm); font-size: 12px; border: 1px solid rgba(255,255,255,.3); cursor: pointer; transition: background .12s; }
  .photo-del-no:hover { background: rgba(255,255,255,.25); }
  .photo-add-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; aspect-ratio: 4/3; border: 1px dashed #d4d4d2; border-radius: 4px; background: none; cursor: pointer; transition: border-color .15s, background .15s; }
  .photo-add-tile:hover { border-color: #016D75; background: rgba(1,109,117,.03); }
  .photo-add-tile:disabled { cursor: wait; }
`

// ── Sub-nav: back to the brand, sections, link to the brand's page ─────

const SECTIONS = [
  { id: "details", label: "Details" },
  { id: "photos", label: "Photos" },
  { id: "applied", label: "Projects" },
  { id: "links", label: "Links" },
] as const

function SeriesEditSubNav({ brand, url }: { brand: SeriesEditBrand; url: string | null }) {
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
            <Link href={`/admin/brands/${brand.id}`} className="sub-nav-back">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sub-nav-back-label">{brand.name}</span>
            </Link>
            <div className="sub-nav-mobile-divider" aria-hidden="true" />
            <div className="sub-nav-links">
              {SECTIONS.map(({ id, label }) => (
                <a key={id} href={`#${id}`} className={linkClass(id)} onClick={(e) => { e.preventDefault(); scrollToSection(id) }}>
                  {label}
                </a>
              ))}
            </div>
          </div>
          <div className="sub-nav-actions">
            {url && (
              <a className="filter-pill" href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <ExternalLink size={13} />
                <span className="sub-nav-pill-label">At the brand</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════

export function SeriesEditClient({ brand, family, photos, applied, categories }: Props) {
  const router = useRouter()

  const [name, setName] = useState(family.name)
  const [description, setDescription] = useState(family.description ?? "")
  const [activeEditField, setActiveEditField] = useState<"name" | "desc" | "url" | null>(null)
  const [url, setUrl] = useState(family.url ?? "")

  const [designer, setDesigner] = useState(family.designer ?? "")
  const [launchYear, setLaunchYear] = useState(family.launch_year ? String(family.launch_year) : "")
  const [editingSpecBar, setEditingSpecBar] = useState<"designer" | "year" | "category" | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(family.category_id)
  const [featured, setFeatured] = useState<boolean>(family.is_featured)
  // De soorten als één lijst, diepte-eerst, met hun diepte voor het
  // inspringen: Verlichting, dan Hanglampen eronder, enzovoort.
  const categoryRows = useMemo(() => {
    const children = (parent: string | null) => categories.filter((c) => c.parentId === parent).sort((a, b) => a.orderIndex - b.orderIndex)
    const rows: Array<{ c: SeriesEditCategory; depth: number }> = []
    const walk = (parent: string | null, depth: number) => { for (const c of children(parent)) { rows.push({ c, depth }); walk(c.id, depth + 1) } }
    walk(null, 0)
    return rows
  }, [categories])
  const categoryName = (c: SeriesEditCategory) => c.nameNl ?? c.name
  const currentCategory = categoryId ? categories.find((c) => c.id === categoryId) ?? null : null
  const designerRef = useRef<HTMLInputElement | null>(null)
  const yearRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (editingSpecBar === "designer") designerRef.current?.focus()
    if (editingSpecBar === "year") yearRef.current?.focus()
  }, [editingSpecBar])

  // Photos
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [photoDeleteConfirmId, setPhotoDeleteConfirmId] = useState<string | null>(null)
  const cover = useMemo(() => photos.find((p) => p.is_primary) ?? photos[0] ?? null, [photos])
  const coverUrl = cover?.url ?? family.hero_image_url

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const projectCount = useMemo(() => new Set(applied.map((a) => a.project.id)).size, [applied])
  const thisYear = new Date().getFullYear()

  // ── Saves ─────────────────────────────────────────────────────────────

  const patch = async (fields: Parameters<typeof updateProductFamily>[1], okMessage = "Saved") => {
    const result = await updateProductFamily(family.id, fields)
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
    if (val !== name) { setName(val); void patch({ name: val }) }
  }

  const handleDescBlur = (e: React.FocusEvent<HTMLParagraphElement>) => {
    setActiveEditField(null)
    const val = e.currentTarget.textContent?.trim() ?? ""
    if (val !== description) { setDescription(val); void patch({ description: val }) }
  }

  const commitUrl = (raw: string) => {
    setActiveEditField(null)
    const val = raw.trim()
    if (val === url) return
    setUrl(val)
    void patch({ url: val || null })
  }

  // Hero click: one file, becomes the cover (and a photo of the series).
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (coverInputRef.current) coverInputRef.current.value = ""
    if (!file) return
    const fd = new FormData()
    fd.append("file", file)
    setUploading(true)
    const result = await uploadProductFamilyImage(family.id, fd)
    setUploading(false)
    if ("error" in result) toast.error(result.error)
    else { toast.success("Cover updated"); router.refresh() }
  }

  const handleUploadPhotos = async (files: FileList | null) => {
    if (photoInputRef.current) photoInputRef.current.value = ""
    if (!files || files.length === 0) return
    const fd = new FormData()
    for (const f of Array.from(files)) fd.append("files", f)
    setUploading(true)
    const result = await uploadProductFamilyPhotos(family.id, fd)
    setUploading(false)
    if ("error" in result) { toast.error(result.error); return }
    toast.success(result.photos.length === 1 ? "Photo added" : `${result.photos.length} photos added`)
    router.refresh()
  }

  // De eigen pagina van de serie bij het merk: foto's die hier nog niet
  // staan, en designer, jaar en omschrijving waar die nog leeg zijn.
  const handleFetchFromBrand = async () => {
    setFetching(true)
    const result = await fetchSeriesFromBrandPage(family.id)
    setFetching(false)
    if ("error" in result) { toast.error(result.error); return }
    toast.success(result.photos > 0 ? `${result.photos} photo${result.photos === 1 ? "" : "s"} added` : "No new photos on the brand's page")
    router.refresh()
  }

  const handleSetCover = async (photoId: string) => {
    const result = await setProductFamilyCover(photoId)
    if ("error" in result) { toast.error(result.error); return }
    toast.success("Cover updated")
    router.refresh()
  }

  const handleDeletePhoto = async (photoId: string) => {
    setPhotoDeleteConfirmId(null)
    const result = await deleteProductFamilyPhoto(photoId)
    if ("error" in result) { toast.error(result.error); return }
    toast.success("Photo deleted")
    router.refresh()
  }

  const doDelete = async () => {
    setDeleting(true)
    const result = await deleteProductFamily(family.id)
    setDeleting(false)
    if ("error" in result) { toast.error(result.error); return }
    toast.success(`Deleted ${family.name}`)
    router.push(`/admin/brands/${brand.id}`)
  }

  return (
    <>
      <style>{EDIT_PAGE_CSS + PHOTO_GRID_CSS}</style>

      <SeriesEditSubNav brand={brand} url={family.url} />

      {/* ════════════════════ HERO ════════════════════ */}
      <div id="details" className="wrap" style={{ marginTop: 40, marginBottom: 60 }}>
        <nav aria-label="Breadcrumb" className="discover-breadcrumb" style={{ marginBottom: 32 }}>
          <Link href="/admin/brands" className="discover-breadcrumb-item">Brands</Link>
          <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
          <Link href={`/admin/brands/${brand.id}`} className="discover-breadcrumb-item">{brand.name}</Link>
          <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
          <span className="discover-breadcrumb-item discover-breadcrumb-current">{name}</span>
        </nav>

        <div className="product-hero">
          {/* Cover — click to replace; the .ec outline wraps the picture so the chip is not clipped */}
          <div className="ec hero-cover-edit" onClick={() => !uploading && coverInputRef.current?.click()}>
            <EditBadge />
            <div className="product-hero-image">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt={cover?.alt_text ?? name} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "var(--arco-surface)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#c8c8c6" }}>
                  <ImageIcon size={40} />
                </div>
              )}
            </div>
            <input ref={coverInputRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={handleCoverChange} />
          </div>

          {/* Name, brand, description */}
          <div className="product-hero-info">
            <Link href={`/admin/brands/${brand.id}`} style={{ display: "block", marginBottom: 24, textDecoration: "none", color: "inherit" }}>
              <div className="company-icon" style={{ justifyContent: "flex-start", marginBottom: 0 }}>
                {brand.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logo_url} alt={brand.name} className="company-icon-image" />
                ) : (
                  <div className="company-icon-initials">{brand.name.charAt(0).toUpperCase()}</div>
                )}
              </div>
            </Link>

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
                data-placeholder="Series name"
                style={{ marginBottom: 0 }}
              >
                {name}
              </h1>
            </div>

            <div className={`ec${activeEditField === "desc" ? " on" : ""}`} style={{ marginTop: 32 }}>
              <EditBadge />
              <p
                className="arco-body-text"
                contentEditable
                suppressContentEditableWarning
                onPaste={(e) => handlePlainTextPaste(e, { multiline: true })}
                onDrop={(e) => handlePlainTextDrop(e, { multiline: true })}
                onFocus={() => setActiveEditField("desc")}
                onBlur={handleDescBlur}
                data-placeholder="One or two sentences on what defines this series."
                style={{ minHeight: 40, margin: 0 }}
              >
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* ════════════════════ DETAILS BAR ════════════════════ */}
        <div className="edit-specs-bar" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 32, padding: "32px 0", marginTop: 48, borderTop: "1px solid #e8e8e6", borderBottom: "1px solid #e8e8e6" }}>
          {/* Designer */}
          <div
            className={`spec-item-edit${editingSpecBar === "designer" ? " editing" : ""}`}
            onClick={() => { if (editingSpecBar !== "designer") setEditingSpecBar("designer") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Designer</span>
            <input
              ref={designerRef}
              type="text"
              className="spec-inp-inline"
              value={designer}
              readOnly={editingSpecBar !== "designer"}
              placeholder="Add designer"
              onChange={(e) => setDesigner(e.target.value)}
              onBlur={(e) => {
                const val = e.target.value.trim()
                setDesigner(val)
                setEditingSpecBar(null)
                if (val !== (family.designer ?? "")) void patch({ designer: val || null })
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              onClick={(e) => { if (editingSpecBar === "designer") e.stopPropagation() }}
            />
          </div>

          {/* Launch year */}
          <div
            className={`spec-item-edit${editingSpecBar === "year" ? " editing" : ""}`}
            onClick={() => { if (editingSpecBar !== "year") setEditingSpecBar("year") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Launched</span>
            <input
              ref={yearRef}
              type="number"
              className="spec-inp-inline"
              value={launchYear}
              readOnly={editingSpecBar !== "year"}
              placeholder="Add year"
              min={1800}
              max={thisYear + 1}
              onChange={(e) => setLaunchYear(e.target.value)}
              onBlur={(e) => {
                const val = e.target.value.trim()
                setLaunchYear(val)
                setEditingSpecBar(null)
                const year = val ? parseInt(val, 10) : null
                if (year !== family.launch_year) void patch({ launch_year: year })
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              onClick={(e) => { if (editingSpecBar === "year") e.stopPropagation() }}
            />
          </div>

          {/* Category — the kind of product; the rows of the Products menu */}
          <div
            className={`spec-item-edit${editingSpecBar === "category" ? " editing" : ""}`}
            style={{ position: "relative" }}
            onClick={() => { if (editingSpecBar !== "category") setEditingSpecBar("category") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Kind</span>
            <span className="spec-inp-inline" style={{ display: "block", color: currentCategory ? undefined : "#b0b0ae" }}>
              {currentCategory ? categoryName(currentCategory) : "Add kind"}
            </span>
            {editingSpecBar === "category" && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={(e) => { e.stopPropagation(); setEditingSpecBar(null) }} />
                <div className="dd-panel" style={{ maxHeight: 320, overflowY: "auto", minWidth: 240, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
                  {categoryRows.map(({ c, depth }) => (
                    <div
                      key={c.id}
                      className={`dd-row${categoryId === c.id ? " sel" : ""}`}
                      style={{ paddingLeft: 14 + depth * 16 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        const next = categoryId === c.id ? null : c.id
                        setCategoryId(next)
                        setEditingSpecBar(null)
                        void patch({ category_id: next })
                      }}
                    >
                      <span>{categoryName(c)}</span>
                      {categoryId === c.id && <span className="dd-check">✓</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Featured — shows up under Uitgelicht on /products */}
          <div
            className="spec-item-edit"
            style={{ cursor: "pointer" }}
            onClick={() => { const next = !featured; setFeatured(next); void patch({ is_featured: next }, next ? "Featured on /products" : "No longer featured") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Featured</span>
            <span className="spec-inp-inline" style={{ display: "block", color: featured ? "#016D75" : "#b0b0ae" }}>{featured ? "Yes" : "No"}</span>
          </div>

          {/* Brand — read-only, back to the brand page */}
          <div className="spec-item-edit" style={{ cursor: "pointer" }} onClick={() => router.push(`/admin/brands/${brand.id}`)}>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Brand</span>
            <span className="spec-inp-inline" style={{ display: "block" }}>{brand.name}</span>
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

      {/* ════════════════════ PHOTOS ════════════════════ */}
      <section id="photos" style={{ marginBottom: 60 }}>
        <div className="wrap">
          <div className="section-header" style={{ marginBottom: 8 }}>
            <h2 className="arco-section-title">Photos</h2>
            {url && (
              <button type="button" className="btn-tertiary" style={{ fontSize: 13, padding: "6px 14px" }} onClick={() => void handleFetchFromBrand()} disabled={fetching || uploading}>
                {fetching ? "Reading the brand's page…" : "Fetch from the brand's page"}
              </button>
            )}
          </div>
          <p className="arco-body-text" style={{ color: "#8c8c8a", marginBottom: 24, maxWidth: 600 }}>
            The brand&apos;s own images of this series. The cover is what the card on the brand page shows.
          </p>
          <input
            ref={photoInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => void handleUploadPhotos(e.target.files)}
          />
          <div className="photo-edit-grid">
            <button type="button" className="photo-add-tile" onClick={() => photoInputRef.current?.click()} disabled={uploading}>
              <Plus size={18} style={{ color: "#c0c0be", marginBottom: 4 }} />
              <span style={{ fontSize: 12, color: "#b8b8b6", letterSpacing: ".03em" }}>{uploading ? "Uploading…" : "Add photos"}</span>
            </button>

            {photos.map((ph) => (
              <div key={ph.id} className="photo-edit-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={ph.alt_text ?? ""} />

                {ph.is_primary ? (
                  <span className="photo-cover-badge">Cover</span>
                ) : (
                  <button type="button" className="photo-tile-btn cover" onClick={() => void handleSetCover(ph.id)} title="Use as cover" aria-label="Use as cover">
                    <ImageIcon size={13} />
                  </button>
                )}

                <button type="button" className="photo-tile-btn del" onClick={() => setPhotoDeleteConfirmId(ph.id)} title="Delete photo" aria-label="Delete photo">
                  <Trash2 size={13} />
                </button>

                {photoDeleteConfirmId === ph.id && (
                  <div className="photo-del-confirm">
                    <p>Delete this photo?</p>
                    <div className="photo-del-confirm-btns">
                      <button type="button" className="photo-del-yes" onClick={() => void handleDeletePhoto(ph.id)}>Delete</button>
                      <button type="button" className="photo-del-no" onClick={() => setPhotoDeleteConfirmId(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ APPLIED IN PROJECTS ════════════════════ */}
      <section id="applied" style={{ marginBottom: 60 }}>
        <div className="wrap">
          <div className="section-header" style={{ marginBottom: 8 }}>
            <h2 className="arco-section-title">Applied in projects</h2>
          </div>
          <p className="arco-body-text" style={{ color: "#8c8c8a", marginBottom: 24, maxWidth: 600 }}>
            Tagged from the project editor with this series. The project photos that show it come later.
          </p>
          {applied.length === 0 ? (
            <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "48px 24px", textAlign: "center" }}>
              <p className="arco-body-text" style={{ color: "#a1a1a0", margin: 0 }}>Not tagged on any project yet.</p>
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, maxWidth: 820 }}>
              {applied.map((l) => (
                <li key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 130px 1fr 110px", gap: 12, alignItems: "center", border: "1px solid #e5e5e4", borderRadius: 4, padding: "10px 12px", fontSize: 13 }}>
                  <Link href={`/dashboard/edit/${l.project.id}`} style={{ fontWeight: 500, color: "#1c1c1a" }}>
                    {l.project.title}
                    {l.project.city ? <span style={{ color: "#8c8c8a", fontWeight: 400 }}> · {l.project.city}</span> : null}
                  </Link>
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

      {/* ════════════════════ LINKS ════════════════════ */}
      <section id="links" className="contact-section" style={{ marginBottom: 48 }}>
        <div className="wrap">
          <div className="section-header">
            <h2 className="arco-section-title">Links</h2>
          </div>
          <div className="contact-row">
            {/* Series page at the brand */}
            <div
              className={`contact-row-item${activeEditField === "url" ? " on" : ""}`}
              onClick={() => { if (activeEditField !== "url") setActiveEditField("url") }}
            >
              <EditBadge />
              <span className="arco-eyebrow">Series page at the brand</span>
              {activeEditField === "url" ? (
                <input
                  autoFocus
                  type="url"
                  className="contact-edit-input"
                  defaultValue={url}
                  placeholder="https://…"
                  onBlur={(e) => commitUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur()
                    if (e.key === "Escape") { e.currentTarget.value = url; e.currentTarget.blur() }
                  }}
                />
              ) : (
                <p className="contact-row-value">
                  {url ? url.replace(/^https?:\/\//i, "").replace(/\/$/, "") : <span className="contact-row-placeholder">Add the page where the brand shows this series</span>}
                </p>
              )}
            </div>

            {/* Brand website — read-only, lives on the brand page */}
            <div className="contact-row-item static">
              <span className="arco-eyebrow">Brand website</span>
              <p className="contact-row-value">
                {brand.website ? brand.website.replace(/^https?:\/\//i, "").replace(/\/$/, "") : <span className="contact-row-placeholder">—</span>}
              </p>
              <p className="contact-row-sub">Edited on the brand page.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ DELETE ════════════════════ */}
      <div className="wrap" style={{ marginBottom: 80 }}>
        <button
          type="button"
          className="arco-small-text"
          onClick={() => setConfirmDelete(true)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#a1a1a0" }}
        >
          Delete this series
        </button>
      </div>

      {confirmDelete && (
        <div className="popup-overlay" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete {family.name}?</h3>
              <button type="button" className="popup-close" onClick={() => !deleting && setConfirmDelete(false)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 20 }}>
              Removes the series and its {photos.length} photo{photos.length === 1 ? "" : "s"}. Projects tagged with it keep the brand; the series on them is cleared.
            </p>
            <div className="popup-actions">
              <button type="button" className="btn-tertiary" onClick={() => setConfirmDelete(false)} disabled={deleting} style={{ flex: 1 }}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1, background: "var(--destructive)" }} onClick={() => void doDelete()} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete series"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
