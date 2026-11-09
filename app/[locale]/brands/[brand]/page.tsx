import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Link } from "@/i18n/navigation"
import { requireProductsAdmin } from "@/lib/products-gate"
import { categoryLabel, categoryTree, getBrandDealers, getBrandLocations, getBrandProjects, getCatalogBrands, getCatalogCategories, getCatalogSeries } from "@/lib/products/catalog"
import { ProfessionalLocations } from "@/components/professional/professional-locations"
import { ProjectCard, SeriesCard } from "@/components/catalog/catalog-cards"

export const dynamic = "force-dynamic"

type Params = Promise<{ locale: string; brand: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { brand } = await params
  const b = (await getCatalogBrands()).find((x) => x.slug === brand)
  return { title: b?.name ?? "Merk", robots: { index: false, follow: false } }
}

/**
 * /brands/[merk] — het merk zoals een bezoeker het ziet: logo, naam,
 * omschrijving, wat het maakt; dan de series; dan de projecten waarin
 * het is toegepast. Admin-only tot de laag publiek gaat.
 */
export default async function BrandPage({ params }: { params: Params }) {
  await requireProductsAdmin()
  const { locale, brand: slug } = await params
  const nl = locale === "nl"

  const [brands, categories, allSeries] = await Promise.all([getCatalogBrands(), getCatalogCategories(), getCatalogSeries()])
  const brand = brands.find((b) => b.slug === slug)
  if (!brand) notFound()
  const tree = categoryTree(categories)
  const series = allSeries.filter((s) => s.brand.id === brand.id).sort((a, b) => b.projectCount - a.projectCount || a.name.localeCompare(b.name))
  const [projects, dealers, locations] = await Promise.all([getBrandProjects(brand.id), getBrandDealers(brand.id, locale), getBrandLocations(brand.id)])
  const makes = brand.categoryIds.map((id) => tree.byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c))
  const facts = [
    brand.country,
    brand.foundedYear ? (nl ? `Sinds ${brand.foundedYear}` : `Since ${brand.foundedYear}`) : null,
  ].filter(Boolean)
  const website = brand.website ? brand.website.replace(/^https?:\/\//i, "").replace(/\/$/, "") : null

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="wrap" style={{ paddingTop: 120, paddingBottom: 80 }}>
        <nav aria-label="Breadcrumb" className="discover-breadcrumb" style={{ marginBottom: 32 }}>
          <Link href="/products" className="discover-breadcrumb-item">{nl ? "Producten" : "Products"}</Link>
          <span className="discover-breadcrumb-sep" aria-hidden="true"> › </span>
          <Link href="/brands" className="discover-breadcrumb-item">{nl ? "Merken" : "Brands"}</Link>
          <span className="discover-breadcrumb-sep" aria-hidden="true"> › </span>
          <span className="discover-breadcrumb-item discover-breadcrumb-current">{brand.name}</span>
        </nav>

        <section className="professional-header">
          <div className="company-icon">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={brand.name} className="company-icon-image" />
            ) : (
              <div className="company-icon-initials">{brand.name.charAt(0).toUpperCase()}</div>
            )}
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
          {brand.description && <p className="arco-body-text">{brand.description}</p>}
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
              <span className="arco-eyebrow">Series</span>
              <div className="arco-card-title">{series.length}</div>
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

        <section style={{ marginBottom: 60 }}>
          <div className="section-header">
            <h2 className="arco-section-title">Series</h2>
          </div>
          {series.length === 0 ? (
            <p className="arco-body-text" style={{ color: "#a1a1a0" }}>{nl ? "Nog geen series." : "No series yet."}</p>
          ) : (
            <div className="discover-grid">
              {series.map((s) => <SeriesCard key={s.id} series={s} locale={locale} showBrand={false} />)}
            </div>
          )}
        </section>

        {projects.length > 0 && (
          <section style={{ marginBottom: 60 }}>
            <div className="section-header">
              <h2 className="arco-section-title">{nl ? "Toegepast in projecten" : "Applied in projects"}</h2>
            </div>
            <div className="discover-grid">
              {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          </section>
        )}

        {/* Verkooppunten: de bedrijven die het merk voeren — dezelfde rijen
            die op hun eigen pagina onder "Merken" staan. */}
        {dealers.length > 0 && (
          <section style={{ marginBottom: 60 }}>
            <div className="section-header">
              <h2 className="arco-section-title">{nl ? "Verkooppunten" : "Where to buy"}</h2>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {dealers.map((d) => (
                <li key={d.companyId}>
                  <Link href={`/professionals/${d.slug}`} style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid #e5e5e4", borderRadius: 6, padding: 12, textDecoration: "none", color: "inherit" }}>
                    <div className="credit-icon" style={{ width: 56, height: 56, margin: 0, overflow: "hidden", flexShrink: 0 }}>
                      {d.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.logoUrl} alt={d.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span className="credit-icon-initials" style={{ fontSize: 20 }}>{d.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p className="arco-card-title" style={{ margin: 0, fontSize: 15 }}>{d.name}</p>
                      <p className="arco-card-subtitle" style={{ margin: "2px 0 0" }}>{[d.service, d.city].filter(Boolean).join(" · ")}</p>
                      {d.isOfficialDealer && <span className="arco-eyebrow" style={{ color: "var(--primary)", marginTop: 4, display: "inline-block" }}>{nl ? "Officieel dealer" : "Official dealer"}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Eigen showrooms van het merk (locations met brand_id). */}
        <ProfessionalLocations locations={locations} heading="Showrooms" inWrap={false} />
      </main>
      <Footer />
    </div>
  )
}
