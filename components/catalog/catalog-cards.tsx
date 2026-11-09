import { Link } from "@/i18n/navigation"

import type { CatalogProject, CatalogSeries } from "@/lib/products/catalog-types"

/**
 * De kaarten van de productlaag, in de vorm van de discover-kaart zodat
 * een serie, een merk en een project op dezelfde pagina hetzelfde
 * gewicht hebben.
 */

export function SeriesCard({ series, locale, showBrand = true }: { series: CatalogSeries; locale: string; showBrand?: boolean }) {
  const nl = locale === "nl"
  const parts = [
    showBrand ? series.brand.name : null,
    series.projectCount > 0 ? `${series.projectCount} ${nl ? (series.projectCount === 1 ? "project" : "projecten") : series.projectCount === 1 ? "project" : "projects"}` : null,
  ].filter(Boolean)
  return (
    <Link href={`/brands/${series.brand.slug}/${series.slug}`} className="discover-card">
      <div className="discover-card-image-wrap">
        <div className="discover-card-image-layer">
          {series.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={series.heroImageUrl} alt={series.name} width={600} height={450} loading="lazy" decoding="async" />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#f0f0ee" }} />
          )}
        </div>
      </div>
      <h3 className="discover-card-title">{series.name}</h3>
      {parts.length > 0 && <p className="discover-card-sub">{parts.join(" · ")}</p>}
    </Link>
  )
}

export function ProjectCard({ project }: { project: CatalogProject }) {
  const sub = [project.type, project.location].filter(Boolean).join(" · ")
  return (
    <Link href={`/projects/${project.slug}`} className="discover-card">
      <div className="discover-card-image-wrap">
        <div className="discover-card-image-layer">
          {project.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.imageUrl} alt={project.title} width={600} height={450} loading="lazy" decoding="async" />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#f0f0ee" }} />
          )}
        </div>
      </div>
      <h3 className="discover-card-title">{project.title}</h3>
      {sub && <p className="discover-card-sub">{sub}</p>}
    </Link>
  )
}

export function BrandCard({ brand, locale }: { brand: { slug: string; name: string; logoUrl: string | null; country: string | null; seriesCount: number; projectCount: number }; locale: string }) {
  const nl = locale === "nl"
  const parts = [
    brand.country,
    brand.seriesCount > 0 ? `${brand.seriesCount} series` : null,
    brand.projectCount > 0 ? `${brand.projectCount} ${nl ? (brand.projectCount === 1 ? "project" : "projecten") : brand.projectCount === 1 ? "project" : "projects"}` : null,
  ].filter(Boolean)
  return (
    <Link href={`/brands/${brand.slug}`} className="discover-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span className="company-icon" style={{ margin: 0 }}>
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={brand.name} className="company-icon-image" style={{ width: 56, height: 56 }} />
        ) : (
          <span className="company-icon-initials" style={{ width: 56, height: 56, fontSize: 20 }}>{brand.name.charAt(0).toUpperCase()}</span>
        )}
      </span>
      <span>
        <h3 className="discover-card-title" style={{ marginTop: 0 }}>{brand.name}</h3>
        {parts.length > 0 && <p className="discover-card-sub">{parts.join(" · ")}</p>}
      </span>
    </Link>
  )
}
