"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { useLocale } from "next-intl"
import { ChevronRight, MoreHorizontal } from "lucide-react"

import type { AdminCategoryRow, AdminSpaceRow } from "@/components/admin-categories-data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"
import { PUBLISH_SCOPES, publishScopeHint, publishScopeLabel, type PublishScope } from "@/lib/publish-scope"
import { cn } from "@/lib/utils"
import { spaceNoun } from "@/lib/type-labels"

/**
 * De Professionals-tab van /admin/categories, in de taal van de
 * Companies-tabel: het dienstpictogram van de discover-pagina vóór de
 * naam, statussen als stip plus woord die je aanklikt, een rijmenu op
 * de rij zelf. De hoofdgroepen (Design & Planning, Construction, …) zijn
 * uitklapbare rijen met hun diensten eronder. "Publiceert" toont wat de
 * dienst publiceert: Projecten, of de ruimte(s) waaronder deelprojecten
 * verschijnen (Keuken). Afbeelding en datum zitten in het bewerkvenster.
 * Zoeken opent de groepen met een treffer en verbergt de rest.
 */

type Props = {
  items: AdminCategoryRow[]
  /** Ruimtes en de dienst ↔ ruimte-koppelingen (tab Samenhang), voor de
   *  kolom Publiceert bij deelprojecten. */
  spaces: AdminSpaceRow[]
  serviceSpaces: Array<{ serviceId: string; spaceId: string }>
  search: string
  pending: boolean
  onEdit: (row: AdminCategoryRow) => void
  onDelete: (row: AdminCategoryRow) => void
  onToggleStatus: (row: AdminCategoryRow, isActive: boolean) => void
  onToggleHomepage: (row: AdminCategoryRow, enabled: boolean) => void
  onSetPublishScope: (row: AdminCategoryRow, scope: PublishScope) => void
}

const COPY = {
  en: {
    service: "Service", status: "Status", homepage: "Homepage", publishes: "Publishes", companies: "Companies", projects: "Projects", partial: "Partial projects",
    active: "Active", inactive: "Inactive", on: "On", off: "Off",
    activate: "Activate", deactivate: "Deactivate", edit: "Edit", delete: "Delete",
    editGroup: "Edit group", deleteGroup: "Delete group", groupActions: "Group actions",
    service1: "service", serviceN: "services", activeCount: "active",
    noMatch: "No services match your search.", none: "No services yet.",
    toActivate: "Click to activate", toDeactivate: "Click to deactivate",
    onHome: "Shown on the homepage — click to remove", toHome: "Click to show on the homepage",
  },
  nl: {
    service: "Dienst", status: "Status", homepage: "Homepage", publishes: "Publiceert", companies: "Bedrijven", projects: "Projecten", partial: "Deelprojecten",
    active: "Actief", inactive: "Inactief", on: "Aan", off: "Uit",
    activate: "Activeren", deactivate: "Deactiveren", edit: "Bewerken", delete: "Verwijderen",
    editGroup: "Groep bewerken", deleteGroup: "Groep verwijderen", groupActions: "Groepsacties",
    service1: "dienst", serviceN: "diensten", activeCount: "actief",
    noMatch: "Geen diensten gevonden.", none: "Nog geen diensten.",
    toActivate: "Klik om te activeren", toDeactivate: "Klik om te deactiveren",
    onHome: "Staat op de homepage — klik om te verwijderen", toHome: "Klik om op de homepage te tonen",
  },
}
type Copy = typeof COPY.en

export function ProfessionalsTab({ items, spaces, serviceSpaces, search, pending, onEdit, onDelete, onToggleStatus, onToggleHomepage, onSetPublishScope }: Props) {
  // Volgt de taalkeuze in de header (EN/NL): de kolommen, statussen en
  // menu's, én de dienstnamen zelf (categories.name_nl).
  const locale = useLocale()
  const nl = locale === "nl"
  const c = nl ? COPY.nl : COPY.en
  const label = (row: AdminCategoryRow) => (nl && row.nameNl ? row.nameNl : row.name)
  // Ruimtenamen per dienst, voor de kolom Publiceert bij deelprojecten.
  const spaceSlugById = useMemo(() => new Map(spaces.map((s) => [s.id, s.slug])), [spaces])
  const spacesByService = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const l of serviceSpaces) {
      const slug = spaceSlugById.get(l.spaceId)
      if (!slug) continue
      map.set(l.serviceId, [...(map.get(l.serviceId) ?? []), slug])
    }
    return map
  }, [serviceSpaces, spaceSlugById])
  const publishesText = (s: AdminCategoryRow): string | null => {
    if (s.publishScope === "project") return c.projects
    if (s.publishScope === "partial") {
      const names = (spacesByService.get(s.id) ?? []).map((slug) => spaceNoun(slug, locale))
      return names.length ? names.join(" · ") : c.partial
    }
    return null
  }
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [rowMenu, setRowMenu] = useState<{ row: AdminCategoryRow; x: number; y: number } | null>(null)

  const groups = useMemo(() => items.filter((c) => c.categoryHierarchy === 1), [items])
  const servicesByGroup = useMemo(() => {
    const map = new Map<string, AdminCategoryRow[]>()
    for (const s of items.filter((c) => c.categoryHierarchy !== 1)) {
      const key = s.parentId ?? "__orphan"
      const arr = map.get(key) ?? []
      arr.push(s)
      map.set(key, arr)
    }
    return map
  }, [items])

  const q = search.trim().toLowerCase()
  const matches = (s: AdminCategoryRow) => !q || s.name.toLowerCase().includes(q) || (s.nameNl ?? "").toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)

  // Zoeken: de groepen met een treffer staan open, zonder treffer blijven
  // ze weg. Zonder zoekterm bepaalt de admin zelf wat open staat.
  useEffect(() => {
    if (!q) return
    const open = new Set<string>()
    for (const g of groups) if ((servicesByGroup.get(g.id) ?? []).some(matches)) open.add(g.id)
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

  const openRowMenu = (e: React.MouseEvent, row: AdminCategoryRow) => {
    if ((e.target as HTMLElement).closest("button, a, input, label, [role='menuitem']")) return
    setRowMenu({ row, x: e.clientX, y: e.clientY })
  }

  const visibleGroups = groups.filter((g) => !q || (servicesByGroup.get(g.id) ?? []).some(matches))
  const orphans = (servicesByGroup.get("__orphan") ?? []).filter(matches)

  const renderService = (s: AdminCategoryRow) => {
    const Icon = resolveProfessionalServiceIcon(s.slug)
    return (
      <tr key={s.id} onClick={(e) => openRowMenu(e, s)} style={{ cursor: "pointer" }}>
        <td>
          <div className="flex items-center gap-2" style={{ paddingLeft: 22 }}>
            <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#1c1c1a" }}>
              <Icon size={16} strokeWidth={1} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="arco-table-primary" title={label(s)}>{label(s)}</span>
              <span className="arco-table-secondary">{nl && s.nameNl ? `${s.name} · ${s.slug}` : s.slug}</span>
            </div>
          </div>
        </td>
        <td>
          <button
            type="button"
            className="arco-table-status hover:opacity-70 transition-opacity cursor-pointer"
            disabled={pending}
            title={s.isActive ? c.toDeactivate : c.toActivate}
            onClick={(e) => { e.stopPropagation(); onToggleStatus(s, !s.isActive) }}
          >
            <span className={cn("arco-table-status-dot", s.isActive ? "bg-emerald-500" : "bg-[#d4d4d3]")} />
            <span>{s.isActive ? c.active : c.inactive}</span>
          </button>
        </td>
        <td>
          <button
            type="button"
            className="arco-table-status hover:opacity-70 transition-opacity cursor-pointer"
            disabled={pending}
            title={s.inHomeCarrousel ? c.onHome : c.toHome}
            onClick={(e) => { e.stopPropagation(); onToggleHomepage(s, !s.inHomeCarrousel) }}
          >
            <span className={cn("arco-table-status-dot", s.inHomeCarrousel ? "bg-emerald-500" : "bg-[#d4d4d3]")} />
            <span style={s.inHomeCarrousel ? undefined : { color: "var(--text-disabled)" }}>{s.inHomeCarrousel ? c.on : c.off}</span>
          </button>
        </td>
        <td>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="arco-table-status hover:opacity-70 transition-opacity cursor-pointer"
                title={publishScopeHint(s.publishScope, locale)}
                onClick={(e) => e.stopPropagation()}
              >
                {publishesText(s) ? (
                  <span className="arco-table-primary" style={{ fontWeight: 400 }}>{publishesText(s)}</span>
                ) : (
                  <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {PUBLISH_SCOPES.map((scope) => (
                <DropdownMenuItem key={scope} onClick={() => onSetPublishScope(s, scope)} className="flex flex-col items-start gap-0.5">
                  <span className={scope === s.publishScope ? "font-medium" : undefined}>{publishScopeLabel(scope, locale)}</span>
                  <span className="text-[11px] text-[#a1a1a0]">{publishScopeHint(scope, locale)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
        <td>
          {s.count > 0 ? <span className="arco-table-primary">{s.count}</span> : <span className="arco-table-secondary">—</span>}
        </td>
        <td></td>
      </tr>
    )
  }

  return (
    <>
      <div className="arco-table-wrap max-w-full min-w-0">
        <table className="arco-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>{c.service}</th>
              <th>{c.status}</th>
              <th>{c.homepage}</th>
              <th>{c.publishes}</th>
              <th>{c.companies}</th>
              <th style={{ width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {visibleGroups.length === 0 && orphans.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  {q ? c.noMatch : c.none}
                </td>
              </tr>
            ) : (
              <>
                {visibleGroups.map((g) => {
                  const services = (servicesByGroup.get(g.id) ?? []).filter(matches)
                  const isOpen = expanded.has(g.id)
                  const companies = services.reduce((sum, s) => sum + s.count, 0)
                  const active = services.filter((s) => s.isActive).length
                  return (
                    <Fragment key={g.id}>
                      <tr
                        className="bg-[#FAFAF9]"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button, [role='menuitem']")) return
                          toggle(g.id)
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            <ChevronRight
                              className="h-3.5 w-3.5 shrink-0 text-[#a1a1a0] transition-transform"
                              style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0)" }}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="arco-table-primary" style={{ fontWeight: 600 }}>{label(g)}</span>
                              <span className="arco-table-secondary">
                                {services.length} {services.length === 1 ? c.service1 : c.serviceN}
                                {active !== services.length ? ` · ${active} ${c.activeCount}` : ""}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="arco-table-status">
                            <span className={cn("arco-table-status-dot", g.isActive ? "bg-emerald-500" : "bg-[#d4d4d3]")} />
                            <span>{g.isActive ? c.active : c.inactive}</span>
                          </span>
                        </td>
                        <td></td>
                        <td></td>
                        <td>{companies > 0 ? <span className="arco-table-primary">{companies}</span> : <span className="arco-table-secondary">—</span>}</td>
                        <td style={{ paddingLeft: 0, paddingRight: 8 }}>
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-[3px] text-[#a1a1a0] hover:bg-[#f5f5f4] hover:text-[#1c1c1a] transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">{c.groupActions}</span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => onEdit(g)}>{c.editGroup}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onToggleStatus(g, !g.isActive)}>{g.isActive ? c.deactivate : c.activate}</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => onDelete(g)}>{c.deleteGroup}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                      {isOpen && services.map(renderService)}
                    </Fragment>
                  )
                })}
                {orphans.map(renderService)}
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
        <DropdownMenuContent align="start" className="w-44">
          {rowMenu && (
            <>
              <DropdownMenuItem onClick={() => { const r = rowMenu.row; setRowMenu(null); onEdit(r) }}>{c.edit}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { const r = rowMenu.row; setRowMenu(null); onToggleStatus(r, !r.isActive) }}>{rowMenu.row.isActive ? c.deactivate : c.activate}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => { const r = rowMenu.row; setRowMenu(null); onDelete(r) }}>{c.delete}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
