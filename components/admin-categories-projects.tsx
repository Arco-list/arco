"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { ChevronRight, Home } from "lucide-react"

import type { AdminCategoryRow, AdminSpaceRow } from "@/components/admin-categories-data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SUBTYPE_ICON_MAP } from "@/components/filter-icon-map"
import { resolveFeatureIcon } from "@/lib/icons/project-features"
import { spaceNoun } from "@/lib/type-labels"
import { cn } from "@/lib/utils"

/**
 * De Projecten-tab van /admin/categories, in het ontwerp van de
 * Professionals-tab: twee uitklapgroepen. "Projecten" zijn de
 * gebouwtypes (villa, appartement, chalet) van architectuurprojecten.
 * "Deelprojecten" zijn de ruimtes waaronder diensten deelprojecten
 * publiceren (keukens, badkamers, zwembaden, wellness, tuinen,
 * tuinhuizen): een ruimte staat hier zodra een dienst eraan gekoppeld
 * is op de tab Samenhang. Ruimtes zelf beheer je op de tab Ruimtes.
 * "Publiceert" noemt de diensten die er publiceren: bij gebouwtypes de
 * diensten met publiceerstand Projecten, bij ruimtes de gekoppelde
 * diensten. Namen staan overal in het enkelvoud (Villa, Keuken), zoals
 * een categorienaam; meervoud is voor koppen en hubs.
 */

type Props = {
  types: AdminCategoryRow[]
  spaces: AdminSpaceRow[]
  services: AdminCategoryRow[]
  serviceSpaces: Array<{ serviceId: string; spaceId: string }>
  /** Aantal deelprojecten per ruimte-id. */
  partialCounts: Record<string, number>
  search: string
  pending: boolean
  onEdit: (row: AdminCategoryRow) => void
  onDelete: (row: AdminCategoryRow) => void
  onToggleStatus: (row: AdminCategoryRow, isActive: boolean) => void
  onToggleHomepage: (row: AdminCategoryRow, enabled: boolean) => void
  onToggleSpaceStatus: (space: AdminSpaceRow, isActive: boolean) => void
  onToggleSpaceHomepage: (space: AdminSpaceRow, enabled: boolean) => void
  onOpenSpaces: () => void
}

const COPY = {
  en: {
    type: "Type", status: "Status", homepage: "Homepage", publishes: "Publishes", projects: "Projects",
    groupProjects: "Projects", groupPartial: "Partial projects",
    groupProjectsSub: (n: number, total: number) => `${n} ${n === 1 ? "type" : "types"} · ${total} ${total === 1 ? "project" : "projects"}`,
    groupPartialSub: (n: number, total: number) => `${n} ${n === 1 ? "space" : "spaces"} · ${total} ${total === 1 ? "partial project" : "partial projects"}`,
    active: "Active", inactive: "Inactive", on: "On", off: "Off",
    activate: "Activate", deactivate: "Deactivate", edit: "Edit", delete: "Delete",
    editInSpaces: "Edit on the Spaces tab",
    noMatch: "Nothing matches your search.", none: "No types yet.", nonePartial: "No space has a publishing service yet. Connect one on the Connections tab.",
    toActivate: "Click to activate", toDeactivate: "Click to deactivate",
    onHome: "Shown on the homepage — click to remove", toHome: "Click to show on the homepage",
  },
  nl: {
    type: "Type", status: "Status", homepage: "Homepage", publishes: "Publiceert", projects: "Projecten",
    groupProjects: "Projecten", groupPartial: "Deelprojecten",
    groupProjectsSub: (n: number, total: number) => `${n} ${n === 1 ? "type" : "types"} · ${total} ${total === 1 ? "project" : "projecten"}`,
    groupPartialSub: (n: number, total: number) => `${n} ${n === 1 ? "ruimte" : "ruimtes"} · ${total} ${total === 1 ? "deelproject" : "deelprojecten"}`,
    active: "Actief", inactive: "Inactief", on: "Aan", off: "Uit",
    activate: "Activeren", deactivate: "Deactiveren", edit: "Bewerken", delete: "Verwijderen",
    editInSpaces: "Bewerken op tab Ruimtes",
    noMatch: "Niets gevonden.", none: "Nog geen types.", nonePartial: "Nog geen ruimte met een publicerende dienst. Koppel er een op de tab Samenhang.",
    toActivate: "Klik om te activeren", toDeactivate: "Klik om te deactiveren",
    onHome: "Staat op de homepage — klik om te verwijderen", toHome: "Klik om op de homepage te tonen",
  },
}

type RowMenu =
  | { kind: "type"; row: AdminCategoryRow; x: number; y: number }
  | { kind: "space"; row: AdminSpaceRow; x: number; y: number }

export function ProjectsTab({ types, spaces, services, serviceSpaces, partialCounts, search, pending, onEdit, onDelete, onToggleStatus, onToggleHomepage, onToggleSpaceStatus, onToggleSpaceHomepage, onOpenSpaces }: Props) {
  const locale = useLocale()
  const nl = locale === "nl"
  const c = nl ? COPY.nl : COPY.en
  const label = (row: AdminCategoryRow) => (nl && row.nameNl ? row.nameNl : row.name)
  // Enkelvoud voor ruimtes komt uit de filterlabels (Keuken, Badkamer);
  // spaceNoun is het meervoud voor koppen en wordt hier alleen doorzocht.
  const tf = useTranslations("projects.filters")
  const spaceLabel = (s: AdminSpaceRow) => (tf.has(s.slug) ? tf(s.slug) : s.name)
  // Wie publiceert architectuurprojecten: de diensten met stand Projecten.
  const projectPublishers = useMemo(
    () => services.filter((s) => s.publishScope === "project").map(label).join(" · "),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, nl],
  )
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [rowMenu, setRowMenu] = useState<RowMenu | null>(null)

  const q = search.trim().toLowerCase()

  const typeRows = useMemo(
    () => types
      .slice()
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99) || a.name.localeCompare(b.name))
      .filter((t) => !q || t.name.toLowerCase().includes(q) || (t.nameNl ?? "").toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)),
    [types, q],
  )

  // Deelprojecten: de ruimtes met minstens één publicerende dienst, met
  // die diensten erbij als tweede regel.
  const servicesBySpace = useMemo(() => {
    const byId = new Map(services.map((s) => [s.id, s]))
    const map = new Map<string, AdminCategoryRow[]>()
    for (const l of serviceSpaces) {
      const svc = byId.get(l.serviceId)
      if (!svc) continue
      map.set(l.spaceId, [...(map.get(l.spaceId) ?? []), svc])
    }
    return map
  }, [services, serviceSpaces])
  const partialRows = useMemo(
    () => spaces
      .filter((s) => servicesBySpace.has(s.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((s) => {
        if (!q) return true
        const noun = spaceNoun(s.slug, locale).toLowerCase()
        return noun.includes(q) || spaceLabel(s).toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)
      }),
    [spaces, servicesBySpace, q, locale],
  )

  useEffect(() => {
    if (!q) return
    const open = new Set<string>()
    if (typeRows.length) open.add("projects")
    if (partialRows.length) open.add("partial")
    setExpanded(open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const openMenu = (e: React.MouseEvent, menu: RowMenu) => {
    if ((e.target as HTMLElement).closest("button, a, input, label, [role='menuitem']")) return
    setRowMenu(menu)
  }

  const statusButton = (isActive: boolean, onClick: () => void) => (
    <button
      type="button"
      className="arco-table-status hover:opacity-70 transition-opacity cursor-pointer"
      disabled={pending}
      title={isActive ? c.toDeactivate : c.toActivate}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      <span className={cn("arco-table-status-dot", isActive ? "bg-emerald-500" : "bg-[#d4d4d3]")} />
      <span>{isActive ? c.active : c.inactive}</span>
    </button>
  )
  const homepageButton = (on: boolean, onClick: () => void) => (
    <button
      type="button"
      className="arco-table-status hover:opacity-70 transition-opacity cursor-pointer"
      disabled={pending}
      title={on ? c.onHome : c.toHome}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      <span className={cn("arco-table-status-dot", on ? "bg-emerald-500" : "bg-[#d4d4d3]")} />
      <span style={on ? undefined : { color: "var(--text-disabled)" }}>{on ? c.on : c.off}</span>
    </button>
  )
  const count = (n: number) => (n > 0 ? <span className="arco-table-primary">{n}</span> : <span className="arco-table-secondary">—</span>)

  const groupRow = (id: string, title: string, sub: string) => {
    const isOpen = expanded.has(id)
    return (
      <tr className="bg-[#FAFAF9]" onClick={() => toggle(id)} style={{ cursor: "pointer" }}>
        <td>
          <div className="flex items-center gap-2">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#a1a1a0] transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0)" }} />
            <div className="flex flex-col min-w-0">
              <span className="arco-table-primary" style={{ fontWeight: 600 }}>{title}</span>
              <span className="arco-table-secondary">{sub}</span>
            </div>
          </div>
        </td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    )
  }

  const totalProjects = typeRows.reduce((sum, t) => sum + t.count, 0)
  const totalPartial = partialRows.reduce((sum, s) => sum + (partialCounts[s.id] ?? 0), 0)
  const showProjects = !q || typeRows.length > 0
  const showPartial = !q || partialRows.length > 0

  return (
    <>
      <div className="arco-table-wrap max-w-full min-w-0">
        <table className="arco-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>{c.type}</th>
              <th>{c.status}</th>
              <th>{c.homepage}</th>
              <th>{c.publishes}</th>
              <th>{c.projects}</th>
              <th style={{ width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {!showProjects && !showPartial ? (
              <tr>
                <td colSpan={6} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>{c.noMatch}</td>
              </tr>
            ) : (
              <>
                {showProjects && (
                  <Fragment key="projects">
                    {groupRow("projects", c.groupProjects, c.groupProjectsSub(typeRows.length, totalProjects))}
                    {expanded.has("projects") && (typeRows.length === 0 ? (
                      <tr><td colSpan={6} style={{ height: 64, textAlign: "center", color: "var(--text-disabled)" }}>{c.none}</td></tr>
                    ) : typeRows.map((t) => {
                      const Icon = SUBTYPE_ICON_MAP[`house-${t.slug}`] ?? Home
                      return (
                        <tr key={t.id} onClick={(e) => openMenu(e, { kind: "type", row: t, x: e.clientX, y: e.clientY })} style={{ cursor: "pointer" }}>
                          <td>
                            <div className="flex items-center gap-2" style={{ paddingLeft: 22 }}>
                              <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#1c1c1a" }}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="arco-table-primary" title={label(t)}>{label(t)}</span>
                                <span className="arco-table-secondary">{nl && t.nameNl ? `${t.name} · ${t.slug}` : t.slug}</span>
                              </div>
                            </div>
                          </td>
                          <td>{statusButton(t.isActive, () => onToggleStatus(t, !t.isActive))}</td>
                          <td>{homepageButton(t.inHomeCarrousel, () => onToggleHomepage(t, !t.inHomeCarrousel))}</td>
                          <td>{projectPublishers ? <span className="arco-table-primary" style={{ fontWeight: 400 }}>{projectPublishers}</span> : <span className="arco-table-secondary">—</span>}</td>
                          <td>{count(t.count)}</td>
                          <td></td>
                        </tr>
                      )
                    }))}
                  </Fragment>
                )}
                {showPartial && (
                  <Fragment key="partial">
                    {groupRow("partial", c.groupPartial, c.groupPartialSub(partialRows.length, totalPartial))}
                    {expanded.has("partial") && (partialRows.length === 0 ? (
                      <tr><td colSpan={6} style={{ height: 64, textAlign: "center", color: "var(--text-disabled)" }}>{c.nonePartial}</td></tr>
                    ) : partialRows.map((s) => {
                      const Icon = resolveFeatureIcon(s.iconKey ?? s.slug)
                      const publishers = (servicesBySpace.get(s.id) ?? []).map(label).join(" · ")
                      return (
                        <tr key={s.id} onClick={(e) => openMenu(e, { kind: "space", row: s, x: e.clientX, y: e.clientY })} style={{ cursor: "pointer" }}>
                          <td>
                            <div className="flex items-center gap-2" style={{ paddingLeft: 22 }}>
                              <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#1c1c1a" }}>
                                <Icon size={16} strokeWidth={1} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="arco-table-primary">{spaceLabel(s)}</span>
                                <span className="arco-table-secondary">{s.slug}</span>
                              </div>
                            </div>
                          </td>
                          <td>{statusButton(s.isActive, () => onToggleSpaceStatus(s, !s.isActive))}</td>
                          <td>{homepageButton(s.inHomeCarrousel, () => onToggleSpaceHomepage(s, !s.inHomeCarrousel))}</td>
                          <td>{publishers ? <span className="arco-table-primary" style={{ fontWeight: 400 }}>{publishers}</span> : <span className="arco-table-secondary">—</span>}</td>
                          <td>{count(partialCounts[s.id] ?? 0)}</td>
                          <td></td>
                        </tr>
                      )
                    }))}
                  </Fragment>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Rijmenu op de klikpositie, zoals in de Companies-tabel. */}
      <DropdownMenu open={Boolean(rowMenu)} onOpenChange={(open) => { if (!open) setRowMenu(null) }}>
        <DropdownMenuTrigger asChild>
          <span aria-hidden style={{ position: "fixed", left: rowMenu?.x ?? 0, top: rowMenu?.y ?? 0, width: 1, height: 1 }} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {rowMenu?.kind === "type" && (
            <>
              <DropdownMenuItem onClick={() => { const r = rowMenu.row; setRowMenu(null); onEdit(r) }}>{c.edit}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { const r = rowMenu.row; setRowMenu(null); onToggleStatus(r, !r.isActive) }}>{rowMenu.row.isActive ? c.deactivate : c.activate}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => { const r = rowMenu.row; setRowMenu(null); onDelete(r) }}>{c.delete}</DropdownMenuItem>
            </>
          )}
          {rowMenu?.kind === "space" && (
            <>
              <DropdownMenuItem onClick={() => { const r = rowMenu.row; setRowMenu(null); onToggleSpaceStatus(r, !r.isActive) }}>{rowMenu.row.isActive ? c.deactivate : c.activate}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setRowMenu(null); onOpenSpaces() }}>{c.editInSpaces}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
