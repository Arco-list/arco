import { focusPositionIn } from "@/lib/images/focus"
import { Link } from "@/i18n/navigation"

import type { CatalogProject, CatalogCollection } from "@/lib/products/catalog-types"
import { BrandLogo } from "@/components/brand/brand-logo"
import { CollectionSub } from "@/components/catalog/collection-sub"
import { PhotoBrandDots } from "@/components/project/photo-brand-dots"
import { spaceLabelSingular } from "@/lib/type-labels"

/**
 * De kaarten van de productlaag, in de vorm van de discover-kaart zodat
 * een collectie, een merk en een project op dezelfde pagina hetzelfde
 * gewicht hebben.
 */

/**
 * Onder de naam van een collectie: wat het is en van wie, zoals een project
 * type · locatie toont. Op de merkpagina (het merk staat er al boven)
 * is dat soort · designer; waar kaarten van meerdere merken door elkaar
 * staan komt het merk voorop: merk · soort. Staat er geen van beide in,
 * dan het aantal projecten, zodat de regel niet leeg blijft.
 */
export function CollectionCard({ collection, locale, showBrand = true, kind = null }: { collection: CatalogCollection; locale: string; showBrand?: boolean; /** Naam van de soort (categorie) van de collectie, in de taal van de pagina. */ kind?: string | null }) {
  const nl = locale === "nl"
  const projects = collection.projectCount > 0 ? `${collection.projectCount} ${nl ? (collection.projectCount === 1 ? "project" : "projecten") : collection.projectCount === 1 ? "project" : "projects"}` : null
  const described = showBrand ? [collection.brand.name, kind] : [kind, collection.designer]
  const parts = (described.some(Boolean) && (showBrand ? described.slice(1).some(Boolean) : true) ? described : [showBrand ? collection.brand.name : null, projects]).filter(Boolean)
  return (
    <Link href={`/brands/${collection.brand.slug}/${collection.slug}`} className="discover-card">
      <div className="discover-card-image-wrap">
        <div className="discover-card-image-layer">
          {collection.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={collection.heroImageUrl} alt={collection.name} width={600} height={450} loading="lazy" decoding="async" style={collection.heroFocus ? { objectPosition: focusPositionIn(collection.heroFocus, collection.heroSize, 4 / 3) } : undefined} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#f0f0ee" }} />
          )}
        </div>
      </div>
      {showBrand ? (
        // Waar kaarten van meerdere merken door elkaar staan: het merklogo
        // naast naam en regel, zoals het bedrijfslogo op de professionalkaart.
        <div className="pro-card-info">
          <BrandLogo logoUrl={collection.brand.logoUrl} name={collection.brand.name} size={40} />
          <div style={{ minWidth: 0 }}>
            <h3 className="discover-card-title">{collection.name}</h3>
            {parts.length > 0 && <p className="discover-card-sub">{parts.join(" · ")}</p>}
          </div>
        </div>
      ) : (
        <>
          <h3 className="discover-card-title">{collection.name}</h3>
          {kind || collection.designer
            ? <CollectionSub kinds={kind} designer={collection.designer} nl={nl} />
            : parts.length > 0 && <p className="discover-card-sub">{parts.join(" · ")}</p>}
        </>
      )}
    </Link>
  )
}

export function ProjectCard({ project, locale = "nl" }: { project: CatalogProject; locale?: string }) {
  // Een ruimteproject "is" zijn ruimte: Tuin · Reeuwijk, zoals op de
  // projectkaarten elders.
  const typeLabel = project.spaceSlug ? (spaceLabelSingular(project.spaceSlug, locale) ?? project.type) : project.type
  const sub = [typeLabel, project.location].filter(Boolean).join(" · ")
  const tagged = project.taggedPhoto
  // Niet gepubliceerd (alleen admins zien die): zeg het op de kaart.
  const unpublished = project.status && project.status !== "published"
    ? (locale === "nl" ? (project.status === "in_progress" ? "In review" : "Concept") : (project.status === "in_progress" ? "In review" : "Draft"))
    : null
  return (
    <Link href={`/projects/${project.slug}`} className="discover-card">
      <div className="discover-card-image-wrap" style={{ position: "relative" }}>
        <div className="discover-card-image-layer">
          {project.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.imageUrl} alt={project.title} width={600} height={450} loading="lazy" decoding="async" />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#f0f0ee" }} />
          )}
        </div>
        {/* De foto waarop het product staat, met de stip (migratie 317). */}
        {tagged && tagged.tags.length > 0 && (
          <PhotoBrandDots tags={tagged.tags} src={tagged.url} width={tagged.width} height={tagged.height} fit="cover" />
        )}
        {unpublished && (
          <span className="status-pill" style={{ position: "absolute", top: 10, left: 10, background: "#fff", zIndex: 4 }}>{unpublished}</span>
        )}
      </div>
      <h3 className="discover-card-title">{project.title}</h3>
      {sub && <p className="discover-card-sub">{sub}</p>}
    </Link>
  )
}

export function BrandCard({ brand, locale }: { brand: { slug: string; name: string; logoUrl: string | null; country: string | null; collectionCount: number; projectCount: number }; locale: string }) {
  const nl = locale === "nl"
  const parts = [
    brand.country,
    brand.collectionCount > 0 ? `${brand.collectionCount} ${nl ? (brand.collectionCount === 1 ? "collectie" : "collecties") : brand.collectionCount === 1 ? "collection" : "collections"}` : null,
    brand.projectCount > 0 ? `${brand.projectCount} ${nl ? (brand.projectCount === 1 ? "project" : "projecten") : brand.projectCount === 1 ? "project" : "projects"}` : null,
  ].filter(Boolean)
  return (
    <Link href={`/brands/${brand.slug}`} className="discover-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span className="company-icon" style={{ margin: 0 }}>
        <BrandLogo logoUrl={brand.logoUrl} name={brand.name} size={56} />
      </span>
      <span>
        <h3 className="discover-card-title" style={{ marginTop: 0 }}>{brand.name}</h3>
        {parts.length > 0 && <p className="discover-card-sub">{parts.join(" · ")}</p>}
      </span>
    </Link>
  )
}
