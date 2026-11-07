import { NextResponse } from "next/server"

import { getNavMenus } from "@/lib/nav-menu"
import { locales, defaultLocale } from "@/i18n/config"

/**
 * De inhoud van de twee uitklapmenu's in de header.
 *
 * De header is een client component onder 42 verschillende pagina's;
 * de hubs waaruit het menu bestaat komen uit de database. Dat laatste
 * per paginaweergave ophalen zou elke pagina duurder maken voor een
 * menu dat de meeste bezoekers nooit openen — dus haalt de header hem
 * hier op bij de eerste keer uitklappen, één keer per sessie.
 *
 * De links staan daarmee niet in de HTML, en dat is hier geen verlies:
 * dezelfde links staan volledig in Populaire zoekopdrachten onder aan
 * /projects en /professionals én in de sitemap. Het menu is navigatie,
 * geen crawl-oppervlak.
 */
export const revalidate = 300

export async function GET(request: Request) {
  const url = new URL(request.url)
  const raw = url.searchParams.get("locale") ?? defaultLocale
  const locale = (locales as readonly string[]).includes(raw) ? raw : defaultLocale
  try {
    const menus = await getNavMenus(locale)
    return NextResponse.json(menus, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    })
  } catch (err) {
    console.error("nav-menu failed", err)
    // Lege menu's in plaats van een 500: de header valt dan terug op
    // twee gewone links, wat hij vóór dit menu ook was.
    return NextResponse.json(
      { projects: { columns: [], allHref: "/projects", allLabel: "" }, professionals: { columns: [], allHref: "/professionals", allLabel: "" } },
      { status: 200 },
    )
  }
}
