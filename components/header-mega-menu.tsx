"use client"

import { useEffect, useState } from "react"
import { Link } from "@/i18n/navigation"

import type { NavMenu, NavMenus } from "@/lib/nav-menu"

export type MegaKey = "projects" | "professionals"

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

/** Het brede paneel onder de headerregel (desktop). */
export function MegaMenuPanel({ menu, onNavigate }: { menu: NavMenu | null; onNavigate: () => void }) {
  // Tot de vraag binnen is: een paneel van dezelfde orde van grootte,
  // zodat het niet onder de muis vandaan springt zodra het vult.
  if (!menu || menu.columns.length === 0) {
    return (
      <div className="border border-border bg-white shadow-lg px-8 py-7" style={{ minWidth: 560, minHeight: 220 }} aria-busy="true">
        <div className="grid gap-8" style={{ gridTemplateColumns: "repeat(3, minmax(150px, 1fr))" }}>
          {[0, 1, 2].map((c) => (
            <div key={c}>
              <div className="h-[11px] w-20 bg-[#f0efed] mb-4" />
              {[0, 1, 2, 3, 4].map((r) => (
                <div key={r} className="h-[11px] w-28 bg-[#f6f5f3] mb-3" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="border border-border bg-white shadow-lg px-8 py-7">
      <div
        className="grid gap-8"
        style={{ gridTemplateColumns: `repeat(${menu.columns.length}, minmax(150px, max-content))` }}
      >
        {menu.columns.map((col) => (
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
            <ul className="space-y-[7px]">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-normal text-[#1c1c1a] hover:text-primary transition-colors whitespace-nowrap"
                    onClick={onNavigate}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-border">
        <Link
          href={menu.allHref}
          className="text-sm font-medium text-primary hover:underline"
          onClick={onNavigate}
        >
          {menu.allLabel} →
        </Link>
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
