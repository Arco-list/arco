"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { scrapeBrand, updateBrand, updateBrandStatus, deleteBrand } from "./actions"
import type { AdminBrandRow } from "./page"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const STATUS_DOT: Record<string, string> = {
  unclaimed: "#ea580c",
  prospected: "#f59e0b",
  unlisted: "#a1a1a0",
  listed: "#7c3aed",
  deactivated: "#dc2626",
}

const STATUS_LABEL: Record<string, string> = {
  unclaimed: "Unclaimed",
  prospected: "Prospected",
  unlisted: "Unlisted",
  listed: "Listed",
  deactivated: "Deactivated",
}

export function BrandsClient({ initialBrands }: { initialBrands: AdminBrandRow[] }) {
  const router = useRouter()
  const [brands, setBrands] = useState(initialBrands)
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [isScraping, setIsScraping] = useState(false)
  const [isPending, startTransition] = useTransition()

  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Edit popup state
  const [editBrand, setEditBrand] = useState<AdminBrandRow | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editLogoUrl, setEditLogoUrl] = useState("")
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  // Status popup state
  const [statusBrand, setStatusBrand] = useState<AdminBrandRow | null>(null)
  const [statusValue, setStatusValue] = useState("")

  // Delete popup state
  const [deleteBrandTarget, setDeleteBrandTarget] = useState<AdminBrandRow | null>(null)

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return
    setIsScraping(true)
    try {
      const result = await scrapeBrand(scrapeUrl.trim())
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(result.created ? `Added ${result.name}` : `${result.name} already exists`)
        setScrapeUrl("")
        router.refresh()
      }
    } finally {
      setIsScraping(false)
    }
  }

  const openEdit = (brand: AdminBrandRow) => {
    setEditBrand(brand)
    setEditName(brand.name)
    setEditDescription(brand.description ?? "")
    setEditLogoUrl(brand.logo_url ?? "")
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editBrand) return
    if (file.size > 5 * 1024 * 1024) { toast.error("Logo must be under 5MB"); return }

    setIsUploadingLogo(true)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
      const path = `brands/${editBrand.id}/logo.${ext}`
      const { error: uploadError } = await supabase.storage.from("company-assets").upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type })
      if (uploadError) { toast.error(uploadError.message); return }
      const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path)
      if (urlData?.publicUrl) setEditLogoUrl(urlData.publicUrl)
    } catch { toast.error("Upload failed") } finally { setIsUploadingLogo(false) }
    e.target.value = ""
  }

  const handleSaveEdit = () => {
    if (!editBrand) return
    startTransition(async () => {
      const result = await updateBrand(editBrand.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        logo_url: editLogoUrl.trim() || undefined,
      })
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Brand updated")
        setEditBrand(null)
        router.refresh()
      }
    })
  }

  const openStatus = (brand: AdminBrandRow) => {
    setStatusBrand(brand)
    setStatusValue(brand.status)
  }

  const handleSaveStatus = () => {
    if (!statusBrand) return
    startTransition(async () => {
      const result = await updateBrandStatus(statusBrand.id, statusValue)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Status updated")
        setStatusBrand(null)
        router.refresh()
      }
    })
  }

  const handleConfirmDelete = () => {
    if (!deleteBrandTarget) return
    startTransition(async () => {
      const result = await deleteBrand(deleteBrandTarget.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Brand deleted")
        setDeleteBrandTarget(null)
        router.refresh()
      }
    })
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="flex flex-col gap-1 mb-6">
        <h3 className="arco-section-title">Brands</h3>
        <p className="text-xs text-[#a1a1a0] mt-0.5">
          {brands.length} {brands.length === 1 ? "brand" : "brands"}
        </p>
      </div>

      {/* Scrape input */}
      <div className="flex flex-col gap-2 mb-8 max-w-2xl">
        <label className="arco-eyebrow">Add brand by URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://www.occhio.com"
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleScrape() }}
            className="input-base input-default"
            style={{ flex: 1 }}
            disabled={isScraping}
          />
          <button
            type="button"
            className="btn-primary"
            style={{ fontSize: 14, padding: "10px 20px" }}
            onClick={handleScrape}
            disabled={isScraping || !scrapeUrl.trim()}
          >
            {isScraping ? "Scraping…" : "Scrape brand"}
          </button>
        </div>
        <p className="arco-small-text">Paste a brand homepage URL — Firecrawl + Claude will extract the name, description, and country.</p>
      </div>

      {/* Table */}
      <div className="arco-table-wrap">
        <table className="arco-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Brand</th>
              <th>Domain</th>
              <th>Country</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Products</th>
              <th>Created</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {brands.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  No brands yet. Paste a URL above to scrape your first brand.
                </td>
              </tr>
            ) : (
              brands.map((brand) => (
                <tr key={brand.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {brand.logo_url ? (
                        <div className="arco-table-avatar">
                          <img src={brand.logo_url} alt={brand.name} />
                        </div>
                      ) : (
                        <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>
                          {brand.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <Link href={`/admin/brands/${brand.id}`} className="arco-table-primary arco-table-primary--wrap hover:text-[#016D75] transition-colors">
                          {brand.name}
                        </Link>
                        {brand.country && (
                          <div className="arco-table-secondary">{brand.country}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {brand.website ? (
                      <a href={brand.website} target="_blank" rel="noopener noreferrer" className="arco-table-primary hover:opacity-70 transition-opacity" style={{ fontWeight: 400 }}>
                        {brand.domain ?? "—"}
                      </a>
                    ) : (
                      <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>
                    )}
                  </td>
                  <td>{brand.country ?? <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>}</td>
                  <td>
                    <span className="arco-table-status">
                      <span className="arco-table-status-dot" style={{ background: STATUS_DOT[brand.status] ?? "#a1a1a0" }} />
                      <span style={{ fontWeight: 500 }}>{STATUS_LABEL[brand.status] ?? brand.status}</span>
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>{brand.product_count}</td>
                  <td className="arco-table-nowrap">{format(new Date(brand.created_at), "dd MMM yyyy")}</td>
                  <td style={{ textAlign: "center" }}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="arco-table-action" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem asChild>
                          <Link href={`/products/${brand.slug}`} target="_blank">View brand</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(brand)}>
                          Edit brand
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openStatus(brand)}>
                          Update status
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteBrandTarget(brand)} className="text-red-600">
                          Delete brand
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit brand popup */}
      {editBrand && (
        <div className="popup-overlay" onClick={() => setEditBrand(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Edit brand</h3>
              <button type="button" className="popup-close" onClick={() => setEditBrand(null)} aria-label="Close">✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div
                  className="company-icon"
                  onClick={() => logoInputRef.current?.click()}
                  style={{ cursor: "pointer", position: "relative" }}
                  title="Click to upload logo"
                >
                  {editLogoUrl ? (
                    <Image src={editLogoUrl} alt={editName} width={100} height={100} className="company-icon-image" unoptimized />
                  ) : (
                    <div className="company-icon-initials">{editName.charAt(0).toUpperCase()}</div>
                  )}
                  {isUploadingLogo && (
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11 }}>
                      Uploading…
                    </div>
                  )}
                  <input ref={logoInputRef} type="file" hidden accept="image/jpeg,image/png,image/svg+xml,image/webp" onChange={handleLogoUpload} />
                </div>
              </div>
              <div>
                <label className="arco-eyebrow" style={{ display: "block", marginBottom: 6 }}>Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-base input-default"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label className="arco-eyebrow" style={{ display: "block", marginBottom: 6 }}>Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="input-base input-default"
                  style={{ width: "100%", resize: "vertical" }}
                  rows={3}
                />
              </div>
            </div>
            <div className="popup-actions" style={{ marginTop: 20 }}>
              <button type="button" className="btn-tertiary" style={{ flex: 1 }} onClick={() => setEditBrand(null)}>Cancel</button>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleSaveEdit} disabled={isPending || !editName.trim()}>
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status popup */}
      {statusBrand && (
        <div className="popup-overlay" onClick={() => setStatusBrand(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Update status</h3>
              <button type="button" className="popup-close" onClick={() => setStatusBrand(null)} aria-label="Close">✕</button>
            </div>
            <div className="status-modal-options">
              {Object.entries(STATUS_LABEL).map(([key, label]) => {
                const isSelected = statusValue === key
                return (
                  <button
                    key={key}
                    type="button"
                    className={`status-modal-option${isSelected ? " selected" : ""}`}
                    onClick={() => setStatusValue(key)}
                  >
                    <span className="status-modal-dot" style={{ background: STATUS_DOT[key] }} />
                    <div className="status-modal-option-text">
                      <span className="status-modal-option-label">{label}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="popup-actions" style={{ marginTop: 20 }}>
              <button type="button" className="btn-tertiary" style={{ flex: 1 }} onClick={() => setStatusBrand(null)}>Cancel</button>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleSaveStatus} disabled={isPending || statusValue === statusBrand.status}>
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete popup */}
      {deleteBrandTarget && (
        <div className="popup-overlay" onClick={() => setDeleteBrandTarget(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete brand</h3>
              <button type="button" className="popup-close" onClick={() => setDeleteBrandTarget(null)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 8 }}>
              Are you sure you want to delete <strong>{deleteBrandTarget.name}</strong>?
            </p>
            <p className="arco-small-text" style={{ marginBottom: 20 }}>
              This will permanently delete the brand and all {deleteBrandTarget.product_count} products. This cannot be undone.
            </p>
            <div className="popup-actions">
              <button type="button" className="btn-tertiary" style={{ flex: 1 }} onClick={() => setDeleteBrandTarget(null)}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1, background: "var(--destructive)" }} onClick={handleConfirmDelete} disabled={isPending}>
                {isPending ? "Deleting…" : "Delete brand"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
