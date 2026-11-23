import { BrandDealers } from "@/components/brand/brand-dealers"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Link } from "@/i18n/navigation"
import { requireProductsAdmin } from "@/lib/products-gate"
import { categoryLabel, categoryTree, collectionKindsLabel, getBrandDealers, getBrandLocations, getBrandProjects, getCatalogBrands, getCatalogCategories, getCatalogCollections } from "@/lib/products/catalog"
import { ProfessionalLocations } from "@/components/professional/professional-locations"
import { BrandSubNav } from "@/components/brand/brand-sub-nav"
import { CollectionGrid } from "@/components/catalog/collection-grid"
import { ProjectCard, CollectionCard } from "@/components/catalog/catalog-cards"
import { BrandLogo } from "@/components/brand/brand-logo"

export const dynamic = "force-dynamic"

type Params = Promise<{ locale: string; brand: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { brand } = await params
  const b = (await getCatalogBrands()).find((x) => x.slug === brand)
  return { title: b?.name ?? "Merk", robots: { index: false, follow: false } }
}

/**
 * /brands/[merk] — het merk zoals een bezoeker het ziet: logo, naam,
 * omschrijving, wat het maakt; dan de collecties; dan de projecten waarin
 * het is toegepast. Admin-only tot de laag publiek gaat.
 */
export default async function BrandPage({ params }: { params: Params }) {
  await requireProductsAdmin()
  const { locale, brand: slug } = await params
  const nl = locale === "nl"

  const [brands, categories, allCollections] = await Promise.all([getCatalogBrands(), getCatalogCategories(), getCatalogCollections()])
  const brand = brands.find((b) => b.slug === slug)
  if (!brand) notFound()
  const tree = categoryTree(categories)
  // Eerst collecties met een hoofdbeeld, dan op aantal projecten, dan op naam: bij een ingeklapt raster bepaalt dit wat de bezoeker als eerste ziet.
  const collections = allCollections.filter((s) => s.brand.id === brand.id).sort((a, b) => Number(Boolean(b.heroImageUrl)) - Number(Boolean(a.heroImageUrl)) || b.projectCount - a.projectCount || a.name.localeCompare(b.name))
  const [projects, dealers, locations] = await Promise.all([getBrandProjects(brand.id, { includeInReview: true }), getBrandDealers(brand.id, locale), getBrandLocations(brand.id)])
  const makes = brand.categoryIds.map((id) => tree.byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c))
  const facts = [
    brand.country,
    brand.foundedYear ? (nl ? `Sinds ${brand.foundedYear}` : `Since ${brand.foundedYear}`) : null,
  ].filter(Boolean)
  const website = brand.website ? brand.website.replace(/^https?:\/\//i, "").replace(/\/$/, "") : null

  const kindOf = (s: (typeof collections)[number]) => collectionKindsLabel(s, tree.byId, locale)
  // De secties van de subnavigatie: alleen wat er ook staat.
  const sections = [
    { id: "details", label: "Details" },
    { id: "collections", label: nl ? "Collecties" : "Collections" },
    ...(projects.length > 0 ? [{ id: "projects", label: nl ? "Projecten" : "Projects" }] : []),
    ...(dealers.length > 0 || locations.length > 0 ? [{ id: "dealers", label: nl ? "Verkooppunten" : "Where to buy" }] : []),
  ]

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <BrandSubNav
        sections={sections}
        backLabel={nl ? "Terug" : "Back"}
        shareLabel={nl ? "Delen" : "Share"}
        copiedLabel={nl ? "Link gekopieerd" : "Link copied"}
        shareTitle={brand.name}
      />
      <main className="wrap" style={{ paddingTop: 120, paddingBottom: 80 }}>
        <section id="details" className="professional-header">
          <div className="company-icon">
            <BrandLogo logoUrl={brand.logoUrl} name={brand.name} />
          </div>
          <h1 className="arco-page-title">{brand.name}</h1>
          {makes.length > 0 && (
            <p className="professional-badge">
              {makes.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && " · "}
                  <Link href={`/products/${c.slug}`} className="hover:text-primary transition-colors">{categoryLabel(c, locale)}</Link>
                </span>
              ))}
            </p>
          )}
          {/* In de taal van de pagina (migratie 330), anders de Engelse bron. */}
          {(() => { const d = (nl && brand.descriptionNl) || brand.description; return d ? <p className="arco-body-text">{d}</p> : null })()}
        </section>

        {(facts.length > 0 || website) && (
          <section className="specifications-bar" style={{ marginBottom: 60 }}>
            {brand.country && (
              <div className="spec-item">
                <span className="arco-eyebrow">{nl ? "Land" : "Country"}</span>
                <div className="arco-card-title">{brand.country}</div>
              </div>
            )}
            {brand.foundedYear && (
              <div className="spec-item">
                <span className="arco-eyebrow">{nl ? "Opgericht" : "Founded"}</span>
                <div className="arco-card-title">{brand.foundedYear}</div>
              </div>
            )}
            <div className="spec-item">
              <span className="arco-eyebrow">{nl ? "Collecties" : "Collections"}</span>
              <div className="arco-card-title">{collections.length}</div>
            </div>
            <div className="spec-item">
              <span className="arco-eyebrow">{nl ? "In projecten" : "In projects"}</span>
              <div className="arco-card-title">{projects.length}</div>
            </div>
            {website && brand.website && (
              <div className="spec-item">
                <span className="arco-eyebrow">Website</span>
                <div className="arco-card-title">
                  <a href={brand.website} target="_blank" rel="noopener noreferrer" className="text-link-plain">{website} →</a>
                </div>
              </div>
            )}
          </section>
        )}

        <section id="collections" style={{ marginBottom: 60 }}>
          <div className="section-header">
            <h2 className="arco-section-title">{nl ? "Collecties" : "Collections"}</h2>
          </div>
          {collections.length === 0 ? (
            <p className="arco-body-text" style={{ color: "#a1a1a0" }}>{nl ? "Nog geen collecties." : "No collections yet."}</p>
          ) : (
            <CollectionGrid
              cards={collections.map((s) => <CollectionCard key={s.id} collection={s} locale={locale} showBrand={false} kind={kindOf(s)} />)}
              showAllLabel={nl ? `Toon alle ${collections.length} collecties` : `Show all ${collections.length} collections`}
            />
          )}
        </section>

        {projects.length > 0 && (
          <section id="projects" style={{ marginBottom: 60 }}>
            <div className="section-header">
              <h2 className="arco-section-title">{nl ? "Toegepast in projecten" : "Applied in projects"}</h2>
            </div>
            <div className="discover-grid">
              {projects.map((p) => <ProjectCard key={p.id} project={p} locale={locale} />)}
            </div>
          </section>
        )}

        {/* Verkooppunten: de bedrijven die het merk voeren — dezelfde rijen
            die op hun eigen pagina onder "Merken" staan. */}
        <div id="dealers">
        {dealers.length > 0 && (
          <section style={{ marginBottom: 60 }}>
            <div className="section-header">
              <h2 className="arco-section-title">{nl ? "Verkooppunten" : "Where to buy"}</h2>
            </div>
            {/* Zelfde kaart als de vermelde professionals op een project:
                categorie als eyebrow, logo op de grijze schijf, naam en
                eronder de plaats. */}
            <BrandDealers dealers={dealers} />
          </section>
        )}

        {/* Eigen showrooms van het merk (locations met brand_id). */}
        <ProfessionalLocations locations={locations} inWrap={false} fallbackLogoUrl={brand.logoUrl} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
