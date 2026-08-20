import { Link } from "@/i18n/navigation"
import { hubCopy, type Hub } from "@/lib/project-hubs"

export interface PopularHubs {
  cities: Hub[]
  scopes: Hub[]
  types: Hub[]
  combos: Hub[]
  provinces: Hub[]
}

/** "Populaire zoekopdrachten" — links to the programmatic hub pages.
 *  Rendered on the homepage (every hub one hop from the root) and below
 *  the projects discover grid. The list is generated from the same
 *  inventory-gated hub set as the routes and sitemap, so every link is
 *  a real, stocked page. */
export function PopularSearches({ hubs, locale, full = false }: { hubs: PopularHubs; locale: string; full?: boolean }) {
  const nl = locale === "nl"
  if (hubs.cities.length === 0 && hubs.scopes.length === 0) return null
  // Homepage keeps columns capped; the discover page (full) lists the
  // complete hub set, JamesEdition-style — the exhaustive crawl surface.
  const cap = <T,>(items: T[]) => (full ? items : items.slice(0, 8))
  const scopeCombos = hubs.combos.filter((h) => h.kind === "scope-city" || h.kind === "scope-province")
  return (
    <section className="py-16 max-md:py-10 bg-white">
      <div className="wrap">
        <h2 className="arco-section-title" style={{ marginBottom: 24 }}>
          {nl ? "Populaire zoekopdrachten" : "Popular searches"}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 32 }}>
          {(hubs.provinces.length > 0 || hubs.cities.length > 0) && (
            <div>
              <p className="arco-eyebrow" style={{ color: "#a1a1a0", marginBottom: 10 }}>
                {nl ? "Regio's en steden" : "Regions & cities"}
              </p>
              {cap([...hubs.provinces, ...hubs.cities]).map((hub) => (
                <p key={hub.slug} style={{ marginBottom: 8 }}>
                  <Link href={`/projects/${hub.slug}`} className="view-all-link">
                    {hubCopy(hub, locale).h1}
                  </Link>
                </p>
              ))}
            </div>
          )}
          {hubs.scopes.length > 0 && (
            <div>
              <p className="arco-eyebrow" style={{ color: "#a1a1a0", marginBottom: 10 }}>
                {nl ? "Projectscope" : "Project scope"}
              </p>
              {hubs.scopes.map((hub) => (
                <p key={hub.slug} style={{ marginBottom: 8 }}>
                  <Link href={`/projects/${hub.slug}`} className="view-all-link">
                    {/* Country dropped in the link label — the column
                        is national by definition. */}
                    {hubCopy(hub, locale).h1.replace(/ in (Nederland|the Netherlands)$/, "")}
                  </Link>
                </p>
              ))}
              {full && scopeCombos.map((hub) => (
                <p key={hub.slug} style={{ marginBottom: 8 }}>
                  <Link href={`/projects/${hub.slug}`} className="view-all-link">
                    {hubCopy(hub, locale).h1}
                  </Link>
                </p>
              ))}
            </div>
          )}
          {(hubs.types.length > 0 || hubs.combos.length > 0) && (
            <div>
              <p className="arco-eyebrow" style={{ color: "#a1a1a0", marginBottom: 10 }}>
                {nl ? "Woningtype" : "Home type"}
              </p>
              {cap([...hubs.types, ...hubs.combos.filter((h) => h.kind === "type-city" || h.kind === "type-province")]).map((hub) => (
                <p key={hub.slug} style={{ marginBottom: 8 }}>
                  <Link href={`/projects/${hub.slug}`} className="view-all-link">
                    {hubCopy(hub, locale).h1}
                  </Link>
                </p>
              ))}
            </div>
          )}
          {/* Professional hub links — service hubs are inventory-gated
              like every other hub, so both links land on stocked pages. */}
          <div>
            <p className="arco-eyebrow" style={{ color: "#a1a1a0", marginBottom: 10 }}>
              Professionals
            </p>
            {[
              { href: "/professionals/architect", nl: "Architecten", en: "Architects" },
              { href: "/professionals/interior-designer", nl: "Interieurontwerpers", en: "Interior designers" },
              { href: "/professionals", nl: "Alle professionals", en: "All professionals" },
            ].map((item) => (
              <p key={item.href} style={{ marginBottom: 8 }}>
                <Link href={item.href} className="view-all-link">
                  {nl ? item.nl : item.en}
                </Link>
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
