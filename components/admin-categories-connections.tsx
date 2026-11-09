"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { AdminCategoryRow, AdminProductCategoryRow, AdminSpaceRow } from "@/components/admin-categories-data-table"
import { toggleProductCategorySpaceAction, toggleServiceSpaceAction } from "@/app/admin/categories/actions"
import { PUBLISH_SCOPE_LABEL } from "@/lib/publish-scope"

/**
 * De samenhang tussen de assen, als twee matrices met de ruimtes als
 * kolommen. Boven: diensten — waar het werk van een dienst zichtbaar
 * wordt (Kitchens → kitchen); een deelproject van die dienst komt onder
 * dat ruimtefilter. Onder: productgroepen — waar een productgroep
 * thuishoort (Keukens → kitchen). Via de ruimte vinden dienst en
 * productgroep elkaar, en daarmee een keukenbouwer de merken die bij hem
 * passen. Klikken schakelt direct; de rij-eigenaar ziet meteen het
 * resultaat, de server bevestigt.
 */

type Props = {
  services: AdminCategoryRow[]
  spaces: AdminSpaceRow[]
  productCategories: AdminProductCategoryRow[]
  serviceSpaces: Array<{ serviceId: string; spaceId: string }>
  productCategorySpaces: Array<{ productCategoryId: string; spaceId: string }>
}

const key = (a: string, b: string) => `${a}:${b}`

/** Ruimtes die alleen bij hele projecten horen: de buitenkant van een
 *  gebouw en de restcategorie zijn geen plek waar een deelproject
 *  (keuken, zwembad) onder valt. Ze blijven wel beschikbaar voor
 *  productgroepen (buitenverlichting, gevelbekleding). */
const NOT_FOR_PARTIAL = new Set(["exterior", "other"])

function Cell({ on, disabled, onClick, title }: { on: boolean; disabled: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={on}
      style={{
        width: 18,
        height: 18,
        borderRadius: 3,
        border: `1px solid ${on ? "var(--arco-black)" : "#d6d6d4"}`,
        background: on ? "var(--arco-black)" : "#fff",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        transition: "background 0.12s ease, border-color 0.12s ease",
      }}
    >
      {on && (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8.5l3 3 7-7" />
        </svg>
      )}
    </button>
  )
}

export function ConnectionsTab({ services, spaces, productCategories, serviceSpaces, productCategorySpaces }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serviceOn, setServiceOn] = useState(() => new Set(serviceSpaces.map((l) => key(l.serviceId, l.spaceId))))
  const [productOn, setProductOn] = useState(() => new Set(productCategorySpaces.map((l) => key(l.productCategoryId, l.spaceId))))

  const activeSpaces = useMemo(() => spaces.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [spaces])
  const serviceRows = useMemo(() => services.filter((s) => s.categoryHierarchy === 2 && s.isActive), [services])
  const groups = useMemo(() => productCategories.filter((c) => !c.parentId).sort((a, b) => a.orderIndex - b.orderIndex), [productCategories])

  const flip = (
    set: Set<string>,
    setter: (next: Set<string>) => void,
    k: string,
    run: (enabled: boolean) => Promise<{ success: boolean; error?: { message: string } }>,
  ) => {
    const enabled = !set.has(k)
    const next = new Set(set)
    if (enabled) next.add(k); else next.delete(k)
    setter(next)
    startTransition(async () => {
      const result = await run(enabled)
      if (!result.success) {
        const revert = new Set(next)
        if (enabled) revert.delete(k); else revert.add(k)
        setter(revert)
        toast.error("Failed to update", { description: result.error?.message })
      } else {
        router.refresh()
      }
    })
  }

  const matrix = (
    title: string,
    intro: string,
    rows: Array<{ id: string; name: string; sub?: string | null; groupLabel?: string | null }>,
    on: Set<string>,
    onToggle: (rowId: string, spaceId: string) => void,
    columns: AdminSpaceRow[] = activeSpaces,
  ) => (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="arco-section-title" style={{ fontSize: 20, marginBottom: 4 }}>{title}</h2>
        <p className="arco-body-text" style={{ color: "#8c8c8a", maxWidth: 680, margin: 0 }}>{intro}</p>
      </div>
      <div className="arco-table-wrap max-w-full min-w-0">
        <table className="arco-table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: 240 }}>&nbsp;</th>
              {columns.map((s) => (
                <th key={s.id} style={{ textAlign: "center", padding: "10px 4px", fontSize: 11 }}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length + 1} style={{ height: 72, textAlign: "center", color: "var(--text-disabled)" }}>Nothing to connect.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-[#1c1c1a]">
                      {r.name}
                      {r.groupLabel && <span className="text-[11px] text-[#a1a1a0] font-normal"> · {r.groupLabel}</span>}
                    </span>
                    {r.sub && <span className="text-[11px] text-[#a1a1a0]">{r.sub}</span>}
                  </div>
                </td>
                {columns.map((s) => (
                  <td key={s.id} style={{ textAlign: "center", padding: "8px 4px" }}>
                    <Cell on={on.has(key(r.id, s.id))} disabled={isPending} onClick={() => onToggle(r.id, s.id)} title={`${r.name} ↔ ${s.name}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-10">
      {matrix(
        "Services ↔ spaces",
        "Where a service's work shows up. A partial project published by the service appears under these space filters; a company offering the service is suggested the brands that belong to the same spaces. Exterior and Other are whole-project spaces and are left out here.",
        serviceRows.map((s) => ({
          id: s.id,
          name: s.name,
          sub: s.publishScope === "none" ? null : PUBLISH_SCOPE_LABEL[s.publishScope],
          groupLabel: s.parentName,
        })),
        serviceOn,
        (serviceId, spaceId) => flip(serviceOn, setServiceOn, key(serviceId, spaceId), (enabled) => toggleServiceSpaceAction({ serviceId, spaceId, enabled })),
        activeSpaces.filter((s) => !NOT_FOR_PARTIAL.has(s.slug)),
      )}
      {matrix(
        "Product groups ↔ spaces",
        "Where a product group belongs. Through the space, brands in the group connect to the services that work there, and to the room photos a brand could be tagged on later.",
        groups.map((g) => ({ id: g.id, name: g.name, sub: g.slug })),
        productOn,
        (productCategoryId, spaceId) => flip(productOn, setProductOn, key(productCategoryId, spaceId), (enabled) => toggleProductCategorySpaceAction({ productCategoryId, spaceId, enabled })),
      )}
    </div>
  )
}
