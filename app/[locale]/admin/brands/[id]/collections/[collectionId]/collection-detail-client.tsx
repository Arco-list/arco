"use client"

import { ProductImage } from "@/components/catalog/product-image"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, ImageIcon, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { handlePlainTextPaste, handlePlainTextDrop } from "@/lib/plain-text-paste"
import { downscaleForUpload } from "@/lib/image-downscale"

// Een server action neemt standaard maar 1 MB aan: elke foto eerst in de
// browser verkleinen (zoals de showroomfoto) en per foto versturen.
const UPLOAD_LIMIT = { targetBytes: 900 * 1024, maxEdge: 2000 }
import {
  createProduct,
  deleteProduct,
  deleteProductCollectionPhoto,
  fetchCollectionFromBrandPage,
  setProductCollectionCover,
  setCollectionPhotoFocus,
  updateProductCollection,
  updateProduct,
  updateProductCollectionKinds,
  updateCollectionPhotoKind,
  uploadProductCollectionImage,
  uploadProductCollectionPhotos,
} from "../../../actions"
import { EDIT_PAGE_CSS, EditBadge, scrollToSection } from "../../../edit-chrome"
import { STATUS_DOT, STATUS_LABEL, type BrandStatus } from "../../../status"
import { BrandLogo } from "@/components/brand/brand-logo"
import { CollectionHero } from "@/components/catalog/collection-hero"
import { isCutoutPhoto, pickCollectionHero } from "@/lib/products/collection-hero"

/**
 * Seriepagina voor admins, in dezelfde vorm als de publieke pagina
 * (/brands/[merk]/[collectie]): een groot beeld over de volle breedte, dan
 * logo, naam, soorten en omschrijving gecentreerd, de detailbalk, de
 * projecten en de foto's (in dezelfde volgorde als daar: projecten eerst
 * zodra die er zijn). Alles bewerkt in place, op
 * blur, zoals de merk- en bedrijfspagina.
 *
 * De cover is de primaire foto; het beeld bovenaan volgt dezelfde regel
 * als de publieke pagina (pickCollectionHero), de kaart op de merkpagina
 * leest hero_image_url, die de acties bijhouden.
 */

export type CollectionEditBrand = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  website: string | null
  status: BrandStatus
}

export type CollectionEditCollection = {
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

export type CollectionEditCategory = {
  id: string
  slug: string
  name: string
  nameNl: string | null
  parentId: string | null
  orderIndex: number
}

export type CollectionEditPhoto = {
  id: string
  url: string
  alt_text: string | null
  is_primary: boolean
  order_index: number
  /** ambiance | product | detail (migratie 318); null = nog niet ingedeeld. */
  kind?: string | null
  /** Maten (migratie 322): de hero kiest een liggende foto. */
  width?: number | null
  height?: number | null
  /** Focuspunt van de hero (migratie 326), 0–1. */
  focus_x?: number | null
  focus_y?: number | null
}

export type CollectionEditApplied = {
  id: string
  note: string | null
  photoId: string | null
  project: { id: string; title: string; status: string; city: string | null }
  spaceName: string | null
}

/** category_id: de Arco-categorie, het laatste niveau (migratie 327). */
export type CollectionEditProduct = {
  id: string; name: string; url: string | null; image_url: string | null; category_id?: string | null
  /** Prijs van de merkpagina (migratie 374), alleen ter controle. */
  price_type?: "fixed" | "from" | "on_request" | null; price_amount?: number | null; price_currency?: string | null; price_country?: string | null
}

/** "€ 2.400", "From € 2.400 · NL", "Price on request"; null zonder prijs. */
function priceLabel(p: CollectionEditProduct): string | null {
  if (p.price_type === "on_request") return "Price on request"
  if (!p.price_type || p.price_amount == null || !p.price_currency) return null
  let amount: string
  try {
    amount = new Intl.NumberFormat("nl-NL", { style: "currency", currency: p.price_currency, maximumFractionDigits: Number(p.price_amount) % 1 ? 2 : 0 }).format(Number(p.price_amount))
  } catch {
    amount = `${p.price_currency} ${p.price_amount}`
  }
  return `${p.price_type === "from" ? "From " : ""}${amount}${p.price_country ? ` · ${p.price_country}` : ""}`
}

type Props = { brand: CollectionEditBrand; collection: CollectionEditCollection; photos: CollectionEditPhoto[]; applied: CollectionEditApplied[]; categories: CollectionEditCategory[]; kindIds: string[]; products: CollectionEditProduct[] }

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
  .hero-cover-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2; display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-sans); font-size: 13px; font-weight: 400; color: #fff; background: rgba(0,0,0,.45); border: 1px solid rgba(255,255,255,.25); border-radius: 100px; padding: 8px 18px; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); transition: background .15s, border-color .15s; }
  .hero-cover-btn:hover { background: rgba(0,0,0,.6); border-color: rgba(255,255,255,.4); }
  .hero-cover-btn:disabled { cursor: wait; }
  .product-ext-link { color: #c8c8c6; opacity: 0; transition: opacity .15s, color .15s; }
  .product-tile:hover .product-ext-link { opacity: 1; }
  .product-ext-link:hover { color: #6b6b68; }
  .hero-focus-hint { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 2; font-size: 11px; color: #fff; background: rgba(0,0,0,.4); border-radius: 100px; padding: 4px 12px; pointer-events: none; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); white-space: nowrap; }
  /* Zelfde pil als "Eigenaar" op de projectkaarten. */
  .photo-kind-chip { position: absolute; left: 10px; bottom: 10px; z-index: 1; display: inline-flex; align-items: center; font-family: var(--font-sans); font-size: 11px; font-weight: 500; letter-spacing: .02em; color: #fff; background: rgba(0,0,0,.45); border: none; border-radius: 100px; padding: 4px 10px; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); transition: background .15s; }
  .photo-kind-chip:hover { background: rgba(0,0,0,.65); }
  .photo-kind-chip[data-kind="none"] { color: rgba(255,255,255,.7); }
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

type SectionDef = { id: string; label: string }

function CollectionEditSubNav({ brand, collectionSlug, sections, onFetch, fetching, fetchNeedsUrl = false }: {
  brand: CollectionEditBrand
  collectionSlug: string
  sections: SectionDef[]
  /** Foto's, soorten en producten opnieuw van de pagina bij het merk; zonder pagina eerst de URL vragen. */
  onFetch?: () => void
  fetching?: boolean
  fetchNeedsUrl?: boolean
}) {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [scrollDirection, setScrollDirection] = useState<"down" | "up">("down")
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY
      setScrollDirection(y > lastScrollY.current ? "down" : "up")
      lastScrollY.current = y
      let active: string | null = null
      for (const { id } of sections) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.map((x) => x.id).join("|")])

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
              {sections.map(({ id, label }) => (
                <a key={id} href={`#${id}`} className={linkClass(id)} onClick={(e) => { e.preventDefault(); scrollToSection(id) }}>
                  {label}
                </a>
              ))}
            </div>
          </div>
          <div className="sub-nav-actions">
            {/* Zoals op de projectbewerkpagina: de status, dan het voorbeeld. Een
                collectie heeft geen eigen status; ze volgt het merk, dus de
                pil toont die van het merk en brengt je er heen om hem te wijzigen. */}
            <Link href={`/admin/brands/${brand.id}`} className="filter-pill" style={{ textDecoration: "none" }} title="Status of the brand — change it on the brand page">
              <span className="inline-block rounded-full" style={{ width: 7, height: 7, flexShrink: 0, background: STATUS_DOT[brand.status] }} />
              {STATUS_LABEL[brand.status]}
            </Link>
            <a className="filter-pill" href={`/brands/${brand.slug}/${collectionSlug}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <ExternalLink size={13} />
              <span className="sub-nav-pill-label">Preview</span>
            </a>
            {onFetch && (
              <button type="button" className="filter-pill" onClick={onFetch} disabled={fetching} title={fetchNeedsUrl ? "Add the collection's page at the brand, then fetch photos, kinds and products from it" : "Fetch photos, kinds and products from the collection's page at the brand"}>
                <RefreshCw size={13} className={fetching ? "animate-spin" : undefined} />
                <span className="sub-nav-pill-label">{fetching ? "Fetching…" : "Fetch from brand"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════

export function CollectionEditClient({ brand, collection, photos, applied, categories, kindIds, products }: Props) {
  const router = useRouter()
  // Soort per foto, optimistisch bijgewerkt bij een klik op het label.
  const [photoKinds, setPhotoKinds] = useState<Record<string, string | null>>({})
  const kindOf = (ph: CollectionEditPhoto) => (ph.id in photoKinds ? photoKinds[ph.id] : ph.kind ?? null)
  const cycleKind = async (ph: CollectionEditPhoto) => {
    const order = ["ambiance", "product", "detail"] as const
    const cur = kindOf(ph)
    const next = order[(order.indexOf((cur ?? "detail") as (typeof order)[number]) + 1) % order.length]
    setPhotoKinds((prev) => ({ ...prev, [ph.id]: next }))
    const res = await updateCollectionPhotoKind(ph.id, next)
    if ("error" in res) { toast.error(res.error); setPhotoKinds((prev) => ({ ...prev, [ph.id]: cur })); return }
    router.refresh()
  }

  const [name, setName] = useState(collection.name)
  const [description, setDescription] = useState(collection.description ?? "")
  const [activeEditField, setActiveEditField] = useState<"name" | "desc" | "url" | null>(null)
  const [url, setUrl] = useState(collection.url ?? "")

  const [designer, setDesigner] = useState(collection.designer ?? "")
  const [launchYear, setLaunchYear] = useState(collection.launch_year ? String(collection.launch_year) : "")
  const [editingSpecBar, setEditingSpecBar] = useState<"designer" | "year" | null>(null)
  // De groep onder het Producten-menu volgt de soorten (zie updateProductCollectionKinds); hier alleen om te lezen.
  const categoryId = collection.category_id
  // De soorten onder de naam (Fauteuils · Banken · Ligbedden), zoals de
  // categorieën van een merk: een lijst die je opent, en bij sluiten wordt
  // opgeslagen.
  const [selectedKinds, setSelectedKinds] = useState<string[]>(kindIds)
  const [kindsOpen, setKindsOpen] = useState(false)
  const kindsSnapshotRef = useRef<string[]>(kindIds)
  // De soorten als één lijst, diepte-eerst, met hun diepte voor het
  // inspringen: Verlichting, dan Hanglampen eronder, enzovoort.
  const categoryRows = useMemo(() => {
    const children = (parent: string | null) => categories.filter((c) => c.parentId === parent).sort((a, b) => a.orderIndex - b.orderIndex)
    const rows: Array<{ c: CollectionEditCategory; depth: number }> = []
    const walk = (parent: string | null, depth: number) => { for (const c of children(parent)) { rows.push({ c, depth }); walk(c.id, depth + 1) } }
    walk(null, 0)
    return rows
  }, [categories])
  const categoryName = (c: CollectionEditCategory) => c.nameNl ?? c.name
  // Een product hangt aan een eindcategorie: de subgroep zelf als die geen
  // soorten heeft (Hanglampen), anders haar soorten (Banken → Hoekbanken…).
  const isLeaf = (id: string) => !categories.some((x) => x.parentId === id)
  const collectionLeaves = selectedKinds
    .flatMap((id) => (isLeaf(id) ? categories.filter((c) => c.id === id) : categories.filter((c) => c.parentId === id).sort((a, b) => a.orderIndex - b.orderIndex)))
  const currentCategory = categoryId ? categories.find((c) => c.id === categoryId) ?? null : null
  const kindsLabel = (selectedKinds.length > 0 ? selectedKinds.map((id) => categories.find((c) => c.id === id)) : currentCategory ? [currentCategory] : [])
    .filter((c): c is CollectionEditCategory => Boolean(c))
    .map(categoryName)
    .join(" · ")
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
  // Wat bovenaan staat is wat de bezoeker ziet (pickCollectionHero); zonder
  // foto's het beeld dat de kaart al had.
  // Een gekozen cover staat meteen bovenaan, nog voor de server klaar is.
  const [coverOverrideId, setCoverOverrideId] = useState<string | null>(null)
  // Verse gegevens van de server: die weten de cover zelf.
  useEffect(() => { setCoverOverrideId(null) }, [photos])
  const heroPhoto = useMemo(
    () => pickCollectionHero(photos.map((p) => ({ ...p, isPrimary: coverOverrideId ? p.id === coverOverrideId : p.is_primary }))),
    [photos, coverOverrideId],
  )
  const coverUrl = heroPhoto?.url ?? collection.hero_image_url
  // Wat als cover kan dienen, volgens dezelfde regel als de hero: zijn er
  // sfeerbeelden, dan alleen die; anders geen png-studiobeelden (tenzij er
  // niets anders is). Zo verandert het beeld bovenaan echt bij een keuze.
  const coverChoices = useMemo(() => {
    const ambiance = photos.filter((p) => p.kind === "ambiance")
    if (ambiance.length > 0) return ambiance
    const scenes = photos.filter((p) => !/\.png(\?|$)/i.test(p.url))
    return scenes.length > 0 ? scenes : photos
  }, [photos])
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  // Terugval voor een product zonder eigen beeld: de productfoto van de collectie.
  const productShot = photos.find((p) => p.kind === "product")?.url ?? null
  // Het focuspunt van de hero: een klik op het beeld zet het (meteen
  // zichtbaar, daarna opgeslagen).
  const [focusOverride, setFocusOverride] = useState<{ id: string; x: number; y: number } | null>(null)
  const heroFocus = heroPhoto
    ? focusOverride?.id === heroPhoto.id
      ? focusOverride
      : heroPhoto.focus_x != null && heroPhoto.focus_y != null ? { x: heroPhoto.focus_x, y: heroPhoto.focus_y } : null
    : null
  const handlePickFocus = async (photoId: string, f: { x: number; y: number }) => {
    setFocusOverride({ id: photoId, ...f })
    const result = await setCollectionPhotoFocus(photoId, f.x, f.y)
    if ("error" in result) { toast.error(result.error); setFocusOverride(null) }
  }

  // Producten: het venster om er een toe te voegen of aan te passen.
  const [productDialog, setProductDialog] = useState<{ product: CollectionEditProduct | null } | null>(null)
  const [productName, setProductName] = useState("")
  const [productCategory, setProductCategory] = useState("")
  const [productUrl, setProductUrl] = useState("")
  const [productFile, setProductFile] = useState<File | null>(null)
  const [productPreview, setProductPreview] = useState<string | null>(null)
  const [productBusy, setProductBusy] = useState(false)
  const [productConfirmDelete, setProductConfirmDelete] = useState(false)
  const productFileRef = useRef<HTMLInputElement | null>(null)

  const projectCount = useMemo(() => new Set(applied.map((a) => a.project.id)).size, [applied])
  const thisYear = new Date().getFullYear()

  // ── Saves ─────────────────────────────────────────────────────────────

  const patch = async (fields: Parameters<typeof updateProductCollection>[1], okMessage = "Saved") => {
    const result = await updateProductCollection(collection.id, fields)
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

  // Hero click: one file, becomes the cover (and a photo of the collection).
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (coverInputRef.current) coverInputRef.current.value = ""
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", (await downscaleForUpload(file, UPLOAD_LIMIT)).file)
      const result = await uploadProductCollectionImage(collection.id, fd)
      if ("error" in result) toast.error(result.error)
      else { toast.success("Cover updated"); router.refresh() }
    } catch {
      toast.error("Upload failed. Try a smaller image.")
    } finally {
      setUploading(false)
    }
  }

  const handleUploadPhotos = async (list: FileList | null) => {
    // Eerst kopiëren: de input leegmaken leegt ook de (live) FileList.
    const files = list ? Array.from(list) : []
    if (photoInputRef.current) photoInputRef.current.value = ""
    if (files.length === 0) return
    setUploading(true)
    let added = 0
    try {
      for (const f of files) {
        const fd = new FormData()
        fd.append("files", (await downscaleForUpload(f, UPLOAD_LIMIT)).file)
        const result = await uploadProductCollectionPhotos(collection.id, fd)
        if ("error" in result) { toast.error(result.error); break }
        added += result.photos.length
      }
    } catch {
      toast.error("Upload failed. Try a smaller image.")
    } finally {
      setUploading(false)
    }
    if (added > 0) {
      toast.success(added === 1 ? "Photo added" : `${added} photos added`)
      router.refresh()
    }
  }

  // De eigen pagina van de collectie bij het merk: foto's die hier nog niet
  // staan, en designer, jaar en omschrijving waar die nog leeg zijn.
  const handleFetchFromBrand = async () => {
    // Nog geen pagina bij het merk: eerst vragen en bewaren (de collectie
    // heeft verder geen veld voor de URL op deze pagina).
    if (!url) {
      const entered = window.prompt(`Page of ${collection.name} at ${brand.name}:`, brand.website ?? "https://")?.trim()
      if (!entered) return
      if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(entered)) { toast.error("Enter the full address of the page, starting with https://"); return }
      const saved = await updateProductCollection(collection.id, { url: entered })
      if ("error" in saved) { toast.error(saved.error); return }
      setUrl(entered)
    }
    setFetching(true)
    const result = await fetchCollectionFromBrandPage(collection.id)
    setFetching(false)
    if ("error" in result) { toast.error(result.error); return }
    const added = [result.photos > 0 && `${result.photos} photo${result.photos === 1 ? "" : "s"}`, result.products > 0 && `${result.products} product${result.products === 1 ? "" : "s"}`].filter(Boolean).join(" and ")
    toast.success(added ? `${added} added` : "Nothing new on the brand's page")
    router.refresh()
  }

  const openKinds = () => { kindsSnapshotRef.current = [...selectedKinds]; setKindsOpen(true) }
  const closeKinds = async () => {
    setKindsOpen(false)
    const before = kindsSnapshotRef.current
    if (before.length === selectedKinds.length && before.every((id, i) => id === selectedKinds[i])) return
    const result = await updateProductCollectionKinds(collection.id, selectedKinds)
    if ("error" in result) { toast.error(result.error); setSelectedKinds(before) }
    else toast.success("Saved")
    router.refresh()
  }
  const toggleKind = (id: string) => setSelectedKinds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const handleSetCover = async (photoId: string) => {
    setCoverOverrideId(photoId)
    const result = await setProductCollectionCover(photoId)
    if ("error" in result) { toast.error(result.error); setCoverOverrideId(null); return }
    router.refresh()
  }

  const handleDeletePhoto = async (photoId: string) => {
    setPhotoDeleteConfirmId(null)
    const result = await deleteProductCollectionPhoto(photoId)
    if ("error" in result) { toast.error(result.error); return }
    toast.success("Photo deleted")
    router.refresh()
  }

  const photosSection = (
      <section id="photos" style={{ marginBottom: 60 }}>
        <div className="wrap">
          <div className="section-header" style={{ marginBottom: 24 }}>
            <h2 className="arco-section-title">Photos</h2>
          </div>
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

                {/* De cover kies je in de hero ("Change cover"); hier alleen het label. */}
                {ph.is_primary && <span className="photo-cover-badge">Cover</span>}

                {/* Soort (migratie 318): bepaalt de volgorde in de galerij en
                    wat hero of cover kan worden (alleen Ambiance). Klik
                    wisselt naar de volgende. */}
                <button
                  type="button"
                  className="photo-kind-chip"
                  data-kind={kindOf(ph) ?? "none"}
                  onClick={() => void cycleKind(ph)}
                  title="Ambiance can be the hero and comes first in the gallery. Click to change."
                >
                  {kindOf(ph) === "ambiance" ? "Ambiance" : kindOf(ph) === "product" ? "Product" : kindOf(ph) === "detail" ? "Detail" : "Unsorted"}
                </button>

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
  )
  // Niet in een project getagd: geen sectie (en geen link ernaar).
  const appliedSection = applied.length === 0 ? null : (
      <section id="applied" style={{ marginBottom: 60 }}>
        <div className="wrap">
          <div className="section-header" style={{ marginBottom: 8 }}>
            <h2 className="arco-section-title">Projects</h2>
          </div>
          <p className="arco-body-text" style={{ color: "#8c8c8a", marginBottom: 24, maxWidth: 600 }}>
            The projects this collection is tagged in, from the project editor. The project photos that show it come later.
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
  )
  // De producten van de collectie: ingelezen van de pagina van het merk, of
  // met de hand toegevoegd. Een tegel opent het bewerkvenster; het
  // productmodel (afmetingen, varianten, eigen foto's) komt later.
  const openProductDialog = (product: CollectionEditProduct | null) => {
    setProductDialog({ product })
    setProductName(product?.name ?? "")
    setProductCategory(product?.category_id ?? (collectionLeaves.length === 1 ? collectionLeaves[0].id : ""))
    setProductUrl(product?.url ?? "")
    setProductFile(null)
    setProductPreview(null)
    setProductConfirmDelete(false)
  }
  const saveProduct = async () => {
    if (!productDialog) return
    const fd = new FormData()
    fd.append("name", productName)
    fd.append("category_id", productCategory)
    fd.append("url", productUrl)
    setProductBusy(true)
    let result: Awaited<ReturnType<typeof updateProduct>> | Awaited<ReturnType<typeof createProduct>>
    try {
      if (productFile) fd.append("file", (await downscaleForUpload(productFile, UPLOAD_LIMIT)).file)
      result = productDialog.product ? await updateProduct(productDialog.product.id, fd) : await createProduct(collection.id, fd)
    } catch {
      toast.error("Saving failed. Try a smaller image.")
      return
    } finally {
      setProductBusy(false)
    }
    if ("error" in result) { toast.error(result.error); return }
    toast.success(productDialog.product ? "Product saved" : "Product added")
    setProductDialog(null)
    router.refresh()
  }
  const removeProduct = async () => {
    if (!productDialog?.product) return
    setProductBusy(true)
    const result = await deleteProduct(productDialog.product.id)
    setProductBusy(false)
    if ("error" in result) { toast.error(result.error); return }
    toast.success("Product deleted")
    setProductDialog(null)
    router.refresh()
  }
  const productsSection = (
    <section id="products" style={{ marginBottom: 60 }}>
      <div className="wrap">
        <div className="section-header" style={{ marginBottom: 24 }}>
          <h2 className="arco-section-title">Products</h2>
        </div>
        {/* Zelfde raster als de foto's: even grote tegels. */}
        <div className="photo-edit-grid">
          <button type="button" className="photo-add-tile" onClick={() => openProductDialog(null)}>
            <Plus size={18} style={{ color: "#c0c0be", marginBottom: 4 }} />
            <span style={{ fontSize: 12, color: "#b8b8b6", letterSpacing: ".03em" }}>Add product</span>
          </button>
          {products.map((p) => (
            <div key={p.id} className="product-tile" style={{ cursor: "pointer" }} onClick={() => openProductDialog(p)} title="Edit product">
              <div style={{ aspectRatio: "4 / 3", background: "var(--arco-surface)", borderRadius: 4, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {(p.image_url ?? productShot) ? (
                  <ProductImage url={(p.image_url ?? productShot) as string} alt={p.name} />
                ) : (
                  <ImageIcon size={24} style={{ color: "#c8c8c6" }} />
                )}
              </div>
              {/* Zelfde typografie als de projectkaarten: titel, en de categorie klein eronder. */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                <h3 className="discover-card-title" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</h3>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`Open ${p.name} at the brand`} title="Open at the brand" className="product-ext-link" style={{ flexShrink: 0, display: "inline-flex" }}>
                    <ExternalLink size={11} strokeWidth={1.5} />
                  </a>
                )}
              </div>
              {/* De Arco-categorie, het laatste niveau. */}
              <p className="discover-card-sub" style={p.category_id ? undefined : { color: "#b0b0ae" }}>
                {(() => { const c = p.category_id ? categories.find((x) => x.id === p.category_id) : null; return c ? categoryName(c) : "No category" })()}
              </p>
              {/* De prijs van de merkpagina, alleen hier ter controle. */}
              {priceLabel(p) && <p className="discover-card-sub" style={{ fontVariantNumeric: "tabular-nums" }}>{priceLabel(p)}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
  // Dezelfde volgorde als de publieke pagina: de projecten eerst zodra
  // de collectie in projecten is toegepast, anders de foto's.
  const appliedFirst = applied.length > 0
  // Producten boven de foto's: wat de collectie ís, dan hoe ze eruitziet.
  const sections: SectionDef[] = [
    { id: "details", label: "Details" },
    ...(appliedFirst ? [{ id: "applied", label: "Projects" }] : []),
    { id: "products", label: "Products" },
    { id: "photos", label: "Photos" },
    ...(appliedFirst ? [] : [{ id: "applied", label: "Projects" }]),
  ]

  return (
    <>
      <style>{EDIT_PAGE_CSS + PHOTO_GRID_CSS}</style>

      <CollectionEditSubNav
        brand={brand}
        collectionSlug={collection.slug}
        sections={sections}
        onFetch={() => { if (!fetching && !uploading) void handleFetchFromBrand() }}
        fetchNeedsUrl={!url}
        fetching={fetching}
      />

      {/* ════════════════════ HERO ════════════════════ */}
      <div id="details">
        {/* Het beeld (4:3) staat links naast de naam, zoals op de publieke
            pagina; zie hieronder. "Change cover" in het midden, zoals bij
            projecten: kiezen uit de foto's van de collectie; zonder foto's
            een bestand uploaden. */}

        {coverPickerOpen && (
          <div className="popup-overlay" onClick={() => setCoverPickerOpen(false)}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
              <div className="popup-header">
                <h3 className="arco-section-title">Select cover photo</h3>
                <button type="button" className="popup-close" onClick={() => setCoverPickerOpen(false)} aria-label="Close">✕</button>
              </div>
              <p className="arco-body-text" style={{ marginBottom: 20 }}>
                The cover is the large image on the collection page and the card on the brand page.
              </p>
              <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                  {coverChoices.map((ph) => {
                    const isCurrent = ph.id === heroPhoto?.id
                    return (
                      <button
                        key={ph.id}
                        type="button"
                        onClick={() => { setCoverPickerOpen(false); if (!isCurrent) void handleSetCover(ph.id) }}
                        style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", borderRadius: 6, border: isCurrent ? "2px solid #016D75" : "2px solid transparent", cursor: "pointer", background: "#f0f0ee", padding: 0, transition: "border-color .15s" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ph.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        {isCurrent && (
                          <span style={{ position: "absolute", top: 6, right: 6, background: "#016D75", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8l4 4 8-8" /></svg>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="wrap" style={{ marginTop: 48, marginBottom: 60 }}>
          <div className="collection-intro">
          {(() => {
            const cover = (
              <>
                <button
                  type="button"
                  className="hero-cover-btn"
                  disabled={uploading}
                  onClick={() => (coverChoices.length > 0 ? setCoverPickerOpen(true) : coverInputRef.current?.click())}
                >
                  <ImageIcon size={14} />
                  {uploading ? "Uploading…" : coverChoices.length > 0 ? "Change cover" : "Add cover"}
                </button>
                <input ref={coverInputRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={handleCoverChange} />
                {heroPhoto && !isCutoutPhoto(heroPhoto) && (
                  <span className="hero-focus-hint">Click the image to set the focus point</span>
                )}
              </>
            )
            return coverUrl ? (
              <CollectionHero
                layout="intro"
                src={coverUrl}
                alt={heroPhoto?.alt_text ?? name}
                cutout={heroPhoto ? isCutoutPhoto(heroPhoto) : false}
                focus={heroFocus}
                onPickFocus={heroPhoto ? (f) => void handlePickFocus(heroPhoto.id, f) : undefined}
              >
                {cover}
              </CollectionHero>
            ) : (
              <div className="collection-intro-media">{cover}</div>
            )
          })()}
          <section className="professional-header">
            <Link href={`/admin/brands/${brand.id}`} className="company-icon" aria-label={brand.name} style={{ display: "inline-block", textDecoration: "none" }}>
              <BrandLogo logoUrl={brand.logo_url} name={brand.name} />
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
                data-placeholder="Collection name"
              >
                {name}
              </h1>
            </div>

            {/* Soorten — wat de collectie maakt; de regel onder de naam op de publieke pagina. */}
            <div
              className={`ec ec--inline${kindsOpen ? " on" : ""}`}
              onClick={() => { if (!kindsOpen) openKinds() }}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 24 }}
            >
              <p className="professional-badge service-popup-badge" style={{ margin: 0, cursor: "pointer", ...(kindsLabel ? undefined : { color: "var(--primary)" }) }}>
                {kindsLabel || "Add subgroups"}
              </p>
              <span className="ec-badge ec-badge--inline">
                <span className="ec-ico">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </span>
                <span className="ec-txt">Edit</span>
              </span>
              {kindsOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={(e) => { e.stopPropagation(); void closeKinds() }} />
                  <div className="dd-panel" style={{ maxHeight: 320, overflowY: "auto", minWidth: 240, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
                    {/* Migratie 351: een collectie hangt aan subgroepen (Banken,
                        Hanglampen). Hoofdgroepen als kop, soorten niet. */}
                    {categoryRows.filter(({ depth }) => depth < 2).map(({ c, depth }) => {
                      if (depth === 0) return <div key={c.id} className="dd-row" style={{ paddingLeft: 14, color: "#a1a1a0", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", cursor: "default" }}>{categoryName(c)}</div>
                      const sel = selectedKinds.includes(c.id)
                      return (
                        <div key={c.id} className={`dd-row${sel ? " sel" : ""}`} style={{ paddingLeft: 14 + (depth - 1) * 16 }} onClick={(e) => { e.stopPropagation(); toggleKind(c.id) }}>
                          <span>{categoryName(c)}</span>
                          {sel && <span className="dd-check">✓</span>}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

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
                data-placeholder="One or two sentences on what defines this collection."
                style={{ minHeight: 40, margin: 0 }}
              >
                {description}
              </p>
            </div>
          </section>
          </div>

        {/* ════════════════════ DETAILS BAR ════════════════════ */}
        <div className="edit-specs-bar" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 32, padding: "32px 0", marginTop: 0, borderTop: "1px solid #e8e8e6", borderBottom: "1px solid #e8e8e6" }}>
          {/* Brand — read-only, back to the brand page */}
          <div className="spec-item-edit" style={{ cursor: "pointer" }} onClick={() => router.push(`/admin/brands/${brand.id}`)}>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Brand</span>
            <span className="spec-inp-inline" style={{ display: "block" }}>{brand.name}</span>
          </div>

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
                if (val !== (collection.designer ?? "")) void patch({ designer: val || null })
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
                if (year !== collection.launch_year) void patch({ launch_year: year })
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              onClick={(e) => { if (editingSpecBar === "year") e.stopPropagation() }}
            />
          </div>

          {/* In projects — read-only, scrolls to the section */}
          <div className="spec-item-edit" style={{ cursor: projectCount > 0 ? "pointer" : "default" }} onClick={() => { if (projectCount > 0) scrollToSection("applied") }}>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>In projects</span>
            <span className="spec-inp-inline" style={{ display: "block", color: projectCount > 0 ? undefined : "#b0b0ae" }}>
              {projectCount > 0 ? projectCount : "—"}
            </span>
          </div>
        </div>
        </div>
      </div>

      {appliedFirst
        ? <>{appliedSection}{productsSection}{photosSection}</>
        : <>{productsSection}{photosSection}{appliedSection}</>}

      {productDialog && (
        <div className="popup-overlay" onClick={() => !productBusy && setProductDialog(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{productDialog.product ? "Edit product" : "Add product"}</h3>
              <button type="button" className="popup-close" onClick={() => !productBusy && setProductDialog(null)} aria-label="Close">✕</button>
            </div>

            <label className="arco-eyebrow" style={{ display: "block", marginBottom: 6 }}>Name</label>
            <input
              autoFocus
              className="input-base input-default"
              style={{ width: "100%", marginBottom: 16 }}
              value={productName}
              placeholder="Lounge chair"
              onChange={(e) => setProductName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && productName.trim()) void saveProduct() }}
            />

            <label className="arco-eyebrow" style={{ display: "block", marginBottom: 6 }}>Category</label>
            <select
              className="input-base input-default"
              style={{ width: "100%", marginBottom: 16 }}
              value={productCategory}
              onChange={(e) => setProductCategory(e.target.value)}
            >
              <option value="">No category</option>
              {collectionLeaves.length > 0 && (
                <optgroup label="In this collection's subgroups">
                  {collectionLeaves.map((c) => (
                    <option key={`k-${c.id}`} value={c.id}>{categoryName(c)}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="All categories">
                {categoryRows.map(({ c, depth }) => {
                  const leaf = !categories.some((x) => x.parentId === c.id)
                  return <option key={c.id} value={c.id} disabled={!leaf}>{"\u00a0\u00a0".repeat(depth)}{categoryName(c)}</option>
                })}
              </optgroup>
            </select>

            <label className="arco-eyebrow" style={{ display: "block", marginBottom: 6 }}>Page at the brand</label>
            <input
              type="url"
              className="input-base input-default"
              style={{ width: "100%", marginBottom: 16 }}
              value={productUrl}
              placeholder="https://…"
              onChange={(e) => setProductUrl(e.target.value)}
            />

            <label className="arco-eyebrow" style={{ display: "block", marginBottom: 6 }}>Image</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 88, height: 66, background: "var(--arco-surface)", borderRadius: 4, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {(productPreview ?? productDialog.product?.image_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(productPreview ?? productDialog.product?.image_url) as string} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6%", boxSizing: "border-box", mixBlendMode: "multiply" }} />
                ) : (
                  <ImageIcon size={20} style={{ color: "#c8c8c6" }} />
                )}
              </div>
              <button type="button" className="btn-tertiary" style={{ fontSize: 13, padding: "6px 14px" }} onClick={() => productFileRef.current?.click()} disabled={productBusy}>
                {productFile ? productFile.name : (productDialog.product?.image_url ? "Replace image" : "Choose image")}
              </button>
              <input
                ref={productFileRef}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  if (productFileRef.current) productFileRef.current.value = ""
                  setProductFile(f)
                  setProductPreview(f ? URL.createObjectURL(f) : null)
                }}
              />
            </div>

            <div className="popup-actions">
              {productDialog.product && (
                productConfirmDelete ? (
                  <button type="button" className="btn-primary" style={{ background: "var(--destructive)" }} onClick={() => void removeProduct()} disabled={productBusy}>
                    {productBusy ? "Deleting…" : "Yes, delete"}
                  </button>
                ) : (
                  <button type="button" className="btn-tertiary" style={{ color: "var(--destructive)" }} onClick={() => setProductConfirmDelete(true)} disabled={productBusy}>Delete</button>
                )
              )}
              <button type="button" className="btn-tertiary" style={{ flex: 1 }} onClick={() => setProductDialog(null)} disabled={productBusy}>Cancel</button>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => void saveProduct()} disabled={productBusy || !productName.trim()}>
                {productBusy ? "Saving…" : productDialog.product ? "Save" : "Add product"}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
