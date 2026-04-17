"use client"

import { memo, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ImageIcon, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import {
  addProductAxisValue,
  deleteProductPhoto,
  removeProductAxisValue,
  renameProductAxisValue,
  renameProductSpec,
  setCombinationImage,
  setProductAxisValueHex,
  setProductAxisValueImage,
  setProductColors,
  setProductCover,
  setProductModels,
  updateProduct,
  updateProductSpec,
  toggleSpecScope,
  updateSpecLayout,
  updateProductStatus,
  uploadProductPhotos,
  upsertProductFamily,
} from "../../brands/actions"
import { groupSpecs, specLabel, specGroup as defaultSpecGroup, matchKnownSpecs, type KnownSpec } from "@/lib/products/spec-groups"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AdminProductSubNav } from "@/components/product/admin-product-sub-nav"

type Brand = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  domain: string | null
}

type Category = {
  id: string
  slug: string
  name: string
  parent_id: string | null
}

type Family = {
  id: string
  slug: string
  name: string
}

type Photo = {
  id: string
  url: string
  alt_text: string | null
  is_primary: boolean
  order_index: number
}

type Product = {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  source_url: string | null
  specs: Record<string, any> | null
  spec_order: string[] | null
  spec_groups: Record<string, string> | null
  variants: Array<Record<string, any>> | null
  brand: Brand | null
  family: (Family & { slug: string }) | null
  category: (Category & { slug: string }) | null
  product_photos: Photo[]
}

type Sibling = {
  id: string
  slug: string
  name: string
  imageUrl: string | null
}

/* ────────────────────────────────────────────────────────────────
   EditableText — contentEditable-based editor that keeps
   typography consistent between view and edit modes.
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
  as: "h1" | "p" | "span"
  className: string
  placeholder: string
  badgeLabel: string
  multiline?: boolean
  onSave: (value: string) => void
  style?: React.CSSProperties
}) {
  const ecRef = useRef<HTMLDivElement>(null)
  const elRef = useRef<HTMLElement | null>(null)
  const savedValueRef = useRef(initialValue)

  useEffect(() => {
    if (elRef.current && initialValue && !elRef.current.textContent) {
      elRef.current.textContent = initialValue
      savedValueRef.current = initialValue
    }
  }, [initialValue])

  const commonProps: any = {
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
    <div ref={ecRef} className="ec" style={{ display: "block", width: "100%" }}>
      <span className="ec-badge">
        <span className="ec-ico">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11.5 1.5l3 3L5 14H2v-3z" />
          </svg>
        </span>
        <span className="ec-txt">{badgeLabel}</span>
      </span>
      {as === "h1" ? <h1 {...commonProps} /> : as === "p" ? <p {...commonProps} /> : <span {...commonProps} />}
    </div>
  )
})

/* ────────────────────────────────────────────────────────────────
   EditableSpec — detail-bar cell with a dropdown or free-form edit.
   ──────────────────────────────────────────────────────────────── */
function EditableSpec({
  label,
  value,
  displayValue,
  placeholder,
  options,
  onSave,
  onAddOption,
}: {
  label: string
  value: string | null
  /** Shortened display string for resting state. Full value shown in edit. */
  displayValue?: string | null
  placeholder: string
  /** When supplied, value is picked from this list; otherwise free-form. */
  options?: { value: string; label: string; group?: string }[]
  onSave: (value: string | null) => void
  /** When supplied, users can type a new option and it's created on save. */
  onAddOption?: (name: string) => Promise<{ value: string } | { error: string }>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value ?? "")
  }, [value])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [isOpen])

  const isDropdown = !!options

  const commitFreeForm = () => {
    const trimmed = draft.trim()
    const next = trimmed.length === 0 ? null : trimmed
    if (next !== (value ?? null)) onSave(next)
    setIsOpen(false)
  }

  const selectOption = (optValue: string | null) => {
    onSave(optValue)
    setIsOpen(false)
  }

  const selectedLabel = options?.find((o) => o.value === value)?.label ?? displayValue ?? value

  return (
    <div ref={ref} className={`spec-item-edit${isOpen ? " editing" : ""}`}>
      <span className="ec-badge">
        <span className="ec-ico">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11.5 1.5l3 3L5 14H2v-3z" />
          </svg>
        </span>
        <span className="ec-txt">Edit</span>
      </span>

      <span className="arco-eyebrow spec-eyebrow">{label}</span>

      {isDropdown ? (
        <>
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="arco-card-title"
            style={{
              background: "transparent", border: "none", padding: 0, cursor: "pointer",
              color: selectedLabel ? undefined : "#b0b0ae",
              width: "100%", textAlign: "center",
            }}
          >
            {selectedLabel || placeholder}
          </button>
          {isOpen && (
            <div className="dd-panel" style={{ maxHeight: 320 }}>
              <div
                className={`dd-row${!value ? " sel" : ""}`}
                onClick={() => selectOption(null)}
                style={{ color: "#a1a1a0" }}
              >
                <span>— None —</span>
              </div>
              {(() => {
                // Group options if any have a group key so parent categories
                // appear as section headers.
                const grouped: Record<string, typeof options> = {}
                for (const opt of options!) {
                  const g = opt.group ?? ""
                  if (!grouped[g]) grouped[g] = []
                  grouped[g]!.push(opt)
                }
                return Object.entries(grouped).flatMap(([group, items]) => [
                  group ? <div key={`g-${group}`} className="dd-group-label">{group}</div> : null,
                  ...(items ?? []).map((opt) => (
                    <div
                      key={opt.value}
                      className={`dd-row${opt.value === value ? " sel" : ""}`}
                      onClick={() => selectOption(opt.value)}
                    >
                      <span>{opt.label}</span>
                      {opt.value === value && <span className="dd-check">✓</span>}
                    </div>
                  )),
                ])
              })()}
              {onAddOption && (
                <div style={{ borderTop: "1px solid #e8e8e6", padding: "8px 10px" }}>
                  <input
                    type="text"
                    placeholder="+ Add new"
                    className="spec-inp"
                    style={{ fontSize: 13 }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        const name = (e.target as HTMLInputElement).value.trim()
                        if (!name) return
                        const result = await onAddOption(name)
                        if ("error" in result) toast.error(result.error)
                        else selectOption(result.value)
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {isOpen ? (
            <input
              ref={inputRef}
              autoFocus
              className="spec-inp"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitFreeForm}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                if (e.key === "Escape") { setDraft(value ?? ""); setIsOpen(false) }
              }}
            />
          ) : (
            <div
              className="arco-card-title"
              onClick={() => setIsOpen(true)}
              style={{ color: value ? undefined : "#b0b0ae", cursor: "pointer" }}
            >
              {value || placeholder}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
   Main page component
   ──────────────────────────────────────────────────────────────── */
export function ProductDetailClient({
  product,
  categories,
  families,
  familySiblings,
  brandSiblings,
}: {
  product: Product
  categories: Category[]
  families: Family[]
  familySiblings: Sibling[]
  brandSiblings: Sibling[]
}) {
  const router = useRouter()
  const p = product

  // Specs are stored scoped (`_shared` + per-model buckets) but legacy
  // products still have a flat object. `specsScoped` always returns the
  // scoped shape so downstream code doesn't have to branch. `sharedSpecs`
  // is the flat merge used for designer/year/etc. in the details bar.
  const rawSpecs = p.specs as Record<string, any> | null
  const specsScoped: Record<string, Record<string, any>> = (() => {
    if (!rawSpecs) return {}
    const firstVal = Object.values(rawSpecs)[0]
    const looksScoped =
      firstVal !== undefined
      && Object.values(rawSpecs).every((v) => v && typeof v === "object" && !Array.isArray(v))
    return looksScoped ? rawSpecs : { _shared: rawSpecs }
  })()
  const sharedSpecs = specsScoped._shared ?? {}
  // Only the bar still uses the flat `specs` alias — drop the any-cast
  // as we migrate the rest of this file.
  const specs = sharedSpecs

  const saveField = async (patch: Parameters<typeof updateProduct>[1]) => {
    const result = await updateProduct(p.id, patch)
    if ("error" in result) {
      toast.error(result.error)
      router.refresh()
    } else {
      toast.success("Saved")
      router.refresh()
    }
  }

  const saveSpec = async (scope: string, key: string, value: unknown) => {
    const result = await updateProductSpec(p.id, scope, key, value)
    if ("error" in result) {
      toast.error(result.error)
    }
    router.refresh()
  }

  const renameSpecKey = async (scope: string, oldKey: string, newKey: string) => {
    const result = await renameProductSpec(p.id, scope, oldKey, newKey)
    if ("error" in result) {
      toast.error(result.error)
    }
    router.refresh()
  }

  // ── Photos ─────────────────────────────────────────────────────────────
  const photos = [...p.product_photos].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return (a.order_index ?? 0) - (b.order_index ?? 0)
  })

  const variants = (p.variants ?? []) as Array<Record<string, any>>
  // Cover picker picks from photos that aren't tied to a specific variant —
  // a color/model image on the cover would be confusing.
  const normaliseUrl = (u: string) => u.toLowerCase().replace(/\/+$/, "")
  const variantImageUrls = new Set(
    variants.map((v: any) => v.image_url).filter(Boolean).map((u: string) => normaliseUrl(u)),
  )
  const nonVariantPhotos = photos.filter((ph) => !variantImageUrls.has(normaliseUrl(ph.url)))
  const heroPhoto = nonVariantPhotos.find((ph) => ph.is_primary) ?? nonVariantPhotos[0] ?? null

  // Gallery includes every photo on the product — variant-linked tiles get
  // a dot/pill badge so admins can see which combination an image represents.
  // Variant images not yet in product_photos render as "virtual" tiles whose
  // delete icon unlinks the variant instead of deleting a photo row.
  type VariantMeta = { colorLabel?: string; colorHex?: string | null; modelLabel?: string; colorKey?: string; modelKey?: string }
  const variantByUrl = new Map<string, VariantMeta>()
  for (const v of variants) {
    const url = (v.image_url as string | undefined) ?? null
    if (!url) continue
    const key = normaliseUrl(url)
    const existing = variantByUrl.get(key) ?? {}
    // Flat shape (independent axes)
    if (v.color) { existing.colorLabel = String(v.color); existing.colorHex = (v.hex as string | null | undefined) ?? null }
    if (v.size) existing.modelLabel = String(v.size)
    // Combination shape (attributes)
    if (v.attributes && typeof v.attributes === "object") {
      const attrs = v.attributes as Record<string, string>
      if (attrs.color) {
        existing.colorLabel = attrs.color
        if (!existing.colorHex && v.hex) existing.colorHex = String(v.hex)
      }
      const model = attrs.model ?? attrs.size
      if (model) existing.modelLabel = model
    }
    variantByUrl.set(key, existing)
  }

  type GalleryItem = {
    key: string
    url: string
    photoId: string | null
    altText: string | null
    isPrimary: boolean
    meta: VariantMeta | null
  }

  const galleryItems: GalleryItem[] = photos.map((ph) => ({
    key: `photo-${ph.id}`,
    url: ph.url,
    photoId: ph.id,
    altText: ph.alt_text,
    isPrimary: ph.is_primary,
    meta: variantByUrl.get(normaliseUrl(ph.url)) ?? null,
  }))
  const knownUrls = new Set(photos.map((ph) => normaliseUrl(ph.url)))
  for (const [key, meta] of variantByUrl) {
    if (knownUrls.has(key)) continue
    const variant = variants.find((v) => v.image_url && normaliseUrl(String(v.image_url)) === key)
    const url = variant?.image_url as string | undefined
    if (!url) continue
    galleryItems.push({
      key: `variant-${key}`,
      url,
      photoId: null,
      altText: null,
      isPrimary: false,
      meta,
    })
  }
  // Show unassigned photos first, variant-linked photos second.
  // Within each group, preserve the insertion order (upload order for
  // photos, variant-definition order for variants).
  galleryItems.sort((a, b) => {
    const aVariant = a.meta ? 1 : 0
    const bVariant = b.meta ? 1 : 0
    return aVariant - bVariant
  })

  // Upload / delete state — mirrors the project edit page flow.
  const [isUploading, setIsUploading] = useState(false)
  const [photoDeleteConfirmId, setPhotoDeleteConfirmId] = useState<string | null>(null)
  // Photos section filter: "all" shows everything, "gallery" shows only
  // photos not tied to a variant, "variants" shows only variant-linked ones.
  const [photoFilter, setPhotoFilter] = useState<"all" | "gallery" | "variants">("all")
  // Specs section: which model is active (null = shared-only view).
  // "Add spec" state is keyed per scope so the input survives scope
  // switches without bleeding values between models.
  // Default to the first model so users never see a raw "Shared" view.
  // Shared specs merge into every model's view automatically. Derived
  // from raw variants since modelRows state is declared later.
  const firstModelLabel = (() => {
    const vs = (p.variants ?? []) as Array<Record<string, any>>
    for (const v of vs) {
      const m = v.attributes?.model ?? v.attributes?.size ?? v.size
      if (typeof m === "string" && m.trim()) return m
    }
    return null
  })()
  const [specsModelScope, setSpecsModelScope] = useState<string | null>(firstModelLabel)
  const [addSpecScope, setAddSpecScope] = useState<string | null>(null)
  const [addSpecKey, setAddSpecKey] = useState("")
  const [addSpecValue, setAddSpecValue] = useState("")
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  // Cover picker state — opens a grid of all product photos.
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [isSettingCover, setIsSettingCover] = useState(false)

  // Variant (color/model) image picker — reuses the same photo grid but
  // writes the chosen URL into the variant row instead of flipping is_primary.
  const [variantPickerKind, setVariantPickerKind] = useState<"color" | "model" | "combo" | null>(null)
  const [isSavingCombinationImage, setIsSavingCombinationImage] = useState(false)
  const [heroUnlinkConfirmOpen, setHeroUnlinkConfirmOpen] = useState(false)
  // Deletion confirmation for an axis value (color or model). Holds the
  // axis kind + row key + label so the popup can render a meaningful
  // message and fire the right handler on confirm.
  const [deleteAxisConfirm, setDeleteAxisConfirm] = useState<
    { axis: "color" | "model"; key: string; label: string } | null
  >(null)

  const handleSetCover = async (photoId: string) => {
    if (photoId === heroPhoto?.id) { setCoverPickerOpen(false); return }
    setIsSettingCover(true)
    try {
      const result = await setProductCover(photoId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Cover updated")
        router.refresh()
        setCoverPickerOpen(false)
      }
    } finally {
      setIsSettingCover(false)
    }
  }

  // ── Status modal (opened from the sub-nav status pill) ────────────────
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [draftStatus, setDraftStatus] = useState<"listed" | "unlisted">(
    p.status === "unlisted" ? "unlisted" : "listed",
  )
  const [isSavingStatus, setIsSavingStatus] = useState(false)

  const openStatusModal = () => {
    setDraftStatus(p.status === "unlisted" ? "unlisted" : "listed")
    setStatusModalOpen(true)
  }
  const closeStatusModal = () => {
    if (isSavingStatus) return
    setStatusModalOpen(false)
  }
  const saveStatus = async () => {
    if (draftStatus === p.status) { setStatusModalOpen(false); return }
    setIsSavingStatus(true)
    try {
      const result = await updateProductStatus(p.id, draftStatus)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Status updated")
        router.refresh()
        setStatusModalOpen(false)
      }
    } finally {
      setIsSavingStatus(false)
    }
  }

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const formData = new FormData()
    Array.from(files).forEach((f) => formData.append("files", f))
    setIsUploading(true)
    try {
      const result = await uploadProductPhotos(p.id, formData)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(`Added ${result.photos.length} photo${result.photos.length === 1 ? "" : "s"}`)
        router.refresh()
      }
    } finally {
      setIsUploading(false)
      if (photoInputRef.current) photoInputRef.current.value = ""
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    const result = await deleteProductPhoto(photoId)
    if ("error" in result) {
      toast.error(result.error)
    } else {
      toast.success("Photo deleted")
      router.refresh()
    }
    setPhotoDeleteConfirmId(null)
  }

  const handleUnlinkVariantByUrl = async (url: string) => {
    const normalised = url.toLowerCase().replace(/\/+$/, "")
    // Mirror on the client so the UI updates before the server round-trip.
    const nextColors = colorRows.map((r) => (r.imageUrl && r.imageUrl.toLowerCase().replace(/\/+$/, "") === normalised ? { ...r, imageUrl: null } : r))
    const nextModels = modelRows.map((r) => (r.imageUrl && r.imageUrl.toLowerCase().replace(/\/+$/, "") === normalised ? { ...r, imageUrl: null } : r))
    if (nextColors.some((r, i) => r !== colorRows[i])) {
      setColorRows(nextColors)
      await persistColors(nextColors)
    }
    if (nextModels.some((r, i) => r !== modelRows[i])) {
      setModelRows(nextModels)
      await persistModels(nextModels)
    }
    setPhotoDeleteConfirmId(null)
  }

  // ── Colors ────────────────────────────────────────────────────────────
  // Presence of `attributes` on any row flips the product into combination
  // mode — the editor then shows a read-only-axis + combination-image grid
  // below (axes come from the combination rows instead of flat fields).
  const isCombinationMode = variants.some(
    (v) => v.attributes && typeof v.attributes === "object" && Object.keys(v.attributes).length > 0,
  )

  // Combination rows: every variant that carries a non-empty `attributes`
  // object. We derive the model/color axes from these so the pills/dots
  // below render the same regardless of source shape.
  type CombinationRow = { attributes: Record<string, string>; imageUrl: string | null; hex: string | null }
  const combinationRows: CombinationRow[] = isCombinationMode
    ? variants
        .filter((v) => v.attributes && typeof v.attributes === "object" && Object.keys(v.attributes).length > 0)
        .map((v) => ({
          attributes: v.attributes as Record<string, string>,
          imageUrl: (v.image_url as string | null | undefined) ?? null,
          hex: (v.hex as string | null | undefined) ?? null,
        }))
    : []

  // Walks combination rows to produce distinct color and model values.
  // Hex is stamped from the first row that has it for a given color.
  const comboColors: { label: string; hex: string | null }[] = (() => {
    if (!isCombinationMode) return []
    const map = new Map<string, { label: string; hex: string | null }>()
    for (const row of combinationRows) {
      const label = row.attributes.color
      if (!label) continue
      const existing = map.get(label)
      if (existing) {
        if (!existing.hex && row.hex) existing.hex = row.hex
      } else {
        map.set(label, { label, hex: row.hex ?? null })
      }
    }
    return [...map.values()]
  })()

  const comboModels: string[] = (() => {
    if (!isCombinationMode) return []
    const seen = new Set<string>()
    const out: string[] = []
    for (const row of combinationRows) {
      const label = row.attributes.model ?? row.attributes.size
      if (!label || seen.has(label)) continue
      seen.add(label)
      out.push(label)
    }
    return out
  })()

  type ColorRow = { key: string; label: string; hex: string | null; imageUrl: string | null }

  // Standalone axis rows (no `attributes`) coexist with combination rows —
  // they carry axis-level image/hex when a specific {color} or {size}
  // label isn't fully pinned to a combo cell. Look these up so combo
  // products can still assign color-only or model-only images.
  const standaloneColorRows = variants.filter(
    (v) => !!v.color && !(v.attributes && Object.keys(v.attributes).length > 0),
  )
  const standaloneModelRows = variants.filter(
    (v) => !!v.size && !(v.attributes && Object.keys(v.attributes).length > 0),
  )

  // Merge colors from both standalone rows AND combination rows. Each
  // unique label appears once; standalone row carries the axis-level
  // image/hex, combo row contributes hex if the standalone doesn't have it.
  const initialColorRows: ColorRow[] = (() => {
    const map = new Map<string, ColorRow>()
    let idx = 0
    // Standalone rows first — they own axis-level images.
    for (const v of standaloneColorRows) {
      const label = String(v.color ?? "")
      if (!label || map.has(label)) continue
      map.set(label, {
        key: `existing-${idx++}`,
        label,
        hex: (v.hex as string | null | undefined) ?? null,
        imageUrl: (v.image_url as string | null | undefined) ?? null,
      })
    }
    // Combo-derived colors fill gaps (new colors only seen in combos).
    for (const c of comboColors) {
      if (map.has(c.label)) {
        const existing = map.get(c.label)!
        if (!existing.hex && c.hex) map.set(c.label, { ...existing, hex: c.hex })
        continue
      }
      map.set(c.label, {
        key: `combo-color-${idx++}`,
        label: c.label,
        hex: c.hex,
        imageUrl: null,
      })
    }
    return [...map.values()]
  })()

  const [colorRows, setColorRows] = useState<ColorRow[]>(initialColorRows)
  const [selectedColorKey, setSelectedColorKey] = useState<string | null>(null)
  const [isSavingColors, setIsSavingColors] = useState(false)
  const selectedColor = colorRows.find((r) => r.key === selectedColorKey) ?? null

  // Keep local state in sync when the server sends new variants (after a
  // refresh). Compare serialised rows rather than identity so edits in
  // flight don't get clobbered.
  useEffect(() => {
    const serverSerialised = JSON.stringify(initialColorRows.map(({ key: _k, ...rest }) => rest))
    const localSerialised = JSON.stringify(colorRows.map(({ key: _k, ...rest }) => rest))
    if (serverSerialised !== localSerialised && !isSavingColors) {
      setColorRows(initialColorRows)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.variants])

  const persistColors = async (rows: ColorRow[]) => {
    if (isCombinationMode) return
    setIsSavingColors(true)
    try {
      const result = await setProductColors(
        p.id,
        rows.map((r) => ({ label: r.label, hex: r.hex, image_url: r.imageUrl })),
      )
      if ("error" in result) {
        toast.error(result.error)
        router.refresh()
      } else {
        router.refresh()
      }
    } finally {
      setIsSavingColors(false)
    }
  }

  const makeColorKey = () => `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  // Client-side row tracking: each row has a stable `key` so we can map
  // local UI state → server axis value (row.label). The new granular
  // actions take the label directly; `key` is purely a React identity.
  const handleAddColor = async () => {
    const key = makeColorKey()
    const next: ColorRow[] = [...colorRows, { key, label: "", hex: null, imageUrl: null }]
    setColorRows(next)
    setSelectedColorKey(key)
    // Don't persist until the user gives it a label — blur will create
    // the standalone server row via addProductAxisValue.
  }

  const handleRemoveColor = async (key: string) => {
    const row = colorRows.find((r) => r.key === key)
    setColorRows((prev) => prev.filter((r) => r.key !== key))
    if (selectedColorKey === key) setSelectedColorKey(null)
    if (!row || !row.label.trim()) { router.refresh(); return }
    setIsSavingColors(true)
    try {
      const result = await removeProductAxisValue(p.id, "color", row.label)
      if ("error" in result) toast.error(result.error)
      router.refresh()
    } finally {
      setIsSavingColors(false)
    }
  }

  const handleLabelChange = (key: string, label: string) => {
    setColorRows((prev) => prev.map((r) => (r.key === key ? { ...r, label } : r)))
  }

  const handleLabelBlur = async (key: string) => {
    const row = colorRows.find((r) => r.key === key)
    if (!row) return
    const trimmed = row.label.trim()
    // Drop freshly-added rows that never got a name — nothing to persist.
    if (!trimmed) {
      setColorRows((prev) => prev.filter((r) => r.key !== key))
      if (selectedColorKey === key) setSelectedColorKey(null)
      return
    }
    // Brand-new local row (label set after add) → insert on the server.
    const isNew = key.startsWith("new-")
    setIsSavingColors(true)
    try {
      const result = isNew
        ? await addProductAxisValue(p.id, "color", trimmed, row.hex)
        : await renameProductAxisValue(p.id, "color", colorLabelAtLastSync(key) ?? trimmed, trimmed)
      if ("error" in result) toast.error(result.error)
      router.refresh()
    } finally {
      setIsSavingColors(false)
    }
  }

  // Snapshot of the color label as it was when the row was last synced
  // from the server. Used to compute old→new for renames.
  const lastSyncedColorLabelsRef = useRef<Map<string, string>>(new Map())
  useEffect(() => {
    const map = new Map<string, string>()
    for (const r of initialColorRows) map.set(r.key, r.label)
    lastSyncedColorLabelsRef.current = map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.variants])
  const colorLabelAtLastSync = (key: string) => lastSyncedColorLabelsRef.current.get(key)

  const handleHexChange = async (key: string, hex: string) => {
    const row = colorRows.find((r) => r.key === key)
    setColorRows((prev) => prev.map((r) => (r.key === key ? { ...r, hex } : r)))
    if (!row || !row.label.trim()) return
    setIsSavingColors(true)
    try {
      const result = await setProductAxisValueHex(p.id, row.label, hex)
      if ("error" in result) toast.error(result.error)
      router.refresh()
    } finally {
      setIsSavingColors(false)
    }
  }

  const handleClearColorImage = async (key: string) => {
    const row = colorRows.find((r) => r.key === key)
    setColorRows((prev) => prev.map((r) => (r.key === key ? { ...r, imageUrl: null } : r)))
    if (!row || !row.label.trim()) return
    setIsSavingColors(true)
    try {
      const result = await setProductAxisValueImage(p.id, "color", row.label, null)
      if ("error" in result) toast.error(result.error)
      router.refresh()
    } finally {
      setIsSavingColors(false)
    }
  }

  const handleAssignColorImage = async (key: string, url: string) => {
    const row = colorRows.find((r) => r.key === key)
    setColorRows((prev) => prev.map((r) => (r.key === key ? { ...r, imageUrl: url } : r)))
    if (!row || !row.label.trim()) return
    setIsSavingColors(true)
    try {
      const result = await setProductAxisValueImage(p.id, "color", row.label, url)
      if ("error" in result) toast.error(result.error)
      router.refresh()
    } finally {
      setIsSavingColors(false)
    }
  }

  // ── Models (size axis, exposed as "Model" in the admin) ───────────────
  type ModelRow = { key: string; label: string; imageUrl: string | null }

  // Same merge logic: standalone model rows + combo-derived models.
  const initialModelRows: ModelRow[] = (() => {
    const map = new Map<string, ModelRow>()
    let idx = 0
    for (const v of standaloneModelRows) {
      const label = String(v.size ?? "")
      if (!label || map.has(label)) continue
      map.set(label, {
        key: `existing-size-${idx++}`,
        label,
        imageUrl: (v.image_url as string | null | undefined) ?? null,
      })
    }
    for (const label of comboModels) {
      if (map.has(label)) continue
      map.set(label, {
        key: `combo-model-${idx++}`,
        label,
        imageUrl: null,
      })
    }
    return [...map.values()]
  })()

  const [modelRows, setModelRows] = useState<ModelRow[]>(initialModelRows)
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null)
  const [editingModelKey, setEditingModelKey] = useState<string | null>(null)
  const [editingColorKey, setEditingColorKey] = useState<string | null>(null)
  const [isSavingModels, setIsSavingModels] = useState(false)
  const selectedModel = modelRows.find((r) => r.key === selectedModelKey) ?? null

  // Clear the active pill selection when the user clicks anywhere outside
  // the pill rows or the hero image (where the color image is shown).
  useEffect(() => {
    if (!selectedColorKey && !selectedModelKey) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (t?.closest("[data-variant-keep-selection]")) return
      setSelectedColorKey(null)
      setSelectedModelKey(null)
      setEditingColorKey(null)
      setEditingModelKey(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [selectedColorKey, selectedModelKey])

  // Sync models from server on refresh, same pattern as colors.
  useEffect(() => {
    const serverSerialised = JSON.stringify(initialModelRows.map(({ key: _k, ...rest }) => rest))
    const localSerialised = JSON.stringify(modelRows.map(({ key: _k, ...rest }) => rest))
    if (serverSerialised !== localSerialised && !isSavingModels) {
      setModelRows(initialModelRows)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.variants])

  const persistModels = async (rows: ModelRow[]) => {
    if (isCombinationMode) return
    setIsSavingModels(true)
    try {
      const result = await setProductModels(
        p.id,
        rows.map((r) => ({ label: r.label, image_url: r.imageUrl })),
      )
      if ("error" in result) toast.error(result.error)
      router.refresh()
    } finally {
      setIsSavingModels(false)
    }
  }

  const handleAssignModelImage = async (key: string, url: string) => {
    const row = modelRows.find((r) => r.key === key)
    setModelRows((prev) => prev.map((r) => (r.key === key ? { ...r, imageUrl: url } : r)))
    if (!row || !row.label.trim()) return
    setIsSavingModels(true)
    try {
      const result = await setProductAxisValueImage(p.id, "model", row.label, url)
      if ("error" in result) toast.error(result.error)
      router.refresh()
    } finally {
      setIsSavingModels(false)
    }
  }

  const handleClearModelImage = async (key: string) => {
    const row = modelRows.find((r) => r.key === key)
    setModelRows((prev) => prev.map((r) => (r.key === key ? { ...r, imageUrl: null } : r)))
    if (!row || !row.label.trim()) return
    setIsSavingModels(true)
    try {
      const result = await setProductAxisValueImage(p.id, "model", row.label, null)
      if ("error" in result) toast.error(result.error)
      router.refresh()
    } finally {
      setIsSavingModels(false)
    }
  }

  // ── Combinations (model × color matrix) ──────────────────────────────
  // Build an attribute key → combination row lookup. Uses both `model` and
  // `size` as synonyms since some sniffers stamp one and some stamp the
  // other. The server matches by deep equality against whatever was in the
  // source row, so we round-trip the original shape.
  const comboKey = (model: string | null, color: string | null): string =>
    `${model ?? ""}||${color ?? ""}`
  const combinationByKey = new Map<string, CombinationRow>()
  for (const row of combinationRows) {
    const key = comboKey(
      row.attributes.model ?? row.attributes.size ?? null,
      row.attributes.color ?? null,
    )
    if (!combinationByKey.has(key)) combinationByKey.set(key, row)
  }

  const findCombination = (modelLabel: string | null, colorLabel: string | null): CombinationRow | null =>
    combinationByKey.get(comboKey(modelLabel, colorLabel)) ?? null

  const handleAssignCombinationImage = async (url: string | null) => {
    if (!selectedModel || !selectedColor) return
    const target = findCombination(selectedModel.label, selectedColor.label)
    // Preserve the source's attribute shape (model vs size) if the combo
    // already exists; otherwise default to {model, color}.
    const attributes = target?.attributes ?? {
      model: selectedModel.label,
      color: selectedColor.label,
    }
    setIsSavingCombinationImage(true)
    try {
      const result = await setCombinationImage(p.id, attributes, url)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        router.refresh()
      }
    } finally {
      setIsSavingCombinationImage(false)
    }
  }

  const makeModelKey = () => `new-size-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const handleAddModel = () => {
    const key = makeModelKey()
    const next: ModelRow[] = [...modelRows, { key, label: "", imageUrl: null }]
    setModelRows(next)
    setSelectedModelKey(key)
    setEditingModelKey(key)
  }

  const handleRemoveModel = async (key: string) => {
    const row = modelRows.find((r) => r.key === key)
    setModelRows((prev) => prev.filter((r) => r.key !== key))
    if (selectedModelKey === key) setSelectedModelKey(null)
    if (!row || !row.label.trim()) { router.refresh(); return }
    setIsSavingModels(true)
    try {
      const result = await removeProductAxisValue(p.id, "model", row.label)
      if ("error" in result) toast.error(result.error)
      router.refresh()
    } finally {
      setIsSavingModels(false)
    }
  }

  const handleModelLabelChange = (key: string, label: string) => {
    setModelRows((prev) => prev.map((r) => (r.key === key ? { ...r, label } : r)))
  }

  const lastSyncedModelLabelsRef = useRef<Map<string, string>>(new Map())
  useEffect(() => {
    const map = new Map<string, string>()
    for (const r of initialModelRows) map.set(r.key, r.label)
    lastSyncedModelLabelsRef.current = map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.variants])
  const modelLabelAtLastSync = (key: string) => lastSyncedModelLabelsRef.current.get(key)

  const handleModelLabelBlur = async (key: string) => {
    const row = modelRows.find((r) => r.key === key)
    if (!row) return
    const trimmed = row.label.trim()
    if (!trimmed) {
      setModelRows((prev) => prev.filter((r) => r.key !== key))
      if (selectedModelKey === key) setSelectedModelKey(null)
      return
    }
    const isNew = key.startsWith("new-size-")
    setIsSavingModels(true)
    try {
      const result = isNew
        ? await addProductAxisValue(p.id, "model", trimmed)
        : await renameProductAxisValue(p.id, "model", modelLabelAtLastSync(key) ?? trimmed, trimmed)
      if ("error" in result) toast.error(result.error)
      router.refresh()
    } finally {
      setIsSavingModels(false)
    }
  }

  // ── Dropdown option sources ────────────────────────────────────────────
  // Show child categories grouped by parent; only leaf categories are
  // selectable (matches how product_categories is structured).
  const categoryOptions = (() => {
    const parents = categories.filter((c) => !c.parent_id)
    const opts: { value: string; label: string; group?: string }[] = []
    for (const parent of parents) {
      const children = categories.filter((c) => c.parent_id === parent.id)
      for (const child of children) {
        opts.push({ value: child.id, label: child.name, group: parent.name })
      }
    }
    // Also include any top-level categories that have no children (they can
    // still be selected as the product's category).
    const parentsWithoutChildren = parents.filter(
      (p) => !categories.some((c) => c.parent_id === p.id),
    )
    for (const parent of parentsWithoutChildren) {
      opts.push({ value: parent.id, label: parent.name })
    }
    return opts
  })()

  const familyOptions = families.map((f) => ({ value: f.id, label: f.name }))

  return (
    <div className="min-h-screen bg-white">
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

        .dd-panel { position: absolute; left: 50%; transform: translateX(-50%); background: #fff; border: 1px solid #e8e8e6; border-radius: 7px; box-shadow: 0 12px 40px rgba(0,0,0,.12); overflow: hidden; overflow-y: auto; min-width: 200px; z-index: 20; top: calc(100% + 4px); }
        .dd-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; cursor: pointer; transition: background .1s; font-size: 13px; font-weight: 300; color: #1c1c1a; }
        .dd-row:hover { background: #f5f5f3; }
        .dd-row.sel { font-weight: 500; }
        .dd-check { color: #016D75; font-size: 11px; }
        .dd-group-label { padding: 8px 14px 4px; font-size: 11px; font-weight: 500; color: #a1a1a0; text-transform: uppercase; letter-spacing: .04em; }
        .spec-inp { width: 100%; text-align: center; font-size: 15px; font-weight: 500; color: #1c1c1a; background: transparent; border: none; border-bottom: 1px solid rgba(1,109,117,.3); outline: none; padding: 0 0 2px; font-family: inherit; }

        .product-status-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,.95); border: 1px solid var(--rule); border-radius: 100px; padding: 5px 10px; font-size: 11px; font-weight: 500; color: var(--arco-black); text-transform: capitalize; }
        .product-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        .admin-readonly-note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #92400e; display: inline-flex; align-items: center; gap: 8px; }

        /* ── Gallery edit grid ── Mirrors the project edit page: 4:3 tiles,
           hover-revealed delete, modal-style confirm. Portrait images keep
           the tile's height and are centered horizontally so they never
           stretch to fit a landscape frame. */
        .photo-edit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        @media (max-width: 768px) { .photo-edit-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; } }
        .photo-edit-thumb { position: relative; aspect-ratio: 4/3; overflow: hidden; background: #f0f0ee; border-radius: 4px; }
        .photo-edit-thumb img { display: block; width: 100%; height: 100%; object-fit: contain; background: #f0f0ee; }
        .photo-del-btn { position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); color: #fff; border: 1px solid rgba(255,255,255,.2); cursor: pointer; opacity: 0; transition: opacity .15s, background .12s; z-index: 2; }
        .photo-edit-thumb:hover .photo-del-btn { opacity: 1; }
        .photo-del-btn:hover { background: rgba(210,40,40,.75) !important; border-color: transparent !important; }
        .photo-del-confirm { position: absolute; inset: 0; background: rgba(0,0,0,.7); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 10; }
        .photo-del-confirm p { color: #fff; font-size: 13px; font-weight: 500; margin: 0; }
        .photo-del-confirm-btns { display: flex; gap: 8px; }
        .photo-del-yes { padding: 6px 18px; background: #d42828; color: #fff; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; border: none; cursor: pointer; transition: background .12s; }
        .photo-del-yes:hover { background: #b91c1c; }
        .photo-del-no { padding: 6px 18px; background: rgba(255,255,255,.15); color: #fff; border-radius: var(--radius-sm); font-size: 12px; border: 1px solid rgba(255,255,255,.3); cursor: pointer; transition: background .12s; }
        .photo-del-no:hover { background: rgba(255,255,255,.25); }
        .photo-add-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; aspect-ratio: 4/3; border: 1px dashed #d4d4d2; border-radius: 4px; cursor: pointer; transition: border-color .15s, background .15s; }
        .photo-add-tile:hover { border-color: #016D75; background: rgba(1,109,117,.03); }

        /* ── Model pills (size axis in admin) ── */
        .model-pills { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .model-pill { font-family: var(--font-sans); display: inline-flex; align-items: center; padding: 8px 16px; font-size: 14px; font-weight: 400; color: var(--text-primary); background: transparent; border: 1px solid var(--arco-rule); border-radius: 20px; cursor: pointer; transition: all .15s; }
        .model-pill:hover { border-color: var(--arco-black); }
        .model-pill.editing { display: inline-grid; padding: 0; outline: 2px solid var(--arco-accent); outline-offset: 2px; cursor: text; background: transparent; color: var(--arco-black); }
        .model-pill.editing::after { content: attr(data-value) " "; visibility: hidden; white-space: pre; padding: 8px 16px; font: inherit; font-size: 14px; font-weight: 400; font-family: var(--font-sans); grid-area: 1 / 1; min-width: 3ch; }
        .model-pill.editing .model-pill-input { grid-area: 1 / 1; width: 100%; min-width: 0; }
        .model-pill.empty { color: var(--text-disabled); }
        .model-pill-input { background: transparent; border: none; outline: none; font: inherit; color: inherit; padding: 8px 16px; font-family: inherit; font-size: 14px; }
        .model-pill-input::placeholder { color: var(--text-disabled); }
        .model-pill-row { display: inline-flex; align-items: center; gap: 4px; }
        .model-pill-add { font-family: var(--font-sans); display: inline-flex; align-items: center; gap: 4px; padding: 8px 14px; font-size: 14px; color: var(--text-secondary); background: transparent; border: 1px dashed #d4d4d2; border-radius: 20px; cursor: pointer; transition: border-color .12s, color .12s, background .12s; }
        .model-pill-add:hover { border-color: #016D75; color: #016D75; background: rgba(1,109,117,.03); }

        /* ── Colors editor (dots under description, mirrors public page) ── */
        .color-dots { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
        .color-dot { position: relative; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; padding: 0; border: 1px solid rgba(0,0,0,.08); box-sizing: border-box; transition: outline-color .12s; overflow: hidden; }
        .color-dot.empty { background: repeating-linear-gradient(45deg, #f5f5f3 0 6px, #ececea 6px 12px); }
        .color-dot.selected { outline: 2px solid var(--arco-accent); outline-offset: 2px; }
        /* Edit pencil overlay — visible on the selected dot to signal that
           clicking changes the color. Auto-contrast on dark vs light hex
           isn't worth the complexity; a translucent white disc behind the
           icon keeps it readable against any swatch. */
        .color-dot-edit-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; background: rgba(0,0,0,.25); pointer-events: none; }

        /* Editable text — consistent inline-edit affordance.
           Default: grey dotted underline signals "this is editable."
           Hover: underline goes black so the user knows they can click.
           Focus/active: accent-colored text + underline, cursor appears. */
        /* The button uses inline-size: fit-content so the dashed underline
           hugs the text rather than stretching across the grid column.
           The input wraps in a span that also uses fit-content. */
        .editable-text { display: inline; background: none; border: none; padding: 0; margin: 0; color: inherit; cursor: text; text-align: left; text-decoration: underline; text-decoration-style: dashed; text-decoration-color: var(--arco-rule); text-underline-offset: 3px; text-decoration-thickness: 1px; transition: text-decoration-color .12s, color .12s; font-family: var(--font-sans); font-size: 14px; font-weight: 400; line-height: 1.5; }
        .editable-text:hover { text-decoration-color: var(--arco-black); }
        .editable-text:focus, .editable-text.editing { text-decoration-color: var(--arco-accent); color: var(--arco-accent); outline: none; }
        .editable-text::placeholder { color: var(--text-disabled); }
        .editable-text-input { background: none; border: none; padding: 0; margin: 0; color: var(--arco-accent); outline: none; width: 100%; text-decoration: underline; text-decoration-style: dashed; text-decoration-color: var(--arco-accent); text-underline-offset: 3px; text-decoration-thickness: 1px; font-family: var(--font-sans); font-size: 14px; font-weight: 400; line-height: 1.5; }
        /* Edit icon sits centered over the dot when selected. Auto color
           flips to white on dark swatches (we pass it via inline style). */
        .color-dot-edit { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; background: rgba(0,0,0,.25); transition: background .12s; }
        .color-dot-edit:hover { background: rgba(0,0,0,.4); }
        .color-dot-edit input[type="color"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; border: none; padding: 0; width: 100%; height: 100%; }
        .color-dot-add { width: 40px; height: 40px; border-radius: 50%; border: 1px dashed #d4d4d2; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #b8b8b6; padding: 0; transition: border-color .12s, color .12s, background .12s; }
        .color-dot-add:hover { border-color: #016D75; color: #016D75; background: rgba(1,109,117,.03); }
        .color-selected-row { display: flex; align-items: center; gap: 8px; }
        .color-name-input { background: transparent; border: none; border-bottom: 1px dashed transparent; outline: none; padding: 2px 0; font-size: 14px; font-weight: 400; color: #1c1c1a; font-family: inherit; transition: border-color .15s; min-width: 160px; }
        .color-name-input::placeholder { color: #b8b8b6; }
        .color-name-input:hover { border-bottom-color: #d4d4d2; }
        .color-name-input:focus { border-bottom-color: #016D75; }
        .color-name-delete { width: 28px; height: 28px; border-radius: 4px; background: transparent; border: none; color: #b8b8b6; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; transition: color .12s, background .12s; }
        .color-name-delete:hover { color: #d42828; background: rgba(210,40,40,.06); }

        /* Hero image upload overlay — appears when a color is selected */
        .hero-image-wrap { position: relative; width: 100%; aspect-ratio: 4/3; border-radius: 4px; overflow: hidden; background: #fff; }
        .hero-image-wrap.empty { background: var(--arco-surface); border: 1px dashed #d4d4d2; }
        .hero-image-wrap img { display: block; width: 100%; height: 100%; object-fit: contain; }
        .hero-image-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: transparent; transition: background .2s; pointer-events: none; }
        .hero-image-wrap.editable:hover .hero-image-overlay { background: rgba(0,0,0,.35); pointer-events: auto; }
        .hero-image-overlay.always-visible { background: rgba(0,0,0,.25); pointer-events: auto; }
        .hero-image-upload-pill { position: relative; display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-sans); font-size: 13px; font-weight: 400; color: #fff; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.25); border-radius: 100px; padding: 8px 18px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); cursor: pointer; opacity: 0; transition: opacity .2s; }
        .hero-image-wrap.editable:hover .hero-image-upload-pill,
        .hero-image-overlay.always-visible .hero-image-upload-pill { opacity: 1; }
        .hero-image-upload-pill input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
        .hero-image-clear-btn { position: absolute; top: 12px; right: 12px; width: 30px; height: 30px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.55); color: #fff; border: 1px solid rgba(255,255,255,.2); cursor: pointer; transition: background .12s; z-index: 2; }
        .hero-image-clear-btn:hover { background: rgba(210,40,40,.75); border-color: transparent; }
        .photo-cover-badge { position: absolute; top: 8px; left: 8px; z-index: 1; font-size: 10px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; color: #fff; background: rgba(0,0,0,.6); padding: 3px 8px; border-radius: 3px; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }

        /* Variant labels on hero + gallery tiles */
        /* Mirrors the .status-pill design from globals.css: 12px/400,
           4px 12px padding, 24px radius, rule-colored outline, transparent
           background that picks up whatever surface it sits on. A semi-
           translucent white fill keeps labels legible against any image.
           Kept here instead of using .status-pill directly because the
           inline-scope style block doesn't see the global variables the
           same way — explicit values are simpler. */
        .hero-variant-labels { position: absolute; top: 12px; left: 12px; z-index: 1; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .hero-variant-label { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-sans); font-size: 12px; font-weight: 400; color: var(--arco-black); background: rgba(255,255,255,.9); border: 1px solid var(--arco-rule); padding: 4px 12px; border-radius: 24px; white-space: nowrap; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
        .hero-variant-color-dot { width: 10px; height: 10px; border-radius: 50%; background: #ccc; border: 1px solid rgba(0,0,0,.08); flex-shrink: 0; }
        .photo-variant-labels { position: absolute; bottom: 8px; left: 8px; z-index: 1; display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
        .photo-variant-label { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-sans); font-size: 12px; font-weight: 400; color: var(--arco-black); background: rgba(255,255,255,.9); border: 1px solid var(--arco-rule); padding: 4px 12px; border-radius: 24px; white-space: nowrap; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
        .photo-variant-color-dot { width: 10px; height: 10px; border-radius: 50%; background: #ccc; border: 1px solid rgba(0,0,0,.08); flex-shrink: 0; }

        /* Floating edit icon — sits at the top-right of a selected pill/dot */
        .pill-edit-icon { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--arco-accent); color: #fff; border: 2px solid #fff; cursor: pointer; padding: 0; z-index: 3; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
        .pill-edit-icon:hover { background: #015962; }
        .pill-edit-icon--danger { background: #1c1c1a; }
        .pill-edit-icon--danger:hover { background: #d42828; }
        .pill-edit-icon input[type="color"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; border: none; padding: 0; width: 100%; height: 100%; }
        .model-pill-wrap { position: relative; display: inline-flex; }
        .model-pill.selected { outline: 2px solid var(--arco-accent); outline-offset: 2px; }
        .color-dot-wrap { position: relative; display: inline-flex; }
      `}</style>

      <AdminProductSubNav
        status={p.status}
        onStatusClick={openStatusModal}
        previewHref={p.brand ? `/products/${p.brand.slug}/${p.slug}` : "/products"}
        hasGallery={galleryItems.length > 0}
        hasSpecs={Object.keys(specs).length > 0}
      />

      <div className="wrap" style={{ marginTop: 40, paddingBottom: 80 }}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="discover-breadcrumb" style={{ marginBottom: 24 }}>
          <Link href="/admin/products" className="discover-breadcrumb-item">Products</Link>
          {p.brand && (
            <>
              <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
              <Link href={`/admin/brands/${p.brand.id}`} className="discover-breadcrumb-item">{p.brand.name}</Link>
            </>
          )}
          {p.family && (
            <>
              <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
              <span className="discover-breadcrumb-item">{p.family.name}</span>
            </>
          )}
          <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
          <span className="discover-breadcrumb-item discover-breadcrumb-current">{p.name}</span>
        </nav>

        {/* Hero */}
        <div id="details" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, marginBottom: 60, scrollMarginTop: 140 }}>
          {/* Primary image — swaps to the selected color's image when a
              color is picked. The hover overlay exposes an upload CTA so
              admins can add or replace the image for that color. */}
          <div>
            {(() => {
              // Priority (combination mode): combo(model+color) > matching
              // standalone axis image > any combo row matching the axis.
              // When no axis is selected, fall back to the cover.
              // When an axis IS selected but has no image, show nothing
              // so the user sees an explicit empty state with the picker.
              let displayUrl: string | null = null
              let activeCombo: CombinationRow | null = null
              if (isCombinationMode) {
                if (selectedColor && selectedModel) {
                  activeCombo = findCombination(selectedModel.label, selectedColor.label)
                  // When both axes are selected, show the combo image only.
                  // Don't fall back to axis-level images — if the combo has
                  // no image yet, show empty so the user sees the picker.
                  displayUrl = activeCombo?.imageUrl ?? null
                } else if (selectedColor) {
                  const partial = combinationRows.find((r) => r.attributes.color === selectedColor.label && r.imageUrl)
                  displayUrl = selectedColor.imageUrl ?? partial?.imageUrl ?? null
                } else if (selectedModel) {
                  const partial = combinationRows.find(
                    (r) => (r.attributes.model === selectedModel.label || r.attributes.size === selectedModel.label) && r.imageUrl,
                  )
                  displayUrl = selectedModel.imageUrl ?? partial?.imageUrl ?? null
                } else {
                  displayUrl = heroPhoto?.url ?? null
                }
              } else {
                if (selectedColor && selectedModel) {
                  // Both axes on an independent product — look up combo row
                  activeCombo = findCombination(selectedModel.label, selectedColor.label)
                  displayUrl = activeCombo?.imageUrl ?? null
                } else if (selectedColor) {
                  displayUrl = selectedColor.imageUrl ?? null
                } else if (selectedModel) {
                  displayUrl = selectedModel.imageUrl ?? null
                } else {
                  displayUrl = heroPhoto?.url ?? null
                }
              }

              // Both axes selected → edit the combination image (works in
              // both independent and combination mode — the server action
              // inserts an {attributes: {model, color}, image_url} row).
              const canEditCombinationImage = !!selectedColor && !!selectedModel
              // Single axis selected → edit the axis-level image.
              const canEditColorImage = !!selectedColor && !selectedModel
              const canEditModelImage = !selectedColor && !!selectedModel
              // Cover can be any product photo — including ones already
              // linked to a color, model, or combination. Exposed whenever
              // no axis is selected so it's reachable in combination mode
              // too (before any pill/dot is picked).
              const canPickCover = !selectedColor && !selectedModel && photos.length > 0

              const editable = canEditColorImage || canEditModelImage || canEditCombinationImage || canPickCover
              // Overlay + pill only appear on hover — avoids the feeling
              // that something auto-opens the moment a color/model pill
              // is clicked. User must actively hover the image to reveal
              // the picker button.
              const alwaysVisible = false
              return (
                <div
                  data-variant-keep-selection
                  className={`hero-image-wrap${editable ? " editable" : ""}${!displayUrl ? " empty" : ""}`}
                >
                  {displayUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayUrl} alt={p.name} key={displayUrl} />
                  ) : null}

                  {/* Variant labels — show which axis value this image
                      represents. Dot for color, pill for model. */}
                  {(selectedColor || selectedModel) && (
                    <div className="hero-variant-labels">
                      {selectedModel && (
                        <span className="hero-variant-label">
                          {selectedModel.label || "Unnamed"}
                        </span>
                      )}
                      {selectedColor && (
                        <span className="hero-variant-label">
                          <span
                            className="hero-variant-color-dot"
                            style={selectedColor.hex ? { background: selectedColor.hex } : undefined}
                          />
                          {selectedColor.label || "Unnamed"}
                        </span>
                      )}
                    </div>
                  )}

                  {(canEditColorImage || canEditModelImage || canEditCombinationImage) && (
                    <div className={`hero-image-overlay${alwaysVisible ? " always-visible" : ""}`}>
                      <button
                        type="button"
                        className="hero-image-upload-pill"
                        onClick={() =>
                          setVariantPickerKind(
                            canEditCombinationImage ? "combo" : (canEditColorImage ? "color" : "model"),
                          )
                        }
                      >
                        <ImageIcon size={14} />
                        {canEditCombinationImage
                          ? (activeCombo?.imageUrl ? "Change image" : "Select image")
                          : canEditColorImage
                            ? (selectedColor!.imageUrl ? "Change color image" : "Select color image")
                            : (selectedModel!.imageUrl ? "Change model image" : "Select model image")}
                      </button>
                      {((canEditColorImage && selectedColor?.imageUrl) ||
                        (canEditModelImage && selectedModel?.imageUrl) ||
                        (canEditCombinationImage && activeCombo?.imageUrl)) && (
                        <button
                          type="button"
                          className="hero-image-clear-btn"
                          onClick={() => setHeroUnlinkConfirmOpen(true)}
                          title="Remove from variant"
                          aria-label="Remove from variant"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  {heroUnlinkConfirmOpen && (canEditColorImage || canEditModelImage || canEditCombinationImage) && (
                    <div className="photo-del-confirm">
                      <p>Remove from variant?</p>
                      <div className="photo-del-confirm-btns">
                        <button
                          type="button"
                          className="photo-del-yes"
                          onClick={async () => {
                            if (canEditCombinationImage) await handleAssignCombinationImage(null)
                            else if (canEditColorImage) await handleClearColorImage(selectedColor!.key)
                            else await handleClearModelImage(selectedModel!.key)
                            setHeroUnlinkConfirmOpen(false)
                          }}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          className="photo-del-no"
                          onClick={() => setHeroUnlinkConfirmOpen(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {canPickCover && (
                    <div className="hero-image-overlay">
                      <button
                        type="button"
                        className="hero-image-upload-pill"
                        onClick={() => setCoverPickerOpen(true)}
                      >
                        <ImageIcon size={14} />
                        Select cover
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {p.brand && (
              <Link href={`/admin/brands/${p.brand.id}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <div className="company-icon" style={{ justifyContent: "flex-start" }}>
                  {p.brand.logo_url ? (
                    <Image src={p.brand.logo_url} alt={p.brand.name} width={100} height={100} className="company-icon-image" />
                  ) : (
                    <div className="company-icon-initials">{p.brand.name.charAt(0).toUpperCase()}</div>
                  )}
                </div>
              </Link>
            )}

            <EditableText
              as="h1"
              initialValue={p.name}
              className="arco-page-title"
              placeholder="Product name"
              badgeLabel="Name"
              onSave={(v) => {
                if (!v) { toast.error("Name can't be empty"); router.refresh(); return }
                void saveField({ name: v })
              }}
              style={{ margin: 0 }}
            />

            <EditableText
              as="p"
              initialValue={p.description ?? ""}
              className="arco-body-text"
              placeholder="Add a product description."
              badgeLabel="Description"
              multiline
              onSave={(v) => void saveField({ description: v || null })}
              style={{ margin: 0 }}
            />

            {/* Model + Color axes — same controls in both modes. Combination
                products route add/rename/delete/hex through the granular
                axis-value actions so the matrix stays consistent. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Model axis */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span className="arco-eyebrow">Model</span>
                  <div className="model-pills" data-variant-keep-selection>
                    {modelRows.map((row) => {
                      const isSelected = row.key === selectedModelKey
                      const isEditing = row.key === editingModelKey
                      if (isEditing) {
                        return (
                          <div key={row.key} className="model-pill-wrap">
                            <div
                              className="model-pill selected editing"
                              data-value={row.label || "Model name"}
                            >
                              <input
                                autoFocus
                                type="text"
                                className="model-pill-input"
                                placeholder="Model name"
                                value={row.label}
                                onChange={(e) => handleModelLabelChange(row.key, e.target.value)}
                                onBlur={() => {
                                  handleModelLabelBlur(row.key)
                                  setEditingModelKey(null)
                                }}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur() }}
                              />
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div key={row.key} className="model-pill-wrap">
                          <button
                            type="button"
                            className={`model-pill${isSelected ? " selected" : ""}${row.label.trim() ? "" : " empty"}`}
                            onClick={() => {
                              if (isSelected) {
                                // Second click on the active pill → rename.
                                setEditingModelKey(row.key)
                              } else {
                                setSelectedModelKey(row.key)
                              }
                            }}
                            title={isSelected ? "Click to rename" : "Click to select"}
                          >
                            {row.label.trim() || "Unnamed"}
                          </button>
                          {isSelected && (
                            <button
                              type="button"
                              className="pill-edit-icon pill-edit-icon--danger"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!row.label.trim()) {
                                  // Empty (just-added) rows skip the confirm.
                                  void handleRemoveModel(row.key)
                                } else {
                                  setDeleteAxisConfirm({ axis: "model", key: row.key, label: row.label.trim() })
                                }
                              }}
                              aria-label="Delete model"
                              title="Delete"
                            >
                              <X size={11} strokeWidth={2.4} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      className="model-pill-add"
                      onClick={handleAddModel}
                      disabled={isSavingModels}
                      title="Add model"
                    >
                      <Plus size={13} />
                      Add model
                    </button>
                  </div>
                </div>

                {/* Color axis */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span className="arco-eyebrow">Color</span>
                <div className="color-dots" data-variant-keep-selection>
                  {colorRows.map((row) => {
                    const isSelected = row.key === selectedColorKey
                    return (
                      <div key={row.key} className="color-dot-wrap">
                        {isSelected ? (
                          <label
                            className="color-dot selected"
                            title="Click to change color"
                            style={row.hex ? { background: row.hex } : undefined}
                          >
                            <span className="color-dot-edit-overlay" aria-hidden="true">
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11.5 1.5l3 3L5 14H2v-3z" />
                              </svg>
                            </span>
                            <input
                              type="color"
                              value={row.hex ?? "#000000"}
                              onChange={(e) => handleHexChange(row.key, e.target.value)}
                              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", border: "none", width: "100%", height: "100%" }}
                            />
                          </label>
                        ) : (
                          <button
                            type="button"
                            className={`color-dot${row.hex ? "" : " empty"}${isSelected ? " selected" : ""}`}
                            title={row.label || "Unnamed color"}
                            style={row.hex ? { background: row.hex } : undefined}
                            onClick={() => setSelectedColorKey(row.key)}
                          />
                        )}
                        {isSelected && (
                          <button
                            type="button"
                            className="pill-edit-icon pill-edit-icon--danger"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!row.label.trim()) {
                                void handleRemoveColor(row.key)
                              } else {
                                setDeleteAxisConfirm({ axis: "color", key: row.key, label: row.label.trim() })
                              }
                            }}
                            aria-label="Delete color"
                            title="Delete"
                          >
                            <X size={11} strokeWidth={2.4} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    className="color-dot-add"
                    title="Add color"
                    onClick={handleAddColor}
                    disabled={isSavingColors}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                  {selectedColor && (
                    <div className="color-selected-row" data-variant-keep-selection>
                      <input
                        key={selectedColor.key}
                        autoFocus={!selectedColor.label}
                        type="text"
                        className="color-name-input"
                        placeholder="Color name"
                        value={selectedColor.label}
                        onChange={(e) => handleLabelChange(selectedColor.key, e.target.value)}
                        onBlur={() => handleLabelBlur(selectedColor.key)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                      />
                    </div>
                  )}
                </div>
              </div>
          </div>
        </div>

        {/* Details bar — editable */}
        <section className="specifications-bar">
          <EditableSpec
            label="Category"
            value={p.category?.id ?? null}
            placeholder="Select category"
            options={categoryOptions}
            onSave={(v) => void saveField({ category_id: v })}
          />
          <EditableSpec
            label="Collection"
            value={p.family?.id ?? null}
            placeholder="Select collection"
            options={familyOptions}
            onSave={(v) => void saveField({ family_id: v })}
            onAddOption={async (name) => {
              if (!p.brand) return { error: "Missing brand" }
              const result = await upsertProductFamily(p.brand.id, name)
              if ("error" in result) return result
              return { value: result.id }
            }}
          />
          <EditableSpec
            label="Designer"
            value={(specs.designer ?? null) as string | null}
            placeholder="Add designer"
            onSave={(v) => void saveField({ specs: { designer: v } })}
          />
          <EditableSpec
            label="Year"
            value={(specs.year ?? null) as string | null}
            placeholder="Add year"
            onSave={(v) => void saveField({ specs: { year: v } })}
          />
          <EditableSpec
            label="Source"
            value={p.source_url ?? null}
            displayValue={(() => {
              if (!p.source_url) return null
              try {
                const u = new URL(p.source_url)
                const path = u.pathname.replace(/\/+$/, "")
                const last = path.split("/").filter(Boolean).pop()
                return last ? `/${last} →` : `${u.hostname.replace(/^www\./, "")} →`
              } catch {
                return p.source_url
              }
            })()}
            placeholder="Product page URL"
            onSave={(v) => void saveField({ source_url: v })}
          />
        </section>

        {/* Photos */}
        <div id="gallery" style={{ marginTop: 32, marginBottom: 60, scrollMarginTop: 140 }}>
          <h2 className="arco-section-title" style={{ margin: "0 0 16px" }}>Photos</h2>

          {galleryItems.length > 0 && (() => {
            // Counts let users see what each tag would filter to without
            // clicking. "Gallery" = unattached photos, "Variants" = photos
            // stamped on a color/model/combination row.
            const variantCount = galleryItems.filter((i) => !!i.meta).length
            const galleryCount = galleryItems.length - variantCount
            const tags: Array<{ key: typeof photoFilter; label: string; count: number }> = [
              { key: "all", label: "All", count: galleryItems.length },
              { key: "gallery", label: "Gallery", count: galleryCount },
              { key: "variants", label: "Variants", count: variantCount },
            ]
            return (
              <div className="category-tags" style={{ marginBottom: 20 }}>
                {tags.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`category-tag${photoFilter === t.key ? " active" : ""}`}
                    onClick={() => setPhotoFilter(t.key)}
                    disabled={t.count === 0 && t.key !== "all"}
                  >
                    {t.label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{t.count}</span>
                  </button>
                ))}
              </div>
            )
          })()}

          <input
            ref={photoInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => void handleUploadPhotos(e.target.files)}
          />

          <div className="photo-edit-grid">
            {/* Add photo tile — first position, like the project edit page */}
            <button
              type="button"
              className="photo-add-tile"
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploading}
            >
              <Plus size={18} style={{ color: "#c0c0be", marginBottom: 4 }} />
              <span style={{ fontSize: 12, color: "#b8b8b6", letterSpacing: ".03em" }}>
                {isUploading ? "Uploading…" : "Add photos"}
              </span>
            </button>

            {galleryItems
              .filter((item) => {
                if (photoFilter === "all") return true
                if (photoFilter === "variants") return !!item.meta
                return !item.meta
              })
              .map((item) => {
              const confirmKey = item.photoId ?? item.key
              const isConfirming = photoDeleteConfirmId === confirmKey
              const confirmTitle = item.photoId ? "Delete this photo?" : "Remove from variant?"
              const confirmCta = item.photoId ? "Delete" : "Unlink"
              return (
                <div key={item.key} className="photo-edit-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.altText ?? ""} />

                  {item.isPrimary && (
                    <span className="photo-cover-badge">Cover</span>
                  )}

                  {item.meta && (
                    <div className="photo-variant-labels">
                      {item.meta.colorLabel && (
                        <span className="photo-variant-label">
                          <span
                            className="photo-variant-color-dot"
                            style={item.meta.colorHex ? { background: item.meta.colorHex } : undefined}
                          />
                          {item.meta.colorLabel}
                        </span>
                      )}
                      {item.meta.modelLabel && (
                        <span className="photo-variant-label">{item.meta.modelLabel}</span>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className="photo-del-btn"
                    onClick={() => setPhotoDeleteConfirmId(confirmKey)}
                    title={item.photoId ? "Delete photo" : "Unlink from variant"}
                  >
                    <Trash2 size={13} />
                  </button>

                  {isConfirming && (
                    <div className="photo-del-confirm">
                      <p>{confirmTitle}</p>
                      <div className="photo-del-confirm-btns">
                        <button
                          type="button"
                          className="photo-del-yes"
                          onClick={() =>
                            item.photoId
                              ? void handleDeletePhoto(item.photoId)
                              : void handleUnlinkVariantByUrl(item.url)
                          }
                        >
                          {confirmCta}
                        </button>
                        <button
                          type="button"
                          className="photo-del-no"
                          onClick={() => setPhotoDeleteConfirmId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Specifications */}
        <SpecsSection
          scoped={specsScoped}
          specOrder={(p.spec_order as string[] | null) ?? null}
          specGroupOverrides={(p.spec_groups as Record<string, string> | null) ?? null}
          modelLabels={modelRows.map((r) => r.label).filter((l) => l.trim().length > 0)}
          activeModel={specsModelScope}
          onSelectModel={setSpecsModelScope}
          addScope={addSpecScope}
          addKey={addSpecKey}
          addValue={addSpecValue}
          onAddStart={(scope) => { setAddSpecScope(scope); setAddSpecKey(""); setAddSpecValue("") }}
          onAddKeyChange={setAddSpecKey}
          onAddValueChange={setAddSpecValue}
          onAddCancel={() => { setAddSpecScope(null); setAddSpecKey(""); setAddSpecValue("") }}
          onAddCommit={async () => {
            if (!addSpecScope || !addSpecKey.trim() || !addSpecValue.trim()) return
            await saveSpec(addSpecScope, addSpecKey.trim(), addSpecValue.trim())
            setAddSpecScope(null); setAddSpecKey(""); setAddSpecValue("")
          }}
          onSaveValue={saveSpec}
          onRenameKey={renameSpecKey}
          onRemove={(scope, key) => void saveSpec(scope, key, null)}
          onReorder={async (order, groups) => {
            const result = await updateSpecLayout(p.id, order, groups)
            if ("error" in result) toast.error(result.error)
            router.refresh()
          }}
          onToggleScope={async (key, direction, model) => {
            const result = await toggleSpecScope(p.id, key, direction, model)
            if ("error" in result) toast.error(result.error)
            router.refresh()
          }}
        />

        {/* Family siblings */}
        {familySiblings.length > 0 && (
          <div style={{ marginBottom: 60 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>
              {p.family ? `More from ${p.family.name}` : "Related products"}
            </h2>
            <div className="discover-grid">
              {familySiblings.map((sibling) => (
                <Link key={sibling.id} href={`/admin/products/${sibling.id}`} className="discover-card">
                  <div className="discover-card-image-wrap">
                    {sibling.imageUrl ? (
                      <div className="discover-card-image-layer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sibling.imageUrl} alt={sibling.name} />
                      </div>
                    ) : (
                      <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                    )}
                  </div>
                  <h3 className="discover-card-title">{sibling.name}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Brand siblings */}
        {brandSiblings.length > 0 && (
          <div style={{ marginBottom: 60 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
              <h2 className="arco-section-title">More by {p.brand?.name}</h2>
              {p.brand && (
                <Link href={`/admin/brands/${p.brand.id}`} className="view-all-link">View all →</Link>
              )}
            </div>
            <div className="discover-grid">
              {brandSiblings.map((sibling) => (
                <Link key={sibling.id} href={`/admin/products/${sibling.id}`} className="discover-card">
                  <div className="discover-card-image-wrap">
                    {sibling.imageUrl ? (
                      <div className="discover-card-image-layer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sibling.imageUrl} alt={sibling.name} />
                      </div>
                    ) : (
                      <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                    )}
                  </div>
                  <h3 className="discover-card-title">{sibling.name}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Variant image picker — writes the chosen URL into the color or
          model variant row (or a specific combination) instead of flipping
          is_primary. */}
      {variantPickerKind && (selectedColor || selectedModel) && (() => {
        const kind = variantPickerKind
        let currentUrl: string | null = null
        let headingSuffix = ""
        if (kind === "combo") {
          if (!selectedColor || !selectedModel) return null
          const combo = findCombination(selectedModel.label, selectedColor.label)
          currentUrl = combo?.imageUrl ?? null
          headingSuffix = `${selectedModel.label} · ${selectedColor.label}`
        } else {
          const target = kind === "color" ? selectedColor : selectedModel
          if (!target) return null
          currentUrl = target.imageUrl
          headingSuffix = kind === "color" ? "color" : "model"
        }
        const norm = (u: string) => u.toLowerCase().replace(/\/+$/, "")
        return (
          <div className="popup-overlay" data-variant-keep-selection onClick={() => setVariantPickerKind(null)}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, padding: 0, display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px", background: "var(--arco-off-white)", borderRadius: "12px 12px 0 0", flexShrink: 0 }}>
                <h3 className="arco-section-title" style={{ margin: 0 }}>
                  {kind === "combo" ? `Image for ${headingSuffix}` : `Select ${headingSuffix} image`}
                </h3>
                <button type="button" className="popup-close" onClick={() => setVariantPickerKind(null)} aria-label="Close">✕</button>
              </div>
              <div style={{ padding: "16px 28px 28px", overflowY: "auto", flex: 1 }}>
                {photos.length === 0 ? (
                  <p className="arco-body-text" style={{ color: "var(--text-secondary)" }}>No photos yet. Upload images in the gallery first.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                    {photos.map((ph) => {
                      const isCurrent = currentUrl && norm(currentUrl) === norm(ph.url)
                      return (
                        <button
                          key={ph.id}
                          type="button"
                          disabled={isSavingCombinationImage}
                          onClick={async () => {
                            if (kind === "combo") {
                              await handleAssignCombinationImage(ph.url)
                            } else if (kind === "color") {
                              await handleAssignColorImage(selectedColor!.key, ph.url)
                            } else {
                              await handleAssignModelImage(selectedModel!.key, ph.url)
                            }
                            setVariantPickerKind(null)
                          }}
                          style={{ position: "relative", border: `2px solid ${isCurrent ? "#016D75" : "transparent"}`, borderRadius: 6, overflow: "hidden", cursor: "pointer", padding: 0, background: "none", transition: "border-color 0.15s" }}
                          onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.borderColor = "#016D75" }}
                          onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.borderColor = "transparent" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ph.url} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                          {isCurrent && (
                            <span style={{ position: "absolute", top: 4, left: 4, fontSize: 9, fontWeight: 600, color: "white", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              Current
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Cover picker — choose which product photo is the main image. */}
      {/* Delete axis-value confirmation — colors/models carry images and
          combination images in combo mode, so the copy calls that out. */}
      {deleteAxisConfirm && (
        <div className="popup-overlay" onClick={() => setDeleteAxisConfirm(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">
                Delete {deleteAxisConfirm.axis}?
              </h3>
              <button type="button" className="popup-close" onClick={() => setDeleteAxisConfirm(null)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 8 }}>
              Remove <strong style={{ color: "var(--text-primary)" }}>{deleteAxisConfirm.label}</strong> from this product?
            </p>
            <p className="arco-small-text" style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Images stay in the gallery — they’ll just be unlinked from this {deleteAxisConfirm.axis}{isCombinationMode ? " and any combinations using it" : ""}.
            </p>
            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => setDeleteAxisConfirm(null)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  const { axis, key } = deleteAxisConfirm
                  setDeleteAxisConfirm(null)
                  if (axis === "color") await handleRemoveColor(key)
                  else await handleRemoveModel(key)
                }}
                style={{ flex: 1, background: "#d42828", color: "#fff", borderColor: "#d42828" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {coverPickerOpen && (
        <div className="popup-overlay" onClick={() => !isSettingCover && setCoverPickerOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, padding: 0, display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px", background: "var(--arco-off-white)", borderRadius: "12px 12px 0 0", flexShrink: 0 }}>
              <h3 className="arco-section-title" style={{ margin: 0 }}>Select cover image</h3>
              <button type="button" className="popup-close" onClick={() => setCoverPickerOpen(false)} aria-label="Close" disabled={isSettingCover}>✕</button>
            </div>
            <div style={{ padding: "16px 28px 28px", overflowY: "auto", flex: 1 }}>
              {photos.length === 0 ? (
                <p className="arco-body-text" style={{ color: "var(--text-secondary)" }}>No photos yet.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                  {photos.map((ph) => {
                    const meta = variantByUrl.get(normaliseUrl(ph.url)) ?? null
                    return (
                      <button
                        key={ph.id}
                        type="button"
                        onClick={() => void handleSetCover(ph.id)}
                        disabled={isSettingCover}
                        style={{ position: "relative", border: `2px solid ${ph.is_primary ? "#016D75" : "transparent"}`, borderRadius: 6, overflow: "hidden", cursor: "pointer", padding: 0, background: "none", transition: "border-color 0.15s" }}
                        onMouseEnter={(e) => { if (!ph.is_primary) e.currentTarget.style.borderColor = "#016D75" }}
                        onMouseLeave={(e) => { if (!ph.is_primary) e.currentTarget.style.borderColor = "transparent" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ph.url} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                        {ph.is_primary && (
                          <span style={{ position: "absolute", top: 4, left: 4, fontSize: 9, fontWeight: 600, color: "white", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            Cover
                          </span>
                        )}
                        {meta && (
                          <div className="photo-variant-labels">
                            {meta.colorLabel && (
                              <span className="photo-variant-label">
                                <span
                                  className="photo-variant-color-dot"
                                  style={meta.colorHex ? { background: meta.colorHex } : undefined}
                                />
                                {meta.colorLabel}
                              </span>
                            )}
                            {meta.modelLabel && (
                              <span className="photo-variant-label">{meta.modelLabel}</span>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status modal — triggered by the sub-nav status pill. */}
      {statusModalOpen && (
        <div className="popup-overlay" onClick={closeStatusModal}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Update status</h3>
              <button type="button" className="popup-close" onClick={closeStatusModal} aria-label="Close">✕</button>
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
                disabled={isSavingStatus}
                style={{ flex: 1 }}
              >
                {isSavingStatus ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Specifications section ──────────────────────────────────────────────
// Scoped specs: `_shared` applies to all models; each model key holds
// specs specific to that model. The UI shows model pills at the top; the
// body merges `_shared` with the selected model so users see the full
// resolved set. Rows from the model override shared when keys collide.

function SpecsSection({
  scoped,
  specOrder: savedOrder,
  specGroupOverrides: savedGroups,
  modelLabels,
  activeModel,
  onSelectModel,
  addScope,
  addKey,
  addValue,
  onAddStart,
  onAddKeyChange,
  onAddValueChange,
  onAddCancel,
  onAddCommit,
  onSaveValue,
  onRenameKey,
  onRemove,
  onReorder,
  onToggleScope,
}: {
  scoped: Record<string, Record<string, any>>
  specOrder: string[] | null
  specGroupOverrides: Record<string, string> | null
  modelLabels: string[]
  activeModel: string | null
  onSelectModel: (label: string | null) => void
  addScope: string | null
  addKey: string
  addValue: string
  onAddStart: (scope: string) => void
  onAddKeyChange: (v: string) => void
  onAddValueChange: (v: string) => void
  onAddCancel: () => void
  onAddCommit: () => void | Promise<void>
  onSaveValue: (scope: string, key: string, value: unknown) => void | Promise<void>
  onRenameKey: (scope: string, oldKey: string, newKey: string) => void | Promise<void>
  onRemove: (scope: string, key: string) => void
  onReorder: (order: string[], groups: Record<string, string>) => void | Promise<void>
  onToggleScope: (key: string, direction: "toPerModel" | "toAllModels", model: string) => void | Promise<void>
}) {
  const shared = scoped._shared ?? {}
  const omitKeys = new Set(["designer", "year"])

  // Collect ALL specs across shared + every model scope. For each key,
  // track the shared value and per-model values so SpecRow can render
  // either a single input or an expanded per-model view.
  const allKeys = new Set<string>()
  const sharedValues: Record<string, any> = {}
  const perModelValues: Record<string, Record<string, any>> = {}
  for (const [k, v] of Object.entries(shared)) {
    if (omitKeys.has(k.toLowerCase())) continue
    allKeys.add(k)
    sharedValues[k] = v
  }
  for (const model of modelLabels) {
    const mSpecs = scoped[model] ?? {}
    for (const [k, v] of Object.entries(mSpecs)) {
      if (omitKeys.has(k.toLowerCase())) continue
      allKeys.add(k)
      if (!perModelValues[k]) perModelValues[k] = {}
      perModelValues[k][model] = v
    }
  }

  // Build the flat merged view for grouping. Use shared value unless
  // the key only exists in model scopes.
  const merged: Record<string, any> = {}
  const scopeFor: Record<string, string> = {}
  for (const k of allKeys) {
    if (k in sharedValues) {
      merged[k] = sharedValues[k]
      scopeFor[k] = "_shared"
    } else {
      // Key only lives in model scopes — show first model's value.
      const firstModel = Object.keys(perModelValues[k] ?? {})[0]
      merged[k] = firstModel ? perModelValues[k][firstModel] : ""
      scopeFor[k] = firstModel ?? "_shared"
    }
  }

  // Optimistic local state — updated instantly on drag, then persisted
  // in the background so the UI never snaps back.
  const [localOrder, setLocalOrder] = useState<string[] | null>(savedOrder)
  const [localGroups, setLocalGroups] = useState<Record<string, string> | null>(savedGroups)

  // Sync from server when savedOrder/savedGroups change (after a refresh
  // triggered by a non-drag edit like rename or add).
  useEffect(() => { setLocalOrder(savedOrder) }, [savedOrder])
  useEffect(() => { setLocalGroups(savedGroups) }, [savedGroups])

  const groups = groupSpecs(merged, { specOrder: localOrder, specGroupOverrides: localGroups })
  const hasAnySpecs = Object.keys(merged).length > 0 || modelLabels.length > 0

  // All 4 canonical groups always render (even empty) so specs can be
  // dragged to any category. We use group-header sentinel IDs as
  // droppable targets for empty groups.
  const ALL_GROUP_LABELS = ["Dimensions", "Materials", "Features", "Other"]
  const groupMap = new Map(groups.map((g) => [g.label, g]))
  const renderedGroups = ALL_GROUP_LABELS.map((label) => ({
    label,
    entries: groupMap.get(label)?.entries ?? [],
  }))

  // Flat item IDs for the SortableContext: spec keys + group sentinel IDs.
  const allItems = renderedGroups.flatMap((g) => {
    const sentinel = `__group__${g.label}`
    return [sentinel, ...g.entries.map(([k]) => k)]
  })

  // Key → group label lookup (including sentinels).
  const keyToGroup = new Map<string, string>()
  for (const g of renderedGroups) {
    keyToGroup.set(`__group__${g.label}`, g.label)
    for (const [k] of g.entries) keyToGroup.set(k, g.label)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeKey = String(active.id)
    if (activeKey.startsWith("__group__")) return

    const overKey = String(over.id)
    const overGroup = keyToGroup.get(overKey) ?? "Other"

    // Build the new flat order from renderedGroups (preserving group
    // boundaries) with the dragged key moved to the drop position.
    const flatKeys = renderedGroups.flatMap((g) => g.entries.map(([k]) => k))
    const newOrder = flatKeys.filter((k) => k !== activeKey)

    if (overKey.startsWith("__group__")) {
      // Dropped on a group header → insert at the start of that group.
      const groupStart = renderedGroups
        .filter((g) => g.label !== overGroup)
        .flatMap((g) => g.entries.map(([k]) => k))
      const beforeGroup = groupStart.length
      // Find first key in the target group in newOrder.
      const targetGroupKeys = renderedGroups.find((g) => g.label === overGroup)?.entries.map(([k]) => k) ?? []
      const firstInGroup = targetGroupKeys.find((k) => k !== activeKey)
      const idx = firstInGroup ? newOrder.indexOf(firstInGroup) : newOrder.length
      newOrder.splice(idx, 0, activeKey)
    } else {
      const insertIdx = newOrder.indexOf(overKey)
      if (insertIdx === -1) {
        newOrder.push(activeKey)
      } else {
        newOrder.splice(insertIdx, 0, activeKey)
      }
    }

    // Group overrides.
    const newGroups = { ...(localGroups ?? {}) }
    const currentGroup = keyToGroup.get(activeKey) ?? "Other"
    if (overGroup !== currentGroup) {
      if (defaultSpecGroup(activeKey) === overGroup) {
        delete newGroups[activeKey]
      } else {
        newGroups[activeKey] = overGroup
      }
    }

    // Optimistic update — instant visual feedback.
    setLocalOrder(newOrder)
    setLocalGroups(newGroups)
    // Persist in the background (no await — fire and forget).
    void onReorder(newOrder, newGroups)
  }

  if (!hasAnySpecs && !addScope) return null

  return (
    <div id="specs" style={{ marginBottom: 60, scrollMarginTop: 140 }}>
      <h2 className="arco-section-title" style={{ margin: "0 0 16px" }}>Specifications</h2>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={allItems} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {renderedGroups.map((group) => (
              <SortableGroupSection key={group.label} id={`__group__${group.label}`} label={group.label}>
                {group.entries.map(([key, value]) => {
                  const isPerModel = !!(perModelValues[key] && Object.keys(perModelValues[key]).length > 0)
                  return (
                    <SortableSpecRow
                      key={key}
                      specKey={key}
                      value={String(value)}
                      scope={scopeFor[key]}
                      isShared={!isPerModel}
                      hasModels={modelLabels.length > 0}
                      modelLabels={modelLabels}
                      modelValues={perModelValues[key] ?? {}}
                      onSaveValue={(scope, v) => void onSaveValue(scope, key, v)}
                      onRenameKey={(newKey) => void onRenameKey(scopeFor[key], key, newKey)}
                      onRemove={() => onRemove(scopeFor[key], key)}
                      onToggleScope={onToggleScope}
                    />
                  )
                })}
                {group.entries.length === 0 && (
                  <p className="arco-xs-text" style={{ color: "var(--text-disabled)", padding: "8px 0" }}>
                    Drop specs here
                  </p>
                )}
              </SortableGroupSection>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add spec — inline row matching the SpecRow layout */}
      <div style={{ marginTop: 16 }}>
        {addScope === null ? (
          <button
            type="button"
            className="btn-tertiary"
            style={{ fontSize: 13, padding: "6px 14px" }}
            onClick={() => onAddStart(activeModel ?? "_shared")}
          >
            + Add spec
          </button>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", gap: "10px 16px" }}>
            <SpecAddInlineRow
              keyInput={addKey}
              valueInput={addValue}
              onKeyChange={onAddKeyChange}
              onValueChange={onAddValueChange}
              onCommit={onAddCommit}
              onCancel={onAddCancel}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── SortableGroupSection — droppable group header ──────────────────────
// Renders as a group eyebrow that also registers as a sortable item so
// specs can be dropped directly onto a group header to move them there.

function SortableGroupSection({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useSortable({ id })
  return (
    <div ref={setNodeRef}>
      <h3
        className="arco-label"
        style={{
          marginBottom: 12,
          padding: "4px 0",
          borderRadius: 4,
          background: isOver ? "rgba(1,109,117,.06)" : "transparent",
          transition: "background .15s",
        }}
      >
        {label}
      </h3>
      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 12 }}>
        {children}
      </div>
    </div>
  )
}

// ── SortableSpecRow — wraps SpecRow with dnd-kit sortable ──────────────

function SortableSpecRow(props: {
  specKey: string
  value: string
  scope: string
  isShared: boolean
  hasModels: boolean
  modelLabels: string[]
  modelValues: Record<string, any>
  onSaveValue: (scope: string, value: string) => void
  onRenameKey: (newKey: string) => void
  onRemove: () => void
  onToggleScope: (key: string, direction: "toPerModel" | "toAllModels", model: string) => void | Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.specKey })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    padding: "6px 0",
  } as const

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", gap: "10px 16px", alignItems: "start" }}>
        <div
          {...attributes}
          {...listeners}
          style={{ cursor: "grab", color: "var(--text-disabled)", display: "flex", alignItems: "center", padding: "4px 2px 0", touchAction: "none" }}
          title="Drag to reorder"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>
        <SpecRow {...props} />
      </div>
    </div>
  )
}

// ── SpecRow — editable key + value with inline per-model expansion ─────

function SpecRow({
  specKey,
  value,
  isShared,
  hasModels,
  modelLabels,
  modelValues,
  onSaveValue,
  onRenameKey,
  onRemove,
  onToggleScope,
}: {
  specKey: string
  value: string
  scope: string
  isShared: boolean
  hasModels: boolean
  modelLabels: string[]
  modelValues: Record<string, any>
  onSaveValue: (scope: string, value: string) => void
  onRenameKey: (newKey: string) => void
  onRemove: () => void
  onToggleScope: (key: string, direction: "toPerModel" | "toAllModels", model: string) => void | Promise<void>
}) {
  const [editingKey, setEditingKey] = useState(false)
  const [editingSharedValue, setEditingSharedValue] = useState(false)
  const [draftKey, setDraftKey] = useState(specLabel(specKey))
  const [draftSharedValue, setDraftSharedValue] = useState(value)
  const [suggestions, setSuggestions] = useState<KnownSpec[]>([])
  const [hovered, setHovered] = useState(false)

  useEffect(() => { setDraftSharedValue(value) }, [value])
  useEffect(() => { setDraftKey(specLabel(specKey)) }, [specKey])

  const commitKey = () => {
    setEditingKey(false)
    setSuggestions([])
    const trimmed = draftKey.trim()
    if (!trimmed) { setDraftKey(specLabel(specKey)); return }
    const match = matchKnownSpecs(trimmed)[0]
    const newKey = match && match.label.toLowerCase() === trimmed.toLowerCase()
      ? match.key
      : trimmed.toLowerCase().replace(/\s+/g, "_")
    if (newKey !== specKey) onRenameKey(newKey)
  }

  const commitSharedValue = () => {
    setEditingSharedValue(false)
    const trimmed = draftSharedValue.trim()
    if (trimmed !== value) onSaveValue("_shared", trimmed)
  }

  const handleKeyInput = (v: string) => {
    setDraftKey(v)
    setSuggestions(v.trim().length > 0 ? matchKnownSpecs(v).slice(0, 6) : [])
  }

  const pickSuggestion = (s: KnownSpec) => {
    setDraftKey(s.label)
    setSuggestions([])
    setEditingKey(false)
    if (s.key !== specKey) onRenameKey(s.key)
  }

  return (
    <>
      {/* Key column */}
      <div style={{ position: "relative" }}>
        {editingKey ? (
          <div style={{ position: "relative" }}>
            <input
              autoFocus
              type="text"
              className="arco-small-text editable-text-input"
              value={draftKey}
              onChange={(e) => handleKeyInput(e.target.value)}
              onBlur={() => setTimeout(commitKey, 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                if (e.key === "Escape") { setDraftKey(specLabel(specKey)); setEditingKey(false); setSuggestions([]) }
              }}
            />
            {suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--arco-rule)", borderRadius: 4, boxShadow: "0 4px 16px rgba(0,0,0,.1)", zIndex: 20, maxHeight: 200, overflowY: "auto" }}>
                {suggestions.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "var(--text-primary)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--arco-surface)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "none" }}
                  >
                    {s.label}
                    <span style={{ fontSize: 11, color: "var(--text-disabled)", marginLeft: 8 }}>{s.group}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingKey(true)}
            title="Click to rename"
            className="arco-small-text editable-text"
            style={{ color: "var(--text-disabled)", textTransform: "capitalize" }}
          >
            {specLabel(specKey)}
          </button>
        )}
      </div>

      {/* Value column */}
      <div
        className="arco-small-text"
        style={{ color: "var(--text-primary)" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {isShared ? (
          /* ── Shared: single value + "Value per model" hover link ── */
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {editingSharedValue ? (
              <input
                autoFocus
                type="text"
                className="arco-small-text editable-text-input"
                value={draftSharedValue}
                onChange={(e) => setDraftSharedValue(e.target.value)}
                onBlur={commitSharedValue}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                  if (e.key === "Escape") { setDraftSharedValue(value); setEditingSharedValue(false) }
                }}
                style={{ flex: 1, minWidth: 60 }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingSharedValue(true)}
                title="Click to edit"
                className="editable-text"
              >
                {value}
              </button>
            )}
            {hasModels && hovered && !editingSharedValue && (
              <button
                type="button"
                onClick={() => void onToggleScope(specKey, "toPerModel", modelLabels[0])}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  fontSize: 11, fontFamily: "var(--font-sans)", whiteSpace: "nowrap",
                  color: "var(--arco-accent)",
                }}
              >
                Value per model
              </button>
            )}
          </div>
        ) : (
          /* ── Per-model: inline comma-separated values with model pills ── */
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {modelLabels.map((model, i) => (
              <span key={model} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <SpecModelValueInline
                  model={model}
                  value={String(modelValues[model] ?? value ?? "")}
                  onSave={(v) => onSaveValue(model, v)}
                />
                {i < modelLabels.length - 1 && (
                  <span style={{ color: "var(--text-disabled)", margin: "0 2px" }}>/</span>
                )}
              </span>
            ))}
            <button
              type="button"
              onClick={() => void onToggleScope(specKey, "toAllModels", modelLabels[0])}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                fontSize: 11, fontFamily: "var(--font-sans)", whiteSpace: "nowrap",
                color: "var(--arco-accent)", marginLeft: 4,
              }}
            >
              One value
            </button>
          </div>
        )}
      </div>

      {/* Remove button */}
      <div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove spec"
          title="Remove"
          style={{ background: "none", border: "none", color: "var(--text-disabled)", cursor: "pointer", padding: 4 }}
        >
          <X size={14} />
        </button>
      </div>
    </>
  )
}

// ── Per-model inline value + model pill ──────────────────────────────────

function SpecModelValueInline({
  model,
  value,
  onSave,
}: {
  model: string
  value: string
  onSave: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => { setDraft(value) }, [value])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== value) onSave(trimmed)
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {editing ? (
        <input
          autoFocus
          type="text"
          className="arco-small-text editable-text-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            if (e.key === "Escape") { setDraft(value); setEditing(false) }
          }}
          style={{ width: `${Math.max(draft.length, 3) + 1}ch` }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Click to edit"
          className="editable-text"
        >
          {value || "—"}
        </button>
      )}
      <span className="status-pill" style={{ fontSize: 10, padding: "1px 6px", flexShrink: 0 }}>
        {model}
      </span>
    </span>
  )
}

// ── SpecAddInlineRow — identical layout to SpecRow. Both fields start
//    in edit mode. Auto-saves when the value blurs with both fields
//    filled. Cancels silently if both are empty on blur.

function SpecAddInlineRow({
  keyInput,
  valueInput,
  onKeyChange,
  onValueChange,
  onCommit,
  onCancel,
}: {
  keyInput: string
  valueInput: string
  onKeyChange: (v: string) => void
  onValueChange: (v: string) => void
  onCommit: () => void | Promise<void>
  onCancel: () => void
}) {
  const [suggestions, setSuggestions] = useState<KnownSpec[]>([])
  const [keyFocused, setKeyFocused] = useState(false)
  const [valueFocused, setValueFocused] = useState(false)
  const valueRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  const handleKeyInput = (v: string) => {
    onKeyChange(v)
    setSuggestions(v.trim().length > 0 ? matchKnownSpecs(v).slice(0, 6) : [])
  }

  const pickSuggestion = (s: KnownSpec) => {
    onKeyChange(s.key)
    setSuggestions([])
    valueRef.current?.focus()
  }

  const resolvedKey = (() => {
    if (!keyInput.trim()) return ""
    const match = matchKnownSpecs(keyInput)[0]
    return match && match.label.toLowerCase() === keyInput.toLowerCase()
      ? match.key
      : keyInput.trim().toLowerCase().replace(/\s+/g, "_")
  })()

  // Auto-save: when focus leaves the row entirely (neither key nor value
  // is focused), commit if both fields are filled; cancel if both empty.
  const tryAutoSave = () => {
    setTimeout(() => {
      if (rowRef.current?.contains(document.activeElement)) return
      if (resolvedKey && valueInput.trim()) {
        void onCommit()
      } else if (!keyInput.trim() && !valueInput.trim()) {
        onCancel()
      }
    }, 100)
  }

  return (
    <div ref={rowRef} style={{ display: "contents" }}>
      <div />
      <div style={{ position: "relative" }}>
        <input
          autoFocus
          type="text"
          className={`arco-small-text ${keyFocused ? "editable-text-input" : "editable-text"}`}
          value={keyFocused ? keyInput : (keyInput ? specLabel(keyInput) : "")}
          onChange={(e) => handleKeyInput(e.target.value)}
          onFocus={() => setKeyFocused(true)}
          onBlur={() => { setKeyFocused(false); setTimeout(() => setSuggestions([]), 150); tryAutoSave() }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); valueRef.current?.focus() }
            if (e.key === "Escape") onCancel()
            if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); valueRef.current?.focus() }
          }}
          placeholder="Spec name"
          style={{ textTransform: "capitalize" }}
        />
        {suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--arco-rule)", borderRadius: 4, boxShadow: "0 4px 16px rgba(0,0,0,.1)", zIndex: 20, maxHeight: 200, overflowY: "auto", marginTop: 4 }}>
            {suggestions.map((s) => (
              <button
                key={s.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(s)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "var(--text-primary)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--arco-surface)" }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none" }}
              >
                {s.label}
                <span style={{ fontSize: 11, color: "var(--text-disabled)", marginLeft: 8 }}>{s.group}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="arco-small-text" style={{ color: "var(--text-primary)" }}>
        <input
          ref={valueRef}
          type="text"
          className={`arco-small-text ${valueFocused ? "editable-text-input" : "editable-text"}`}
          value={valueInput}
          onChange={(e) => onValueChange(e.target.value)}
          onFocus={() => setValueFocused(true)}
          onBlur={() => { setValueFocused(false); tryAutoSave() }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && resolvedKey && valueInput.trim()) { (e.target as HTMLInputElement).blur() }
            if (e.key === "Escape") onCancel()
          }}
          placeholder="Value"
        />
      </div>
      <div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          title="Cancel"
          style={{ background: "none", border: "none", color: "var(--text-disabled)", cursor: "pointer", padding: 4 }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
