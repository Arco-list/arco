"use client"

import { memo, useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react"
import { handlePlainTextPaste, handlePlainTextDrop } from "@/lib/plain-text-paste"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ImageIcon, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  deleteProductFamily,
  updateBrand,
  updateProductFamily,
  uploadBrandLogo,
  uploadProductFamilyImage,
  upsertProductFamily,
} from "../actions"

/**
 * Merkpagina voor admins — merk en series, geen producten.
 *
 * De merkenlaag gaat merk → serie → foto. Een serie (Occhio › Mito, Drop
 * › Spa) is hoe een merk zichzelf verkoopt, hoe een architect specificeert
 * en wat op een foto te herkennen is; een artikelnummer is dat niet. De
 * productcatalogus die hier stond is eruit; `product_families` is de
 * serietabel en draagt sinds 289 designer, jaar en url.
 *
 * Opbouw als de bedrijfspagina: kop, dan de series, dan (server-side,
 * in page.tsx) de projecten waarin het merk is toegepast.
 */

type Brand = {
  id: string
  slug: string
  name: string
  domain: string | null
  website: string | null
  logo_url: string | null
  description: string | null
  country: string | null
  founded_year: number | null
  status: string
}

type Family = {
  id: string
  slug: string
  name: string
  description: string | null
  hero_image_url: string | null
  designer: string | null
  launch_year: number | null
  url: string | null
}

/* ────────────────────────────────────────────────────────────────
   Inline editor — isolated from parent re-renders so contentEditable
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
    onPaste: (e: ClipboardEvent<HTMLElement>) => handlePlainTextPaste(e, { multiline }),
    onDrop: (e: DragEvent<HTMLElement>) => handlePlainTextDrop(e, { multiline }),
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

/** Klein tekstveld dat op blur opslaat — voor website, land, jaar, designer. */
function BlurField({
  label, value, placeholder, type = "text", width, onSave,
}: {
  label: string
  value: string
  placeholder?: string
  type?: "text" | "number" | "url"
  width?: number
  onSave: (value: string) => void
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, width }}>
      <span className="arco-eyebrow" style={{ color: "#a1a1a0" }}>{label}</span>
      <input
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        className="family-field"
        onBlur={(e) => { if (e.currentTarget.value.trim() !== value.trim()) onSave(e.currentTarget.value) }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
      />
    </label>
  )
}

export function BrandDetailClient({ brand, families }: { brand: Brand; families: Family[] }) {
  const router = useRouter()

  // ── Merkkop ────────────────────────────────────────────────────────────
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  const saveBrand = async (patch: Parameters<typeof updateBrand>[1], okMessage = "Saved") => {
    const result = await updateBrand(brand.id, patch)
    if ("error" in result) toast.error(result.error)
    else toast.success(okMessage)
    router.refresh()
  }

  const saveField = (field: "name" | "description", value: string) => {
    const trimmed = value.trim()
    if (field === "name" && !trimmed) {
      toast.error("Name can't be empty")
      router.refresh()
      return
    }
    void saveBrand(field === "name" ? { name: trimmed } : { description: trimmed })
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    const result = await uploadBrandLogo(brand.id, formData)
    if ("error" in result) toast.error(result.error)
    else { toast.success("Logo updated"); router.refresh() }
    if (logoInputRef.current) logoInputRef.current.value = ""
  }

  // ── Series ─────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Family | null>(null)
  const [deleting, setDeleting] = useState(false)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const [coverTarget, setCoverTarget] = useState<Family | null>(null)

  const patchFamily = async (family: Family, fields: Parameters<typeof updateProductFamily>[1]) => {
    const result = await updateProductFamily(family.id, fields)
    if ("error" in result) toast.error(result.error)
    else toast.success("Saved")
    router.refresh()
  }

  const createFamily = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setCreating(true)
    const result = await upsertProductFamily(brand.id, trimmed)
    setCreating(false)
    if ("error" in result) { toast.error(result.error); return }
    toast.success(`Added ${result.name}`)
    setNewName(""); setShowCreate(false)
    router.refresh()
  }

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

  const pickCover = (family: Family) => {
    setCoverTarget(family)
    coverInputRef.current?.click()
  }
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const family = coverTarget
    if (coverInputRef.current) coverInputRef.current.value = ""
    if (!file || !family) return
    const formData = new FormData()
    formData.append("file", file)
    const result = await uploadProductFamilyImage(family.id, formData)
    if ("error" in result) toast.error(result.error)
    else { toast.success("Cover updated"); router.refresh() }
    setCoverTarget(null)
  }

  return (
    <>
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

        /* ── Series card ── */
        .family-card { position: relative; display: flex; flex-direction: column; gap: 8px; }
        .family-cover { position: relative; aspect-ratio: 1; border-radius: 4px; overflow: hidden; background: var(--arco-surface); }
        .family-cover-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0); transition: background .15s; pointer-events: none; }
        .family-card:hover .family-cover-overlay { background: rgba(0,0,0,.35); pointer-events: auto; }
        .family-icon-btn { position: absolute; width: 30px; height: 30px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); color: #fff; border: 1px solid rgba(255,255,255,.2); cursor: pointer; opacity: 0; transition: opacity .15s, background .12s; z-index: 2; padding: 0; }
        .family-card:hover .family-icon-btn { opacity: 1; }
        .family-icon-btn.left { top: 8px; left: 8px; }
        .family-icon-btn.right { top: 8px; right: 8px; }
        .family-icon-btn:hover { background: rgba(0,0,0,.65); }
        .family-icon-btn.danger:hover { background: rgba(210,40,40,.75); border-color: transparent; }
        .family-name-input { width: 100%; background: transparent; border: none; outline: none; padding: 0; font-family: inherit; font-size: 14px; font-weight: 500; color: var(--arco-black); border-bottom: 1px dashed transparent; transition: border-color .12s; }
        .family-name-input:hover { border-bottom-color: var(--rule); }
        .family-name-input:focus { border-bottom-color: var(--arco-accent); }
        .family-field { width: 100%; height: 30px; padding: 0 8px; border: 1px solid #e5e5e4; border-radius: 4px; font-size: 12px; font-family: inherit; color: #1c1c1a; background: #fff; min-width: 0; }
        .family-field:focus { outline: none; border-color: #016D75; }
        .family-desc { width: 100%; min-height: 56px; padding: 6px 8px; border: 1px solid #e5e5e4; border-radius: 4px; font-size: 12px; font-family: inherit; line-height: 1.45; color: #1c1c1a; background: #fff; resize: vertical; }
        .family-desc:focus { outline: none; border-color: #016D75; }
      `}</style>

      <Link href="/admin/brands" className="arco-small-text" style={{ display: "inline-block", marginBottom: 24 }}>
        ← All brands
      </Link>

      {/* ── Merkkop ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 16, marginBottom: 56, textAlign: "center" }}>
        <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: "none" }} onChange={handleLogoChange} />
        <button
          type="button"
          onClick={() => logoInputRef.current?.click()}
          className="logo-edit"
          style={{ width: 96, height: 96, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: brand.logo_url ? "transparent" : "var(--arco-surface)", border: "none", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 36 }}
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
          <EditableText as="h1" initialValue={brand.name} className="arco-page-title" placeholder="Brand name" badgeLabel="Name" onSave={(v) => saveField("name", v)} style={{ margin: 0, textAlign: "center" }} />
          <EditableText as="p" initialValue={brand.description ?? ""} className="arco-body-text" placeholder="Add a short description of this brand." badgeLabel="Description" multiline onSave={(v) => saveField("description", v)} style={{ margin: 0, textAlign: "center" }} />
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 8, textAlign: "left" }}>
          <BlurField label="Website" value={brand.website ?? ""} placeholder="https://…" type="url" width={260} onSave={(v) => void saveBrand({ website: v })} />
          <BlurField label="Country" value={brand.country ?? ""} placeholder="Germany" width={140} onSave={(v) => void saveBrand({ country: v })} />
          <BlurField label="Founded" value={brand.founded_year ? String(brand.founded_year) : ""} placeholder="1999" type="number" width={100} onSave={(v) => void saveBrand({ founded_year: v.trim() ? Number(v) : null })} />
        </div>
        <p className="arco-eyebrow" style={{ color: "#a1a1a0" }}>Status: {brand.status} · admins only until the brand page ships</p>
      </div>

      {/* ── Series ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div className="discover-results-meta" style={{ justifyContent: "space-between" }}>
          <p className="discover-results-count">
            <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{families.length}</strong>
            {" "}series
          </p>
          <button type="button" className="btn-tertiary" style={{ fontSize: 13, padding: "6px 14px" }} onClick={() => setShowCreate(true)}>
            Add series
          </button>
        </div>
        <p className="arco-body-text" style={{ color: "#8c8c8a", marginTop: -8, marginBottom: 20, maxWidth: 640 }}>
          A series is what architects specify and what a photo shows — Mito, Spa, Tobi-Ishi. No individual products.
        </p>

        <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={handleCoverChange} />

        {families.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px 16px" }}>
            <p className="arco-body-text empty-state__description">No series yet. Add the ones this brand is known for.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
            {families.map((family) => (
              <div key={family.id} className="family-card">
                <div className="family-cover">
                  {family.hero_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={family.hero_image_url} alt={family.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--text-secondary)" }}>
                      {family.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="family-cover-overlay">
                    <button type="button" className="family-icon-btn left" onClick={() => pickCover(family)} title="Upload cover image" aria-label="Upload cover image">
                      <ImageIcon style={{ width: 14, height: 14 }} />
                    </button>
                    <button type="button" className="family-icon-btn right danger" onClick={() => setDeleteTarget(family)} title="Delete series" aria-label="Delete series">
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  defaultValue={family.name}
                  className="family-name-input"
                  aria-label="Series name"
                  onBlur={(e) => { const v = e.currentTarget.value.trim(); if (v && v !== family.name) void patchFamily(family, { name: v }); else if (!v) e.currentTarget.value = family.name }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { (e.target as HTMLInputElement).value = family.name; (e.target as HTMLInputElement).blur() } }}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 72px", gap: 6 }}>
                  <BlurField label="Designer" value={family.designer ?? ""} placeholder="Axel Meise" onSave={(v) => void patchFamily(family, { designer: v })} />
                  <BlurField label="Year" value={family.launch_year ? String(family.launch_year) : ""} placeholder="2018" type="number" onSave={(v) => void patchFamily(family, { launch_year: v.trim() ? Number(v) : null })} />
                </div>
                <BlurField label="Series page at the brand" value={family.url ?? ""} placeholder="https://…" type="url" onSave={(v) => void patchFamily(family, { url: v })} />
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="arco-eyebrow" style={{ color: "#a1a1a0" }}>Description</span>
                  <textarea
                    className="family-desc"
                    defaultValue={family.description ?? ""}
                    placeholder="One or two sentences on what defines this series."
                    onBlur={(e) => { if (e.currentTarget.value.trim() !== (family.description ?? "").trim()) void patchFamily(family, { description: e.currentTarget.value }) }}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add series ──────────────────────────────────────────────── */}
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

      {/* ── Delete series ───────────────────────────────────────────── */}
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
              <button type="button" className="btn-secondary" onClick={() => void confirmDelete()} disabled={deleting} style={{ flex: 1 }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
