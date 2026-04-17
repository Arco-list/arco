"use client"

import { memo, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, ImageIcon, MoreHorizontal, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  deleteProductFamily,
  discoverCatalog,
  setFamilyProducts,
  updateBrand,
  updateProductFamily,
  updateProductStatus,
  upsertProductFamily,
  uploadBrandLogo,
  type DiscoveredProduct,
} from "../actions"
import { ProductsImportModal } from "@/components/products-import-modal"

type Brand = {
  id: string
  slug: string
  name: string
  domain: string | null
  website: string | null
  logo_url: string | null
  description: string | null
  country: string | null
  status: string
}

type Product = {
  id: string
  slug: string
  name: string
  description: string | null
  source_url: string | null
  status: string
  scraped_at: string | null
  family_id: string | null
  category: { id: string; name: string } | null
  product_photos: { url: string; is_primary: boolean; order_index: number }[]
}

type Family = {
  id: string
  slug: string
  name: string
  description: string | null
  hero_image_url: string | null
}

/* ────────────────────────────────────────────────────────────────
   Inline editors — isolated from parent re-renders so contentEditable
   keeps cursor and selection behaviour intact. Mirrors EditableTitle
   on the project edit page.
   ──────────────────────────────────────────────────────────────── */

const EditableText = memo(function EditableText({
  initialValue,
  as,
  className,
  placeholder,
  badgeLabel,
  multiline = false,
  onSave,
  style,
}: {
  initialValue: string
  as: "h1" | "p"
  className: string
  placeholder: string
  badgeLabel: string
  multiline?: boolean
  onSave: (value: string) => void
  style?: React.CSSProperties
}) {
  const ecRef = useRef<HTMLDivElement>(null)
  const elRef = useRef<HTMLHeadingElement | HTMLParagraphElement | null>(null)
  const savedValueRef = useRef(initialValue)

  useEffect(() => {
    if (elRef.current && initialValue && !elRef.current.textContent) {
      elRef.current.textContent = initialValue
      savedValueRef.current = initialValue
    }
  }, [initialValue])

  const commonProps = {
    ref: elRef as any,
    className,
    contentEditable: true,
    suppressContentEditableWarning: true,
    onFocus: () => ecRef.current?.classList.add("on"),
    onBlur: () => {
      ecRef.current?.classList.remove("on")
      const val = elRef.current?.textContent?.trim() ?? ""
      if (val !== savedValueRef.current) {
        savedValueRef.current = val
        onSave(val)
      }
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!multiline && e.key === "Enter") {
        e.preventDefault()
        ;(e.target as HTMLElement).blur()
      }
    },
    style: { cursor: "text", outline: "none", ...(style ?? {}) },
    "data-placeholder": placeholder,
  }

  return (
    <div
      ref={ecRef}
      className="ec"
      style={{ display: "block", width: "100%" }}
    >
      <span className="ec-badge">
        <span className="ec-ico">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: "inline-block", flexShrink: 0 }}>
            <path d="M11.5 1.5l3 3L5 14H2v-3z" />
          </svg>
        </span>
        <span className="ec-txt">{badgeLabel}</span>
      </span>
      {as === "h1" ? <h1 {...(commonProps as any)} /> : <p {...(commonProps as any)} />}
    </div>
  )
})

export function BrandDetailClient({
  brand,
  products,
  families,
}: {
  brand: Brand
  products: Product[]
  families: Family[]
}) {
  const router = useRouter()

  // ── Editable header state ─────────────────────────────────────────────
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  const saveField = async (field: "name" | "description", value: string) => {
    const trimmed = value.trim()
    // Name can't be blank — revert via refresh so the UI snaps back.
    if (field === "name" && !trimmed) {
      toast.error("Name can't be empty")
      router.refresh()
      return
    }
    const patch = field === "name" ? { name: trimmed } : { description: trimmed }
    const result = await updateBrand(brand.id, patch)
    if ("error" in result) {
      toast.error(result.error)
      router.refresh()
    } else {
      toast.success("Saved")
      router.refresh()
    }
  }

  const handleLogoPick = () => logoInputRef.current?.click()
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    const result = await uploadBrandLogo(brand.id, formData)
    if ("error" in result) {
      toast.error(result.error)
    } else {
      toast.success("Logo updated")
      router.refresh()
    }
    // Reset so picking the same file again still fires.
    if (logoInputRef.current) logoInputRef.current.value = ""
  }

  // ── Add products modal ────────────────────────────────────────────────
  // One URL → detect single vs. collection (heuristic) → preview the
  // matched products with checkboxes → import the selected ones via
  // batchScrapeProducts. Single-product URLs show a synthetic 1-row list.
  const [modalOpen, setModalOpen] = useState(false)
  const [productUrl, setProductUrl] = useState("")
  const [detectMode, setDetectMode] = useState<"single" | "collection" | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredProduct[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importItems, setImportItems] = useState<{ url: string; name: string }[] | null>(null)

  // ── Product card actions ───────────────────────────────────────────────
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [statusProduct, setStatusProduct] = useState<Product | null>(null)
  const [draftStatus, setDraftStatus] = useState<"listed" | "unlisted" | "">("")
  const [isSavingStatus, setIsSavingStatus] = useState(false)

  // Close dropdown on click outside
  useEffect(() => {
    if (!openDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".dropdown-menu")) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [openDropdown])

  const openStatusModal = (product: Product) => {
    setOpenDropdown(null)
    setStatusProduct(product)
    setDraftStatus((product.status === "listed" || product.status === "unlisted") ? product.status : "listed")
  }

  const closeStatusModal = () => {
    if (isSavingStatus) return
    setStatusProduct(null)
    setDraftStatus("")
  }

  const saveStatus = async () => {
    if (!statusProduct || !draftStatus) return
    if (draftStatus === statusProduct.status) { closeStatusModal(); return }
    setIsSavingStatus(true)
    try {
      const result = await updateProductStatus(statusProduct.id, draftStatus)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Status updated")
        router.refresh()
        setStatusProduct(null)
        setDraftStatus("")
      }
    } finally {
      setIsSavingStatus(false)
    }
  }

  const handleEditProduct = (product: Product) => {
    setOpenDropdown(null)
    router.push(`/admin/products/${product.id}`)
  }

  const handleViewProduct = (product: Product) => {
    setOpenDropdown(null)
    window.open(`/products/${brand.slug}/${product.slug}`, "_blank", "noopener,noreferrer")
  }

  const handleChangeCover = () => {
    setOpenDropdown(null)
    toast.info("Change cover is coming in the next update.")
  }

  // ── Collection actions ────────────────────────────────────────────────
  const [selectFamily, setSelectFamily] = useState<Family | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [isSavingSelection, setIsSavingSelection] = useState(false)
  const [deleteFamily, setDeleteFamily] = useState<Family | null>(null)
  const [isDeletingFamily, setIsDeletingFamily] = useState(false)
  const [isCreatingFamily, setIsCreatingFamily] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState("")
  const [showCreateFamily, setShowCreateFamily] = useState(false)

  // Cover picker popup — select a product in the collection, then one of its photos.
  const [coverFamily, setCoverFamily] = useState<Family | null>(null)
  const [coverStep, setCoverStep] = useState<"products" | "photos">("products")
  const [coverProduct, setCoverProduct] = useState<Product | null>(null)
  const [isSavingCover, setIsSavingCover] = useState(false)

  const openCoverPicker = (family: Family) => {
    setCoverFamily(family)
    setCoverStep("products")
    setCoverProduct(null)
  }

  const closeCoverPicker = () => {
    if (isSavingCover) return
    setCoverFamily(null)
    setCoverStep("products")
    setCoverProduct(null)
  }

  const saveCoverImage = async (url: string) => {
    if (!coverFamily) return
    setIsSavingCover(true)
    try {
      const result = await updateProductFamily(coverFamily.id, { hero_image_url: url })
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Cover image updated")
        router.refresh()
        closeCoverPicker()
      }
    } finally {
      setIsSavingCover(false)
    }
  }

  const renameFamily = async (family: Family, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) { toast.error("Name can't be empty"); router.refresh(); return }
    if (trimmed === family.name) return
    const result = await updateProductFamily(family.id, { name: trimmed })
    if ("error" in result) {
      toast.error(result.error)
      router.refresh()
    } else {
      toast.success("Collection renamed")
      router.refresh()
    }
  }

  const openSelectProducts = (family: Family) => {
    setSelectFamily(family)
    setSelectedProductIds(new Set(products.filter((p) => p.family_id === family.id).map((p) => p.id)))
  }

  const closeSelectProducts = () => {
    if (isSavingSelection) return
    setSelectFamily(null)
    setSelectedProductIds(new Set())
  }

  const toggleProductInSelection = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const saveProductSelection = async () => {
    if (!selectFamily) return
    setIsSavingSelection(true)
    try {
      const result = await setFamilyProducts(selectFamily.id, Array.from(selectedProductIds))
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Products updated")
        router.refresh()
        closeSelectProducts()
      }
    } finally {
      setIsSavingSelection(false)
    }
  }

  const openDeleteFamily = (family: Family) => {
    setDeleteFamily(family)
  }

  const closeDeleteFamily = () => {
    if (isDeletingFamily) return
    setDeleteFamily(null)
  }

  const confirmDeleteFamily = async () => {
    if (!deleteFamily) return
    setIsDeletingFamily(true)
    try {
      const result = await deleteProductFamily(deleteFamily.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Collection deleted")
        router.refresh()
        setDeleteFamily(null)
      }
    } finally {
      setIsDeletingFamily(false)
    }
  }

  const handleCreateFamily = async () => {
    const trimmed = newFamilyName.trim()
    if (!trimmed) return
    setIsCreatingFamily(true)
    try {
      const result = await upsertProductFamily(brand.id, trimmed)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Collection created")
        router.refresh()
        setShowCreateFamily(false)
        setNewFamilyName("")
      }
    } finally {
      setIsCreatingFamily(false)
    }
  }

  const productCountByFamily = (familyId: string) =>
    products.filter((p) => p.family_id === familyId).length

  const resetModal = () => {
    setProductUrl("")
    setDetectMode(null)
    setDiscovered([])
    setSelected(new Set())
  }

  // URL heuristic — checks the terminal path segment. Listing-ish endpoints
  // ("products", "collections", "shop", etc.) flag as a collection; a deep
  // path ending in a slug-like segment flags as a single product. Hand-wavy
  // but works for the big-name shop URL patterns (Shopify, WooCommerce,
  // custom storefronts). User can toggle if wrong.
  const guessMode = (raw: string): "single" | "collection" => {
    try {
      const u = new URL(raw)
      const parts = u.pathname.split("/").filter(Boolean)
      if (parts.length === 0) return "collection"
      const listing = new Set(["products", "collections", "collection", "shop", "catalog", "all", "range"])
      const last = parts[parts.length - 1].toLowerCase()
      if (listing.has(last)) return "collection"
      const second = parts.length >= 2 ? parts[parts.length - 2].toLowerCase() : ""
      if (listing.has(second) && /^[a-z0-9][a-z0-9-_]*$/i.test(last)) return "single"
      return parts.length >= 2 ? "single" : "collection"
    } catch {
      return "collection"
    }
  }

  const inferSingleName = (raw: string): string => {
    try {
      const u = new URL(raw)
      const slug = u.pathname.split("/").filter(Boolean).pop() ?? "Product"
      return slug.replace(/[-_]+/g, " ").replace(/\.[a-z]+$/i, "").replace(/\b\w/g, (c) => c.toUpperCase())
    } catch {
      return raw
    }
  }

  const runDetect = async (overrideMode?: "single" | "collection") => {
    const url = productUrl.trim()
    if (!url) return
    const mode = overrideMode ?? guessMode(url)
    setDetectMode(mode)
    setIsDetecting(true)
    setDiscovered([])
    setSelected(new Set())
    try {
      if (mode === "single") {
        const item: DiscoveredProduct = { url, name: inferSingleName(url), imageUrl: null }
        setDiscovered([item])
        setSelected(new Set([item.url]))
      } else {
        const result = await discoverCatalog(url, brand.id)
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        if (result.products.length === 0) {
          toast.error("No product pages found on this URL.")
        }
        setDiscovered(result.products)
        setSelected(new Set(result.products.map((p) => p.url)))
      }
    } finally {
      setIsDetecting(false)
    }
  }

  const toggleSelect = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === discovered.length) setSelected(new Set())
    else setSelected(new Set(discovered.map((p) => p.url)))
  }

  const handleImport = () => {
    const items = discovered
      .filter((p) => selected.has(p.url))
      .map((p) => ({ url: p.url, name: p.name }))
    if (items.length === 0) return
    // Hand off to the import modal — it runs batchScrapeProducts itself and
    // reports progress + per-item results. Closing the detect modal first
    // keeps the z-stack tidy.
    setModalOpen(false)
    resetModal()
    setImportItems(items)
  }

  // ── Collection cover images ───────────────────────────────────────────
  // Fall back to the first product in the family when no hero image is set.
  const familyCoverImage = (family: Family): string | null => {
    if (family.hero_image_url) return family.hero_image_url
    const familyProducts = products.filter((p) => p.family_id === family.id)
    for (const p of familyProducts) {
      const primary = p.product_photos.find((ph) => ph.is_primary)
      if (primary) return primary.url
      if (p.product_photos.length > 0) {
        const sorted = [...p.product_photos].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        return sorted[0].url
      }
    }
    return null
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <style>{`
        .ec { position: relative; cursor: pointer; }
        .ec::before { content: ''; position: absolute; inset: -10px -14px; border: 1px solid transparent; border-radius: 5px; transition: border-color .18s; pointer-events: none; z-index: 0; }
        .ec:hover::before { border-color: #1c1c1a; }
        .ec.on::before { border-color: #016D75; }
        .ec.on { cursor: default; }
        .ec [contenteditable] { cursor: text; outline: none; }
        .ec [contenteditable]:empty::before { content: attr(data-placeholder); color: #c8c8c6; pointer-events: none; }
        .ec-badge { position: absolute; top: -18px; left: -8px; display: flex; align-items: center; gap: 4px; background: #fff; padding: 0 4px; pointer-events: none; z-index: 1; }
        .ec-ico { display: flex; align-items: center; color: #c8c8c6; transition: color .18s; }
        .ec-txt { font-size: 10px; font-weight: 400; letter-spacing: .04em; text-transform: uppercase; color: #c8c8c6; white-space: nowrap; transition: color .15s; }
        .ec:hover .ec-ico, .ec:hover .ec-txt { color: #1c1c1a; }
        .ec.on .ec-ico, .ec.on .ec-txt { color: #016D75; }
        .logo-edit { position: relative; cursor: pointer; }
        .logo-edit::after { content: 'Edit'; position: absolute; inset: 0; border-radius: 50%; background: rgba(0,0,0,.45); color: #fff; font-size: 12px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .15s; }
        .logo-edit:hover::after { opacity: 1; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .modal-panel { background: #fff; border-radius: 8px; max-width: 820px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,.24); }
        .product-status-pill { position: absolute; top: 12px; left: 12px; z-index: 2; display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,.95); border: 1px solid var(--rule); border-radius: 100px; padding: 5px 10px; font-size: 11px; font-weight: 500; color: var(--arco-black); text-transform: capitalize; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
        .product-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        /* ── Collection card ── */
        .family-card { position: relative; }
        .family-cover { position: relative; aspect-ratio: 1; border-radius: 4px; overflow: hidden; background: var(--arco-surface); margin-bottom: 8px; }
        .family-cover-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0); transition: background .15s; pointer-events: none; }
        .family-card:hover .family-cover-overlay { background: rgba(0,0,0,.35); pointer-events: auto; }
        .family-icon-btn { position: absolute; width: 30px; height: 30px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); color: #fff; border: 1px solid rgba(255,255,255,.2); cursor: pointer; opacity: 0; transition: opacity .15s, background .12s; z-index: 2; padding: 0; }
        .family-card:hover .family-icon-btn { opacity: 1; }
        .family-icon-btn.left { top: 8px; left: 8px; }
        .family-icon-btn.right { top: 8px; right: 8px; }
        .family-icon-btn:hover { background: rgba(0,0,0,.65); }
        .family-icon-btn.danger:hover { background: rgba(210,40,40,.75); border-color: transparent; }
        .family-select-pill { position: relative; display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-sans); font-size: 13px; font-weight: 400; color: #fff; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.25); border-radius: 100px; padding: 8px 18px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); cursor: pointer; opacity: 0; transition: opacity .15s, background .12s; z-index: 1; }
        .family-card:hover .family-select-pill { opacity: 1; }
        .family-select-pill:hover { background: rgba(0,0,0,.8); }
        .family-name-input { width: 100%; background: transparent; border: none; outline: none; padding: 0; font-family: inherit; font: inherit; color: var(--text-secondary); border-bottom: 1px dashed transparent; transition: border-color .12s, color .12s; }
        .family-name-input:hover { border-bottom-color: var(--rule); }
        .family-name-input:focus { border-bottom-color: var(--arco-accent); color: var(--arco-black); }
      `}</style>

      <Link href="/admin/brands" className="arco-small-text" style={{ display: "inline-block", marginBottom: 24 }}>
        ← All brands
      </Link>

      {/* ── Editable brand header (centered, like professional detail) ── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 16, marginBottom: 48, textAlign: "center" }}>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          style={{ display: "none" }}
          onChange={handleLogoChange}
        />
        <button
          type="button"
          onClick={handleLogoPick}
          className="logo-edit"
          style={{
            width: 96, height: 96, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            background: brand.logo_url ? "transparent" : "var(--arco-surface)",
            border: "none", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-secondary)", fontSize: 36,
          }}
          aria-label="Change logo"
        >
          {brand.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo_url} alt={brand.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span>{brand.name.charAt(0).toUpperCase()}</span>
          )}
        </button>

        <div style={{ maxWidth: 720, width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
          <EditableText
            as="h1"
            initialValue={brand.name}
            className="arco-page-title"
            placeholder="Brand name"
            badgeLabel="Name"
            onSave={(v) => saveField("name", v)}
            style={{ margin: 0, textAlign: "center" }}
          />
          <EditableText
            as="p"
            initialValue={brand.description ?? ""}
            className="arco-body-text"
            placeholder="Add a short description of this brand."
            badgeLabel="Description"
            multiline
            onSave={(v) => saveField("description", v)}
            style={{ margin: 0, textAlign: "center" }}
          />
        </div>
      </div>

      {/* ── Collections ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 48 }}>
        <div className="discover-results-meta" style={{ justifyContent: "space-between" }}>
          <p className="discover-results-count">
            <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{families.length}</strong>
            {" "}collection{families.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            className="btn-tertiary"
            style={{ fontSize: 13, padding: "6px 14px" }}
            onClick={() => setShowCreateFamily(true)}
          >
            Add collection
          </button>
        </div>

        {families.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px 16px" }}>
            <p className="arco-body-text empty-state__description">
              No collections yet. Add one to group related products together.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {families.map((family) => {
              const cover = familyCoverImage(family)
              const productCount = productCountByFamily(family.id)
              const hasProductsForCover = products.some((p) => p.family_id === family.id && p.product_photos.length > 0)
              return (
                <div key={family.id} className="family-card">
                  <div className="family-cover">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={family.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--text-secondary)" }}>
                        {family.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="family-cover-overlay">
                      <button
                        type="button"
                        className="family-icon-btn left"
                        onClick={() => openCoverPicker(family)}
                        disabled={!hasProductsForCover}
                        title={hasProductsForCover ? "Choose cover image" : "Add products to choose a cover"}
                        aria-label="Choose cover image"
                      >
                        <ImageIcon style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        type="button"
                        className="family-icon-btn right danger"
                        onClick={() => openDeleteFamily(family)}
                        title="Delete collection"
                        aria-label="Delete collection"
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        type="button"
                        className="family-select-pill"
                        onClick={() => openSelectProducts(family)}
                      >
                        Select products
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    defaultValue={family.name}
                    className="arco-xs-text family-name-input"
                    onBlur={(e) => void renameFamily(family, e.currentTarget.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { (e.target as HTMLInputElement).value = family.name; (e.target as HTMLInputElement).blur() } }}
                    aria-label="Collection name"
                  />
                  <span className="arco-xs-text" style={{ color: "var(--text-disabled)", display: "block" }}>
                    {productCount} product{productCount === 1 ? "" : "s"}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Products ──────────────────────────────────────────────────── */}
      <div className="discover-results-meta" style={{ justifyContent: "space-between" }}>
        <p className="discover-results-count">
          <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{products.length}</strong>
          {" "}product{products.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{ fontSize: 13, padding: "8px 18px" }}
          onClick={() => { resetModal(); setModalOpen(true) }}
        >
          Add products
        </button>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <p className="arco-body-text empty-state__description">No products yet. Use “Add products” to import them from the brand’s catalog.</p>
        </div>
      ) : (
        <div className="discover-grid">
          {products.map((product) => {
            const primary = product.product_photos.find((p) => p.is_primary) ?? product.product_photos[0]
            // Mirror the listings page: green dot for listed, amber for drafts,
            // red for deactivated, grey for anything else.
            const dotColor =
              product.status === "listed" ? "#22c55e"
              : product.status === "draft" ? "#f59e0b"
              : product.status === "deactivated" ? "#ef4444"
              : "#c8c8c6"
            const isDropdownOpen = openDropdown === product.id
            return (
              <div
                key={product.id}
                className="discover-card"
                style={{ position: "relative", cursor: "pointer" }}
                onClick={(e) => {
                  if (!(e.target as Element).closest(".dropdown-menu")) {
                    handleEditProduct(product)
                  }
                }}
              >
                <div
                  className="discover-card-image-wrap"
                  style={{ position: "relative" }}
                  onMouseEnter={(e) => {
                    const overlay = e.currentTarget.querySelector<HTMLElement>(".product-card-hover-overlay")
                    const pill = e.currentTarget.querySelector<HTMLElement>(".product-card-hover-pill")
                    if (overlay) overlay.style.background = "rgba(0,0,0,.35)"
                    if (pill) pill.style.opacity = "1"
                  }}
                  onMouseLeave={(e) => {
                    const overlay = e.currentTarget.querySelector<HTMLElement>(".product-card-hover-overlay")
                    const pill = e.currentTarget.querySelector<HTMLElement>(".product-card-hover-pill")
                    if (overlay) overlay.style.background = "transparent"
                    if (pill) pill.style.opacity = "0"
                  }}
                >
                  {primary ? (
                    <div className="discover-card-image-layer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={primary.url} alt={product.name} />
                    </div>
                  ) : (
                    <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                  )}

                  {/* Hover overlay with "Edit product" pill */}
                  <div
                    className="product-card-hover-overlay"
                    style={{
                      position: "absolute", inset: 0, zIndex: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "transparent", transition: "background .2s",
                      pointerEvents: "none",
                    }}
                  >
                    <span
                      className="product-card-hover-pill"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 400,
                        color: "#fff", background: "rgba(0,0,0,.6)",
                        border: "1px solid rgba(255,255,255,.25)", borderRadius: 100,
                        padding: "8px 18px",
                        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                        opacity: 0, transition: "opacity .2s",
                      }}
                    >
                      Edit product
                    </span>
                  </div>

                  {/* Status pill — top-left, clickable */}
                  <div style={{ position: "absolute", top: 12, left: 12, zIndex: 2 }}>
                    <button
                      className="filter-pill flex items-center gap-1.5"
                      onClick={(e) => { e.stopPropagation(); openStatusModal(product) }}
                    >
                      <span className="inline-block w-[7px] h-[7px] rounded-full shrink-0" style={{ background: dotColor }} />
                      <span className="text-xs font-medium">{product.status}</span>
                    </button>
                  </div>

                  {/* 3-dot menu — top-right */}
                  <div
                    className="dropdown-menu"
                    style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="filter-pill"
                      onClick={() => setOpenDropdown(isDropdownOpen ? null : product.id)}
                      data-open={isDropdownOpen ? "true" : undefined}
                      aria-label="Product options"
                      style={{ padding: "6px 8px", gap: 0 }}
                    >
                      <MoreHorizontal style={{ width: 16, height: 16 }} />
                    </button>
                    <div
                      className="filter-dropdown"
                      data-open={isDropdownOpen ? "true" : undefined}
                      data-align="right"
                      style={{ minWidth: 180, top: "calc(100% + 6px)" }}
                    >
                      {([
                        { label: "Edit product", action: () => handleEditProduct(product) },
                        { label: "Update status", action: () => openStatusModal(product) },
                        { label: "Change cover", action: handleChangeCover },
                        { label: "View product", action: () => handleViewProduct(product) },
                      ] as const).map(({ label, action }) => (
                        <div
                          key={label}
                          className="filter-dropdown-option"
                          onClick={action}
                          role="menuitem"
                        >
                          <span className="filter-dropdown-label">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <h3 className="discover-card-title">{product.name}</h3>
                {(() => {
                  const family = product.family_id
                    ? families.find((f) => f.id === product.family_id)?.name ?? null
                    : null
                  const category = product.category?.name ?? null
                  const subtitle = [family, category].filter(Boolean).join(" · ")
                  if (!subtitle) return null
                  return <p className="discover-card-sub">{subtitle}</p>
                })()}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create collection popup ───────────────────────────────────── */}
      {showCreateFamily && (
        <div className="popup-overlay" onClick={() => !isCreatingFamily && setShowCreateFamily(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Add collection</h3>
              <button
                type="button"
                className="popup-close"
                onClick={() => !isCreatingFamily && setShowCreateFamily(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 16 }}>
              Group related products under a named collection. You can add products after creating it.
            </p>
            <input
              type="text"
              autoFocus
              placeholder="Collection name"
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newFamilyName.trim()) void handleCreateFamily() }}
              className="input-base input-default"
              style={{ width: "100%", marginBottom: 20 }}
              disabled={isCreatingFamily}
            />
            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => setShowCreateFamily(false)}
                disabled={isCreatingFamily}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleCreateFamily()}
                disabled={isCreatingFamily || !newFamilyName.trim()}
                style={{ flex: 1 }}
              >
                {isCreatingFamily ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cover image picker popup ──────────────────────────────────── */}
      {coverFamily && (() => {
        const familyProducts = products.filter((p) => p.family_id === coverFamily.id && p.product_photos.length > 0)
        return (
          <div className="popup-overlay" onClick={closeCoverPicker}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, padding: 0, display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px", background: "var(--arco-off-white)", borderRadius: "12px 12px 0 0", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {coverStep === "photos" && (
                    <button
                      type="button"
                      className="popup-close"
                      onClick={() => { setCoverStep("products"); setCoverProduct(null) }}
                      aria-label="Back"
                      style={{ display: "flex" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 12L6 8L10 4" />
                      </svg>
                    </button>
                  )}
                  <h3 className="arco-section-title" style={{ margin: 0 }}>
                    {coverStep === "products" ? `Cover for ${coverFamily.name}` : `Select photo`}
                  </h3>
                </div>
                <button type="button" className="popup-close" onClick={closeCoverPicker} aria-label="Close">✕</button>
              </div>

              <div style={{ padding: "16px 28px 28px", overflowY: "auto", flex: 1 }}>
                {coverStep === "products" && (
                  familyProducts.length === 0 ? (
                    <p className="arco-body-text" style={{ color: "var(--text-secondary)" }}>
                      No products with photos in this collection yet.
                    </p>
                  ) : (
                    <>
                      <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 16 }}>
                        Pick a product, then choose one of its photos as the collection cover.
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {familyProducts.map((product) => {
                          const primary = product.product_photos.find((ph) => ph.is_primary) ?? product.product_photos[0]
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => { setCoverProduct(product); setCoverStep("photos") }}
                              style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--arco-rule)", background: "none", cursor: "pointer", textAlign: "left", width: "100%", transition: "background 0.1s", fontFamily: "var(--font-sans)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arco-off-white)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                            >
                              {primary ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={primary.url} alt="" style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 60, height: 40, borderRadius: 4, background: "var(--arco-off-white)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <ImageIcon style={{ width: 16, height: 16, color: "var(--arco-rule)" }} />
                                </div>
                              )}
                              <span style={{ fontSize: 14, fontWeight: 400, color: "var(--arco-black)" }}>
                                {product.name}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )
                )}

                {coverStep === "photos" && coverProduct && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", margin: 0 }}>
                        Select a photo from <strong>{coverProduct.name}</strong>
                      </p>
                      <button
                        type="button"
                        onClick={() => { setCoverStep("products"); setCoverProduct(null) }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#016D75", fontFamily: "var(--font-sans)", whiteSpace: "nowrap", flexShrink: 0 }}
                      >
                        Change product
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                      {coverProduct.product_photos.map((photo, i) => (
                        <button
                          key={`${coverProduct.id}-${i}`}
                          type="button"
                          onClick={() => void saveCoverImage(photo.url)}
                          disabled={isSavingCover}
                          style={{ position: "relative", border: "2px solid transparent", borderRadius: 6, overflow: "hidden", cursor: "pointer", padding: 0, background: "none", transition: "border-color 0.15s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#016D75")}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt="" style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", display: "block" }} />
                          {photo.is_primary && (
                            <span style={{ position: "absolute", top: 4, left: 4, fontSize: 9, fontWeight: 600, color: "white", background: "rgba(0,0,0,0.5)", padding: "1px 6px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              Primary
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Select products popup ─────────────────────────────────────── */}
      {selectFamily && (
        <div className="popup-overlay" onClick={closeSelectProducts}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Select products</h3>
              <button type="button" className="popup-close" onClick={closeSelectProducts} aria-label="Close">✕</button>
            </div>
            <p className="arco-small-text" style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Choose which products belong to <strong style={{ color: "var(--text-primary)" }}>{selectFamily.name}</strong>. Products can only belong to one collection at a time.
            </p>

            {products.length === 0 ? (
              <p className="arco-body-text" style={{ color: "var(--text-secondary)" }}>
                No products on this brand yet.
              </p>
            ) : (
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", border: "1px solid var(--rule)", borderRadius: 4, marginBottom: 20 }}>
                {products.map((product) => {
                  const isChecked = selectedProductIds.has(product.id)
                  const otherFamilyId = product.family_id && product.family_id !== selectFamily.id ? product.family_id : null
                  const otherFamilyName = otherFamilyId ? families.find((f) => f.id === otherFamilyId)?.name : null
                  const primary = product.product_photos.find((p) => p.is_primary) ?? product.product_photos[0]
                  return (
                    <label
                      key={product.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        borderBottom: "1px solid var(--rule)",
                        cursor: "pointer",
                        background: isChecked ? "var(--arco-surface)" : "transparent",
                        transition: "background .1s",
                      }}
                    >
                      <input
                        type="checkbox"
                        className="arco-table-checkbox"
                        checked={isChecked}
                        onChange={() => toggleProductInSelection(product.id)}
                      />
                      <div style={{ width: 40, height: 40, borderRadius: 3, overflow: "hidden", background: "var(--arco-surface)", flexShrink: 0 }}>
                        {primary && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={primary.url} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="arco-table-primary">{product.name}</div>
                        {otherFamilyName && (
                          <div className="arco-small-text" style={{ color: "var(--text-secondary)", marginTop: 2 }}>
                            In: {otherFamilyName}
                          </div>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span className="arco-small-text">
                <strong style={{ color: "var(--text-primary)" }}>{selectedProductIds.size}</strong> of {products.length} selected
              </span>
            </div>

            <div className="popup-actions">
              <button type="button" className="btn-tertiary" onClick={closeSelectProducts} disabled={isSavingSelection} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void saveProductSelection()}
                disabled={isSavingSelection}
                style={{ flex: 1 }}
              >
                {isSavingSelection ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete collection popup ───────────────────────────────────── */}
      {deleteFamily && (() => {
        const productsInFamily = productCountByFamily(deleteFamily.id)
        return (
          <div className="popup-overlay" onClick={closeDeleteFamily}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="popup-header">
                <h3 className="arco-section-title">Delete collection</h3>
                <button type="button" className="popup-close" onClick={closeDeleteFamily} aria-label="Close">✕</button>
              </div>

              <p className="arco-body-text" style={{ marginBottom: 16 }}>
                Delete <strong>{deleteFamily.name}</strong>? This action can't be undone.
              </p>

              {productsInFamily > 0 && (
                <div className="arco-alert arco-alert--warn" style={{ marginBottom: 20 }}>
                  <AlertTriangle className="arco-alert-icon" />
                  <div>
                    <p style={{ fontWeight: 500 }}>
                      {productsInFamily} product{productsInFamily === 1 ? " is" : "s are"} in this collection
                    </p>
                    <p>
                      {productsInFamily === 1 ? "It" : "They"} will be removed from the collection but kept on the brand.
                    </p>
                  </div>
                </div>
              )}

              <div className="popup-actions">
                <button type="button" className="btn-tertiary" onClick={closeDeleteFamily} disabled={isDeletingFamily} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void confirmDeleteFamily()}
                  disabled={isDeletingFamily}
                  style={{ flex: 1, background: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
                >
                  {isDeletingFamily ? "Deleting…" : "Delete collection"}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Product status modal ──────────────────────────────────────── */}
      {statusProduct && (() => {
        const cover = statusProduct.product_photos.find((p) => p.is_primary) ?? statusProduct.product_photos[0]
        return (
          <div className="popup-overlay" onClick={closeStatusModal}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="popup-header">
                <h3 className="arco-section-title">Update status</h3>
                <button type="button" className="popup-close" onClick={closeStatusModal} aria-label="Close">✕</button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 4, overflow: "hidden", background: "var(--arco-surface)", flexShrink: 0 }}>
                  {cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.url} alt={statusProduct.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p className="arco-card-title" style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{statusProduct.name}</p>
                  <p className="arco-small-text" style={{ margin: 0, color: "var(--text-secondary)" }}>{brand.name}</p>
                </div>
              </div>

              <div className="status-modal-options">
                {([
                  { value: "listed" as const, label: "Listed", description: "Visible on the public product pages.", colorClass: "bg-green-500" },
                  { value: "unlisted" as const, label: "Unlisted", description: "Hidden from the public product pages.", colorClass: "bg-gray-400" },
                ]).map((option) => {
                  const isSelected = draftStatus === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`status-modal-option${isSelected ? " selected" : ""}`}
                      onClick={() => setDraftStatus(option.value)}
                      disabled={isSavingStatus}
                    >
                      <span className={`status-modal-dot ${option.colorClass}`} />
                      <div className="status-modal-option-text">
                        <span className="status-modal-option-label">{option.label}</span>
                        <span className="status-modal-option-desc">{option.description}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="popup-actions">
                <button type="button" className="btn-tertiary" onClick={closeStatusModal} disabled={isSavingStatus} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void saveStatus()}
                  disabled={isSavingStatus || !draftStatus}
                  style={{ flex: 1 }}
                >
                  {isSavingStatus ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Add products modal ───────────────────────────────────────── */}
      {importItems && (
        <ProductsImportModal
          items={importItems}
          brandId={brand.id}
          onClose={(didImport) => {
            setImportItems(null)
            if (didImport) router.refresh()
          }}
        />
      )}

      {modalOpen && (
        <div
          className="popup-overlay"
          onClick={() => {
            if (isDetecting) return
            setModalOpen(false)
            resetModal()
          }}
        >
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, padding: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--rule)" }}>
              <h3 className="arco-section-title" style={{ margin: 0 }}>Add products</h3>
              <button
                type="button"
                onClick={() => {
                  if (isDetecting) return
                  setModalOpen(false)
                  resetModal()
                }}
                aria-label="Close"
                style={{ background: "none", border: "none", fontSize: 22, color: "var(--text-secondary)", cursor: "pointer", lineHeight: 1, padding: 4 }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 24 }}>
              <p className="arco-small-text" style={{ marginBottom: 12, color: "var(--text-secondary)" }}>
                Paste a product link or a collection/catalog page. We’ll detect what it is and preview the products before importing.
              </p>
              <div className="flex gap-2" style={{ marginBottom: 4 }}>
                <input
                  type="url"
                  placeholder={`https://www.${brand.domain ?? "brand.com"}/products/...`}
                  value={productUrl}
                  onChange={(e) => { setProductUrl(e.target.value); setDetectMode(null); setDiscovered([]) }}
                  onKeyDown={(e) => { if (e.key === "Enter") void runDetect() }}
                  className="input-base input-default"
                  style={{ flex: 1 }}
                  disabled={isDetecting}
                />
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: 14, padding: "10px 20px" }}
                  onClick={() => void runDetect()}
                  disabled={isDetecting || !productUrl.trim()}
                >
                  {isDetecting ? "Detecting…" : "Detect"}
                </button>
              </div>

              {detectMode && !isDetecting && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 20px", fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>
                    Detected as <strong style={{ color: "var(--text-primary)" }}>{detectMode === "single" ? "single product" : "collection"}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => void runDetect(detectMode === "single" ? "collection" : "single")}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#016D75", padding: 0, fontFamily: "var(--font-sans)" }}
                  >
                    Treat as {detectMode === "single" ? "collection" : "single product"}
                  </button>
                </div>
              )}

              {discovered.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span className="arco-small-text">
                      <strong style={{ color: "var(--text-primary)" }}>{selected.size}</strong> of {discovered.length} selected
                    </span>
                    {discovered.length > 1 && (
                      <button
                        type="button"
                        className="btn-tertiary"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        onClick={toggleAll}
                      >
                        {selected.size === discovered.length ? "Deselect all" : "Select all"}
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid var(--rule)", borderRadius: 4, marginBottom: 20 }}>
                    {discovered.map((product) => {
                      const isSelected = selected.has(product.url)
                      return (
                        <label
                          key={product.url}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderBottom: "1px solid var(--rule)",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            className="arco-table-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(product.url)}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="arco-table-primary">{product.name}</div>
                            <div className="arco-table-secondary" style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.url}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>

                  <div className="popup-actions">
                    <button
                      type="button"
                      className="btn-tertiary"
                      onClick={() => { setModalOpen(false); resetModal() }}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleImport()}
                      disabled={selected.size === 0}
                      style={{ flex: 1 }}
                    >
                      {`Import ${selected.size} product${selected.size === 1 ? "" : "s"}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
