import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Link } from "@/i18n/navigation"
import { requireProductsAdmin } from "@/lib/products-gate"
import { categoryLabel, categoryTree, getCatalogCategories, getCatalogSeries, getSeriesPhotos, getSeriesProjects } from "@/lib/products/catalog"
import { ProjectCard, SeriesCard } from "@/components/catalog/catalog-cards"

export const dynamic = "force-dynamic"

type Params = Promise<{ locale: string; brand: string; series: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { brand, series } = await params
  const s = (await getCatalogSeries()).find((x) => x.brand.slug === brand && x.slug === series)
  return { title: s ? `${s.name} — ${s.brand.name}` : "Serie", robots: { index: false, follow: false } }
}

/**
 * /brands/[merk]/[serie] — de serie zoals een bezoeker haar ziet, in de
 * vorm van de oude productpagina: beeld links, naam en merk rechts, de
 * feiten eronder, de foto's, en de projecten waarin ze is toegepast.
 * Admin-only tot de laag publiek gaat.
 */
export default async function SeriesPage({ params }: { params: Params }) {
  await requireProductsAdmin()
  const { locale, brand: brandSlug, series: seriesSlug } = await params
  const nl = locale === "nl"

  const [allSeries, categories] = await Promise.all([getCatalogSeries(), getCatalogCategories()])
  const series = allSeries.find((s) => s.brand.slug === brandSlug && s.slug === seriesSlug)
  if (!series) notFound()
  const tree = categoryTree(categories)
  const [photos, projects] = await Promise.all([getSeriesPhotos(series.id), getSeriesProjects(series.id)])
  const cover = photos.find((p) => p.isPrimary) ?? photos[0] ?? null
  const gallery = photos.filter((p) => p.id !== cover?.id)
  const category = series.categoryId ? tree.byId.get(series.categoryId) : undefined
  const siblings = allSeries.filter((s) => s.brand.id === series.brand.id && s.id !== series.id).slice(0, 6)
  const facts: Array<{ label: string; value: ReactNode }> = []
  if (series.designer) facts.push({ label: "Designer", value: series.designer })
  if (series.launchYear) facts.push({ label: nl ? "Sinds" : "Since", value: series.launchYear })
  if (category) facts.push({ label: nl ? "Soort" : "Kind", value: <Link href={`/products/${category.slug}`} className="text-link-plain">{categoryLabel(category, locale)}</Link> })
  facts.push({ label: nl ? "In projecten" : "In projects", value: projects.length })
  if (series.url) facts.push({ label: nl ? "Bij het merk" : "At the brand", value: <a href={series.url} target="_blank" rel="noopener noreferrer" className="text-link-plain">{series.brand.name} →</a> })

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="wrap" style={{ paddingTop: 120, paddingBottom: 80 }}>
        <nav aria-label="Breadcrumb" className="discover-breadcrumb" style={{ marginBottom: 32 }}>
          <Link href="/products" className="discover-breadcrumb-item">{nl ? "Producten" : "Products"}</Link>
          <span className="discover-breadcrumb-sep" aria-hidden="true"> › </span>
          <Link href={`/brands/${series.brand.slug}`} className="discover-breadcrumb-item">{series.brand.name}</Link>
          <span className="discover-breadcrumb-sep" aria-hidden="true"> › </span>
          <span className="discover-breadcrumb-item discover-breadcrumb-current">{series.name}</span>
        </nav>

        <div className="product-hero">
          <div className="product-hero-image">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.url} alt={cover.alt ?? series.name} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "var(--arco-surface)" }} />
            )}
          </div>
          <div className="product-hero-info">
            <Link href={`/brands/${series.brand.slug}`} style={{ display: "block", marginBottom: 24, textDecoration: "none", color: "inherit" }}>
              <div className="company-icon" style={{ justifyContent: "flex-start", marginBottom: 0 }}>
                {series.brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={series.brand.logoUrl} alt={series.brand.name} className="company-icon-image" />
                ) : (
                  <div className="company-icon-initials">{series.brand.name.charAt(0).toUpperCase()}</div>
                )}
              </div>
            </Link>
            <h1 className="arco-page-title" style={{ marginBottom: 0 }}>{series.name}</h1>
            <p className="professional-badge" style={{ marginTop: 8 }}>{series.brand.name}</p>
            {series.description && (
              <div style={{ marginTop: 20 }}>
                {series.description.split("\n\n").map((para, i) => <p key={i} className="arco-body-text">{para}</p>)}
              </div>
            )}
          </div>
        </div>

        <section className="specifications-bar" style={{ marginBottom: 60 }}>
          {facts.map((f) => (
            <div key={f.label} className="spec-item">
              <span className="arco-eyebrow">{f.label}</span>
              <div className="arco-card-title">{f.value}</div>
            </div>
          ))}
        </section>

        {gallery.length > 0 && (
          <section style={{ marginBottom: 60 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>{nl ? "Foto's" : "Photos"}</h2>
            <div className="product-gallery">
              {gallery.map((p, i) => (
                <div key={p.id} className="product-gallery-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.alt ?? series.name} className="product-gallery-img" loading={i === 0 ? "eager" : "lazy"} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={{ marginBottom: 60 }}>
          <div className="section-header">
            <h2 className="arco-section-title">{nl ? "Toegepast in projecten" : "Applied in projects"}</h2>
          </div>
          {projects.length === 0 ? (
            <p className="arco-body-text" style={{ color: "#a1a1a0" }}>{nl ? "Nog niet in een gepubliceerd project getagd." : "Not tagged in a published project yet."}</p>
          ) : (
            <div className="discover-grid">
              {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          )}
        </section>

        {siblings.length > 0 && (
          <section style={{ marginBottom: 60 }}>
            <div className="section-header">
              <h2 className="arco-section-title">{nl ? `Meer van ${series.brand.name}` : `More from ${series.brand.name}`}</h2>
              <Link href={`/brands/${series.brand.slug}`} className="view-all-link">
                <span className="arco-text-link-label">{nl ? "Alle series" : "All series"}</span>
                <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="discover-grid">
              {siblings.map((s) => <SeriesCard key={s.id} series={s} locale={locale} showBrand={false} />)}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
