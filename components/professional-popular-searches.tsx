import { Link } from "@/i18n/navigation"
import { proHubCopy, type ProHub } from "@/lib/professional-hubs"
import { ShowAllList } from "@/components/show-all-list"

/** Number of links a column shows before the "Show all" toggle. */
const COLUMN_CAP = 8

/** "Populaire zoekopdrachten" for the PROFESSIONALS side — the twin of
 *  components/popular-searches.tsx: links every professional hub (services,
 *  geo, service-geo combos) one hop from the /professionals root. Same
 *  inventory-gated hub set as the routes and sitemap, so every link lands
 *  on a stocked page; columns collapse behind Show-all with the full list
 *  kept in the DOM for crawlers. */
export function ProfessionalPopularSearches({ hubs, locale }: { hubs: ProHub[]; locale: string }) {
  const nl = locale === "nl"
  if (hubs.length === 0) return null

  // Services means SERVICES (architect, interior designer) — service
  // GROUPS (category hubs like "Design & Planning") are deliberately
  // excluded here: their labels read as jargon in a search directory.
  // The group hubs stay routable and in the sitemap.
  const services = hubs.filter((h) => h.kind === "service")
  const places = hubs.filter((h) => h.kind === "province" || h.kind === "city")
  const combos = hubs.filter((h) => h.kind === "service-city" || h.kind === "service-province")
  // Country dropped in the services column label — it's national by definition.
  const nationalLabel = (h1: string) => h1.replace(/ in (Nederland|the Netherlands)$/, "")

  const column = (items: ProHub[], label: (hub: ProHub) => string) => (
    <ShowAllList cap={COLUMN_CAP} locale={locale}>
      {items.map((hub) => (
        <p key={hub.slug} style={{ marginBottom: 8 }}>
          <Link href={`/professionals/${hub.slug}`} className="view-all-link">
            {label(hub)}
          </Link>
        </p>
      ))}
    </ShowAllList>
  )

  return (
    // Tighter bottom: the FAQ follows directly (paddingTop 0), so the
    // directory's bottom padding is the whole gap between the two.
    <section className="pt-16 pb-8 max-md:pt-10 max-md:pb-6 bg-white">
      <div className="wrap">
        <h2 className="arco-section-title" style={{ marginBottom: 24 }}>
          {nl ? "Populaire zoekopdrachten" : "Popular searches"}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 32 }}>
          {services.length > 0 && (
            <div>
              <p className="arco-eyebrow" style={{ color: "#a1a1a0", marginBottom: 10 }}>
                {nl ? "Diensten" : "Services"}
              </p>
              {column(services, (hub) => nationalLabel(proHubCopy(hub, locale).h1))}
            </div>
          )}
          {places.length > 0 && (
            <div>
              <p className="arco-eyebrow" style={{ color: "#a1a1a0", marginBottom: 10 }}>
                {nl ? "Regio's en steden" : "Regions & cities"}
              </p>
              {column(places, (hub) => proHubCopy(hub, locale).h1)}
            </div>
          )}
          {combos.length > 0 && (
            <div>
              <p className="arco-eyebrow" style={{ color: "#a1a1a0", marginBottom: 10 }}>
                {nl ? "Dienst per plaats" : "Service by place"}
              </p>
              {column(combos, (hub) => proHubCopy(hub, locale).h1)}
            </div>
          )}
          <div>
            <p className="arco-eyebrow" style={{ color: "#a1a1a0", marginBottom: 10 }}>
              {nl ? "Projecten" : "Projects"}
            </p>
            {[
              { href: "/projects/interieur", nl: "Interieurprojecten", en: "Interior projects" },
              { href: "/projects/nieuwbouw", nl: "Nieuwbouwprojecten", en: "New-build projects" },
              { href: "/projects/renovatie", nl: "Renovatieprojecten", en: "Renovation projects" },
              { href: "/projects", nl: "Alle projecten", en: "All projects" },
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
