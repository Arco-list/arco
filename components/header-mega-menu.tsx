"use client"

import { useEffect, useState } from "react"
import { Link } from "@/i18n/navigation"

import type { NavMenu, NavMenus } from "@/lib/nav-menu"

export type MegaKey = "projects" | "professionals" | "products"

/**
 * Het uitklapmenu achter Projecten en Professionals in de header.
 *
 * De inhoud komt uit /api/nav-menu — dezelfde voorraad-gated hubs als
 * de routes en de sitemap, zodat er nooit een 404 in de hoofdnavigatie
 * belandt. Opgehaald bij de EERSTE keer uitklappen en daarna bewaard in
 * een modulevariabele: één vraag per sessie, nul voor de bezoeker die
 * het menu nooit opent.
 */

let cache: Promise<NavMenus> | null = null
let cachedLocale: string | null = null

function loadNavMenus(locale: string): Promise<NavMenus> {
  if (cache && cachedLocale === locale) return cache
  cachedLocale = locale
  cache = fetch(`/api/nav-menu?locale=${encodeURIComponent(locale)}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .catch((err) => {
      // Niet blijven plakken op een mislukte vraag — de volgende keer
      // uitklappen probeert het opnieuw.
      cache = null
      cachedLocale = null
      throw err
    })
  return cache
}

/**
 * Haalt de menu's op zodra `enabled` voor het eerst waar is.
 *
 * `failed` bestaat omdat een kapot menu erger is dan geen menu: zonder
 * dit signaal houdt het paneel zijn skeleton vast zolang de pagina
 * openstaat. Nu valt de header terug op de twee gewone links die hij
 * vóór dit menu ook was.
 */
export function useNavMenus(locale: string, enabled: boolean): { menus: NavMenus | null; failed: boolean } {
  const [menus, setMenus] = useState<NavMenus | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    loadNavMenus(locale)
      .then((m) => {
        if (!alive) return
        // Lege kolommen = de route's noodantwoord. Even onbruikbaar als
        // een mislukte vraag, dus hetzelfde gedrag.
        const empty = m.projects.columns.length === 0 && m.professionals.columns.length === 0
        if (empty) { setFailed(true); return }
        setMenus(m)
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [locale, enabled])
  return { menus, failed }
}

/** Acht rijen per kolom — COLUMN_CAP in nav-menu.ts. Een kolom met minder
 *  rijen wordt aangevuld met onzichtbare, zodat elk paneel even hoog is:
 *  Professionals heeft er hooguit vier per kolom, Projecten acht. */
const ROWS = 8

/**
 * Het brede paneel onder de header (desktop): de hele breedte, de kolommen
 * uitgelijnd op .wrap zodat ze onder het logo en de links beginnen.
 *
 * De verticale ruimte staat op een eigen div ín .wrap: .wrap zet zijn
 * padding zelf (ongelaagd) en wint daarmee van elke padding-utility op
 * hetzelfde element — py-7 op .wrap deed niets. Rijafstand als in de
 * footer: 14px, regelhoogte 1.5, 8px ertussen. Tot de vraag binnen is een
 * skelet van dezelfde hoogte, zodat het niet onder de muis vandaan springt.
 */
export function MegaMenuPanel({ menu, onNavigate }: { menu: NavMenu | null; onNavigate: () => void }) {
  const columns = menu?.columns ?? []
  const loading = columns.length === 0
  const row = "text-[14px] leading-[1.5] font-normal whitespace-nowrap"
  return (
    <div className="bg-white border-b border-border shadow-lg" aria-busy={loading || undefined}>
      <div className="wrap">
        <div className="py-7">
          {loading ? (
            <div className="grid gap-8" style={{ gridTemplateColumns: "repeat(4, minmax(150px, max-content))" }}>
              {[0, 1, 2, 3].map((c) => (
                <div key={c}>
                  <div className="h-[11px] w-20 bg-[#f0efed] mb-3" />
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: ROWS }, (_, r) => (
                      <div key={r} className="flex h-[21px] items-center">
                        <div className="h-[11px] w-28 bg-[#f6f5f3]" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(150px, max-content))` }}>
              {columns.map((col) => (
                <div key={col.label}>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#a1a1a0] mb-3">
                    {col.href ? (
                      <Link href={col.href} className="hover:text-primary transition-colors" onClick={onNavigate}>
                        {col.label}
                      </Link>
                    ) : (
                      col.label
                    )}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {col.links.map((link) => (
                      <li key={link.href} className={row}>
                        <Link href={link.href} className="text-[#1c1c1a] hover:text-primary transition-colors" onClick={onNavigate}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                    {Array.from({ length: Math.max(0, ROWS - col.links.length) }, (_, i) => (
                      <li key={`pad-${i}`} aria-hidden="true" className={`${row} invisible`}>·</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {menu && !loading && (
            <div className="mt-6 pt-4 border-t border-border">
              <Link href={menu.allHref} className="text-sm font-medium text-primary hover:underline" onClick={onNavigate}>
                {menu.allLabel} →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Dezelfde kolommen, maar onder elkaar als secties (mobiel).
 *
 * De links staan ingesprongen onder hun sectiekop: zonder dat verschil
 * is een kolomkop niet van een link te onderscheiden zodra alles in één
 * smalle lijst staat. Raakdoelen op 44px — py-2 gaf er 36 en dat is
 * onder wat een duim betrouwbaar raakt.
 */
export function MegaMenuMobileSections({ menu, onNavigate }: { menu: NavMenu | null; onNavigate: () => void }) {
  if (!menu || menu.columns.length === 0) return null
  return (
    <>
      {menu.columns.map((col) => (
        <div key={col.label}>
          <div className="px-5 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-[#a1a1a0]">
            {col.href ? (
              <Link href={col.href} className="hover:text-primary transition-colors" onClick={onNavigate}>
                {col.label}
              </Link>
            ) : (
              col.label
            )}
          </div>
          {col.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex min-h-[44px] items-center pl-8 pr-5 text-sm font-normal text-[#1c1c1a] hover:text-primary transition-colors"
              onClick={onNavigate}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ))}
    </>
  )
}
