"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { MoreHorizontal } from "lucide-react"

import type { AdminCategoryRow, AdminSpaceRow } from "@/components/admin-categories-data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { resolveFeatureIcon } from "@/lib/icons/project-features"
import { cn } from "@/lib/utils"

/**
 * De Ruimtes-tab van /admin/categories, in het ontwerp van de tabs
 * Projecten en Professionals: rond icoon met naam en slug, status en
 * homepage als stip plus woord, de diensten die er deelprojecten onder
 * publiceren, het aantal foto's, een rijmenu op de klikpositie. Beeld
 * en uitsnede zitten in het bewerkvenster, niet meer in de tabel.
 */

type Props = {
  spaces: AdminSpaceRow[]
  services: AdminCategoryRow[]
  serviceSpaces: Array<{ serviceId: string; spaceId: string }>
  search: string
  pending: boolean
  onToggleStatus: (space: AdminSpaceRow, isActive: boolean) => void
  onToggleHomepage: (space: AdminSpaceRow, enabled: boolean) => void
  onPickImage: (space: AdminSpaceRow, file: File) => void
  onUploadCutout: (space: AdminSpaceRow, file: File) => void
  onClearCutout: (space: AdminSpaceRow) => void
}

const COPY = {
  en: {
    space: "Space", status: "Status", homepage: "Homepage", publishes: "Publishes", photos: "Photos",
    active: "Active", inactive: "Inactive", on: "On", off: "Off",
    activate: "Activate", deactivate: "Deactivate", edit: "Edit",
    toActivate: "Click to activate", toDeactivate: "Click to deactivate",
    onHome: "Shown on the homepage — click to remove", toHome: "Click to show on the homepage",
    none: "No spaces yet.", noMatch: "No spaces match your search.",
    title: "Edit space", image: "Image", imageHint: "Mood photo for the homepage carousel (cropped).",
    cutout: "Disc image", cutoutHint: "Square detail photo with one element (a bath, a sofa), shown in the circle on /projects.",
    upload: "Upload", change: "Change", remove: "Remove", close: "Close",
  },
  nl: {
    space: "Ruimte", status: "Status", homepage: "Homepage", publishes: "Publiceert", photos: "Foto's",
    active: "Actief", inactive: "Inactief", on: "Aan", off: "Uit",
    activate: "Activeren", deactivate: "Deactiveren", edit: "Bewerken",
    toActivate: "Klik om te activeren", toDeactivate: "Klik om te deactiveren",
    onHome: "Staat op de homepage — klik om te verwijderen", toHome: "Klik om op de homepage te tonen",
    none: "Nog geen ruimtes.", noMatch: "Geen ruimtes gevonden.",
    title: "Ruimte bewerken", image: "Afbeelding", imageHint: "Sfeerbeeld voor de homepage-carrousel (bijgesneden).",
    cutout: "Cirkelbeeld", cutoutHint: "Vierkante detailfoto met één element (een bad, een bank), getoond in de cirkel op /projects.",
    upload: "Uploaden", change: "Wijzigen", remove: "Verwijderen", close: "Sluiten",
  },
}

export function SpacesTab({ spaces, services, serviceSpaces, search, pending, onToggleStatus, onToggleHomepage, onPickImage, onUploadCutout, onClearCutout }: Props) {
  const locale = useLocale()
  const nl = locale === "nl"
  const c = nl ? COPY.nl : COPY.en
  const tf = useTranslations("projects.filters")
  const label = (s: AdminSpaceRow) => (tf.has(s.slug) ? tf(s.slug) : s.name)
  const [rowMenu, setRowMenu] = useState<{ space: AdminSpaceRow; x: number; y: number } | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  const serviceName = (s: AdminCategoryRow) => (nl && s.nameNl ? s.nameNl : s.name)
  const publishersBySpace = useMemo(() => {
    const byId = new Map(services.map((s) => [s.id, s]))
    const map = new Map<string, string[]>()
    for (const l of serviceSpaces) {
      const svc = byId.get(l.serviceId)
      if (svc) map.set(l.spaceId, [...(map.get(l.spaceId) ?? []), serviceName(svc)])
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, serviceSpaces, nl])

  const q = search.trim().toLowerCase()
  const rows = useMemo(
    () => spaces
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((s) => !q || label(s).toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spaces, q, locale],
  )
  const editing = spaces.find((s) => s.id === editId) ?? null

  const openMenu = (e: React.MouseEvent, space: AdminSpaceRow) => {
    if ((e.target as HTMLElement).closest("button, a, input, label, [role='menuitem']")) return
    setRowMenu({ space, x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div className="arco-table-wrap max-w-full min-w-0">
        <table className="arco-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>{c.space}</th>
              <th>{c.status}</th>
              <th>{c.homepage}</th>
              <th>{c.publishes}</th>
              <th>{c.photos}</th>
              <th style={{ width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>{q ? c.noMatch : c.none}</td></tr>
            ) : rows.map((s) => {
              const Icon = resolveFeatureIcon(s.iconKey ?? s.slug)
              const publishers = (publishersBySpace.get(s.id) ?? []).join(" · ")
              return (
                <tr key={s.id} onClick={(e) => openMenu(e, s)} style={{ cursor: "pointer" }}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#1c1c1a" }}>
                        {s.cutoutUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.cutoutUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                        ) : (
                          <Icon size={16} strokeWidth={1} />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="arco-table-primary">{label(s)}</span>
                        <span className="arco-table-secondary">{s.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <button type="button" className="arco-table-status hover:opacity-70 transition-opacity cursor-pointer" disabled={pending}
                      title={s.isActive ? c.toDeactivate : c.toActivate}
                      onClick={(e) => { e.stopPropagation(); onToggleStatus(s, !s.isActive) }}>
                      <span className={cn("arco-table-status-dot", s.isActive ? "bg-emerald-500" : "bg-[#d4d4d3]")} />
                      <span>{s.isActive ? c.active : c.inactive}</span>
                    </button>
                  </td>
                  <td>
                    <button type="button" className="arco-table-status hover:opacity-70 transition-opacity cursor-pointer" disabled={pending}
                      title={s.inHomeCarrousel ? c.onHome : c.toHome}
                      onClick={(e) => { e.stopPropagation(); onToggleHomepage(s, !s.inHomeCarrousel) }}>
                      <span className={cn("arco-table-status-dot", s.inHomeCarrousel ? "bg-emerald-500" : "bg-[#d4d4d3]")} />
                      <span style={s.inHomeCarrousel ? undefined : { color: "var(--text-disabled)" }}>{s.inHomeCarrousel ? c.on : c.off}</span>
                    </button>
                  </td>
                  <td>{publishers ? <span className="arco-table-primary" style={{ fontWeight: 400 }}>{publishers}</span> : <span className="arco-table-secondary">—</span>}</td>
                  <td>{s.photoCount > 0 ? <span className="arco-table-primary">{s.photoCount}</span> : <span className="arco-table-secondary">—</span>}</td>
                  <td style={{ paddingLeft: 0, paddingRight: 8 }}>
                    <button type="button" className="flex h-7 w-7 items-center justify-center rounded-[3px] text-[#a1a1a0] hover:bg-[#f5f5f4] hover:text-[#1c1c1a] transition-colors"
                      onClick={(e) => { e.stopPropagation(); setEditId(s.id) }}>
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">{c.edit}</span>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <DropdownMenu open={Boolean(rowMenu)} onOpenChange={(open) => { if (!open) setRowMenu(null) }}>
        <DropdownMenuTrigger asChild>
          <span aria-hidden style={{ position: "fixed", left: rowMenu?.x ?? 0, top: rowMenu?.y ?? 0, width: 1, height: 1 }} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {rowMenu && (
            <>
              <DropdownMenuItem onClick={() => { const s = rowMenu.space; setRowMenu(null); setEditId(s.id) }}>{c.edit}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { const s = rowMenu.space; setRowMenu(null); onToggleStatus(s, !s.isActive) }}>{rowMenu.space.isActive ? c.deactivate : c.activate}</DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && (
        <div className="popup-overlay" onClick={() => setEditId(null)} style={{ zIndex: 500 }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{c.title}: {label(editing)}</h3>
              <button type="button" className="popup-close" onClick={() => setEditId(null)} aria-label={c.close}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                {editing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.imageUrl} alt="" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 3 }} />
                ) : (
                  <div style={{ width: 64, height: 48, borderRadius: 3, background: "#f5f5f4" }} />
                )}
                <div style={{ flex: 1 }}>
                  <span className="arco-eyebrow" style={{ display: "block" }}>{c.image}</span>
                  <p className="arco-body-text" style={{ margin: "2px 0 6px", color: "#8c8c8a", fontSize: 12 }}>{c.imageHint}</p>
                  <label className="btn-tertiary" style={{ fontSize: 12, padding: "4px 12px", cursor: "pointer", display: "inline-block" }}>
                    {editing.imageUrl ? c.change : c.upload}
                    <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => {
                      const file = e.target.files?.[0]; e.target.value = ""
                      if (file) { onPickImage(editing, file) }
                    }} />
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f5f5f4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {editing.cutoutUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editing.cutoutUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <span className="arco-eyebrow" style={{ display: "block" }}>{c.cutout}</span>
                  <p className="arco-body-text" style={{ margin: "2px 0 6px", color: "#8c8c8a", fontSize: 12 }}>{c.cutoutHint}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <label className="btn-tertiary" style={{ fontSize: 12, padding: "4px 12px", cursor: "pointer", display: "inline-block" }}>
                      {editing.cutoutUrl ? c.change : c.upload}
                      <input type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={(e) => {
                        const file = e.target.files?.[0]; e.target.value = ""
                        if (file) onUploadCutout(editing, file)
                      }} />
                    </label>
                    {editing.cutoutUrl && (
                      <button type="button" className="btn-tertiary" style={{ fontSize: 12, padding: "4px 12px", color: "#b42318" }} onClick={() => onClearCutout(editing)}>{c.remove}</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
