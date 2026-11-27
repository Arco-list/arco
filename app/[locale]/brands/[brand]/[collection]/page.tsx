import type { Metadata } from "next"
import { CollectionProducts } from "@/components/catalog/collection-products"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Link } from "@/i18n/navigation"
import { requireProductsAdmin } from "@/lib/products-gate"
import { activeCategories, categoryLabel, categoryTree, collectionKindsLabel, getCatalogCategories, getCatalogCollections, getCollectionPhotos, getCollectionProducts, getCollectionProjects } from "@/lib/products/catalog"
import { ProjectCard, CollectionCard } from "@/components/catalog/catalog-cards"
import { CollectionHero } from "@/components/catalog/collection-hero"
import { isCutoutPhoto, pickCollectionHero } from "@/lib/products/collection-hero"
import { BrandLogo } from "@/components/brand/brand-logo"
import { BrandSubNav } from "@/components/brand/brand-sub-nav"

export const dynamic = "force-dynamic"

type Params = Promise<{ locale: string; brand: string; collection: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { brand, collection } = await params
  const s = (await getCatalogCollections()).find((x) => x.brand.slug === brand && x.slug === collection)
  return { title: s ? `${s.name} — ${s.brand.name}` : "Collectie", robots: { index: false, follow: false } }
}

/**
 * /brands/[merk]/[collectie] — de collectie zoals een bezoeker haar ziet, in de
 * vorm van een project: een groot beeld over de volle breedte, dan logo,
 * naam, merk en omschrijving, de feiten, de producten, de projecten waarin
 * ze is toegepast en de foto's, met dezelfde subnavigatie als de merkpagina.
 * Admin-only tot de laag publiek gaat.
 */
export default async function CollectionPage({ params }: { params: Params }) {
  await requireProductsAdmin()
  const { locale, brand: brandSlug, collection: collectionSlug } = await params
  const nl = locale === "nl"

  const [allCollections, categories] = await Promise.all([getCatalogCollections(), getCatalogCategories()])
  const collection = allCollections.find((s) => s.brand.slug === brandSlug && s.slug === collectionSlug)
  if (!collection) notFound()
  // Alleen actieve categorieën: geparkeerde (migratie 351) niet als label of link.
  const tree = categoryTree(activeCategories(categories))
  const [photos, projects, products] = await Promise.all([getCollectionPhotos(collection.id), getCollectionProjects(collection.id, { includeInReview: true }), getCollectionProducts(collection.id)])
  const cover = photos.find((p) => p.isPrimary) ?? photos[0] ?? null
  const category = collection.categoryId ? tree.byId.get(collection.categoryId) : undefined
  const siblings = allCollections.filter((s) => s.brand.id === collection.brand.id && s.id !== collection.id).slice(0, 6)
  const facts: Array<{ label: string; value: ReactNode }> = []
  facts.push({ label: nl ? "Merk" : "Brand", value: <Link href={`/brands/${collection.brand.slug}`} className="text-link-plain">{collection.brand.name}</Link> })
  if (collection.designer) facts.push({ label: "Designer", value: collection.designer })
  if (collection.launchYear) facts.push({ label: nl ? "Sinds" : "Since", value: collection.launchYear })
  // Alle soorten van de collectie als links naar hun soortpagina; zonder eigen
  // soorten de ene soort of groep waaronder ze hangt.
  const kinds = collection.kindIds.map((id) => tree.byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c))
  const shownKinds = kinds.length > 0 ? kinds : category ? [category] : []

  if (projects.length > 0) facts.push({ label: nl ? "In projecten" : "In projects", value: projects.length })
  // Laatste cel: rechtstreeks naar de collectie op de site van het merk,
  // zoals de website bij een bedrijf (domein + pijl).
  if (collection.url) {
    let host: string | null = null
    try { host = new URL(collection.url).hostname.replace(/^www\./, "") } catch { host = null }
    if (host) facts.push({
      label: nl ? "Bij het merk" : "At the brand",
      value: (
        <a href={collection.url} target="_blank" rel="noopener noreferrer" className="text-link-plain" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {host} →
        </a>
      ),
    })
  }

  // Het hoofdbeeld volgt dezelfde regel als de bewerkpagina; de galerij
  // toont de rest.
  const heroPhoto = pickCollectionHero(photos)
  // Foto's: alles, behalve een beeld dat al als producttegel staan (zelfde
  // bron of zelfde bestand). De hero vooraan (bovenaan is hij bijgesneden,
  // hier staat hij heel), dan sfeer, ongesorteerd, detail en productfoto's.
  const usedByProducts = new Set(products.flatMap((p) => [p.imageUrl, p.sourceImageUrl]).filter((u): u is string => Boolean(u)))
  const KIND_ORDER: Record<string, number> = { ambiance: 0, none: 1, detail: 2, product: 3 }
  const gallery = photos
    .filter((p) => p.id === heroPhoto?.id || !(usedByProducts.has(p.url) || (p.sourceUrl != null && usedByProducts.has(p.sourceUrl))))
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      if (a.p.id === heroPhoto?.id) return -1
      if (b.p.id === heroPhoto?.id) return 1
      return (KIND_ORDER[a.p.kind ?? "none"] ?? 1) - (KIND_ORDER[b.p.kind ?? "none"] ?? 1) || a.i - b.i
    })
    .map(({ p }) => p)

  // De producten van de collectie, met een link naar hun pagina bij het
  // merk. Zelfde tegels als op collection edit: het raster van de foto's
  // (280px, 4:3), naam en eronder klein de Arco-categorie.
  const productsSection = products.length > 0 && (
    <section id="products" style={{ marginBottom: 60 }}>
      <div className="section-header">
        <h2 className="arco-section-title">{nl ? "Producten" : "Products"}</h2>
      </div>
      <CollectionProducts
        brandName={collection.brand.name}
        locale={locale}
        products={products.map((p) => {
          const cat = p.categoryId ? tree.byId.get(p.categoryId) : undefined
          return { id: p.id, name: p.name, url: p.url, imageUrl: p.imageUrl, category: cat ? categoryLabel(cat, locale) : null }
        })}
      />
    </section>
  )

  const projectsSection = (
    <section id="projects" style={{ marginBottom: 60 }}>
      <div className="section-header">
        <h2 className="arco-section-title">{nl ? "Projecten" : "Projects"}</h2>
      </div>
      {projects.length === 0 ? (
        <p className="arco-body-text" style={{ color: "#a1a1a0" }}>{nl ? "Nog niet in een gepubliceerd project getagd." : "Not tagged in a published project yet."}</p>
      ) : (
        <div className="discover-grid">
          {projects.map((p) => <ProjectCard key={p.id} project={p} locale={locale} />)}
        </div>
      )}
    </section>
  )
  const gallerySection = gallery.length > 0 && (
    <section id="photos" style={{ marginBottom: 60 }}>
      <div className="section-header">
        <h2 className="arco-section-title">{nl ? "Foto's" : "Photos"}</h2>
      </div>
      <div className="product-gallery">
        {gallery.map((p, i) => (
          <div key={p.id} className="product-gallery-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.alt ?? collection.name} className="product-gallery-img" loading={i === 0 ? "eager" : "lazy"} />
          </div>
        ))}
      </div>
    </section>
  )

  // De subnavigatie, in de volgorde van de pagina: Projecten staat altijd
  // in de balk (ook zonder projecten leidt de link naar de lege melding),
  // en volgt de sectie: eerst zodra er projecten zijn, anders na de foto's.
  const projectsLink = { id: "projects", label: nl ? "Projecten" : "Projects" }
  const photosLink = gallery.length > 0 ? [{ id: "photos", label: nl ? "Foto's" : "Photos" }] : []
  const sections = [
    { id: "details", label: "Details" },
    ...(products.length > 0 ? [{ id: "products", label: nl ? "Producten" : "Products" }] : []),
    // Niet in een project getagd: geen sectie en geen link.
    ...(projects.length > 0 ? [projectsLink, ...photosLink] : photosLink),
  ]

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <BrandSubNav
        sections={sections}
        backLabel={collection.brand.name}
        backHref={`/brands/${collection.brand.slug}`}
        shareLabel={nl ? "Delen" : "Share"}
        copiedLabel={nl ? "Link gekopieerd" : "Link copied"}
        shareTitle={`${collection.name} — ${collection.brand.name}`}
      />
      <main className="wrap" style={{ paddingTop: 120, paddingBottom: 80 }}>
        {/* Het beeld 4:3 links, logo, naam, soort en tekst rechts (desktop);
            op kleinere schermen onder elkaar, gecentreerd. Zonder beeld de
            gecentreerde kop. */}
        <section id="details" className={heroPhoto ? "collection-intro" : undefined}>
          {heroPhoto && <CollectionHero layout="intro" src={heroPhoto.url} alt={heroPhoto.alt ?? collection.name} cutout={isCutoutPhoto(heroPhoto)} focus={heroPhoto.focus} />}
          <div className="professional-header">
            <Link href={`/brands/${collection.brand.slug}`} className="company-icon" aria-label={collection.brand.name} style={{ textDecoration: "none" }}>
              <BrandLogo logoUrl={collection.brand.logoUrl} name={collection.brand.name} />
            </Link>
            <h1 className="arco-page-title">{collection.name}</h1>
            {/* Onder de naam: wat de collectie maakt (Fauteuils · Banken · Ligbedden),
                elk een link naar de soortpagina. Zonder soorten het merk. */}
            <p className="professional-badge">
              {shownKinds.length > 0
                ? shownKinds.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && " · "}
                      <Link href={`/products/${c.slug}`} className="hover:text-primary transition-colors">{categoryLabel(c, locale)}</Link>
                    </span>
                  ))
                : <Link href={`/brands/${collection.brand.slug}`} className="hover:text-primary transition-colors">{collection.brand.name}</Link>}
            </p>
            {/* In de taal van de pagina (migratie 330), anders de Engelse bron. */}
            {((nl && collection.descriptionNl) || collection.description)?.split("\n\n").map((para, i) => <p key={i} className="arco-body-text">{para}</p>)}
          </div>
        </section>

        <section className="specifications-bar" style={{ marginBottom: 60 }}>
          {facts.map((f) => (
            <div key={f.label} className="spec-item">
              <span className="arco-eyebrow">{f.label}</span>
              <div className="arco-card-title">{f.value}</div>
            </div>
          ))}
        </section>

        {/* Wat deze pagina van een merksite onderscheidt: waar de collectie in
            echte projecten is toegepast. Dus hoog, zodra er projecten zijn;
            zonder projecten volgt de foto's en sluit de lege melding af. */}
        {productsSection}
        {projects.length > 0 && projectsSection}
        {gallerySection}

        {siblings.length > 0 && (
          <section style={{ marginBottom: 60 }}>
            <div className="section-header">
              <h2 className="arco-section-title">{nl ? `Meer van ${collection.brand.name}` : `More from ${collection.brand.name}`}</h2>
              <Link href={`/brands/${collection.brand.slug}`} className="view-all-link">
                <span className="arco-text-link-label">{nl ? "Alle collecties" : "All collections"}</span>
                <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="discover-grid">
              {siblings.map((s) => <CollectionCard key={s.id} collection={s} locale={locale} showBrand={false} kind={collectionKindsLabel(s, tree.byId, locale)} />)}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
