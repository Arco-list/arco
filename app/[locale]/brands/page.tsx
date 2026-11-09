import type { Metadata } from "next"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Link } from "@/i18n/navigation"
import { requireProductsAdmin } from "@/lib/products-gate"
import { categoryLabel, categoryTree, getCatalogBrands, getCatalogCategories } from "@/lib/products/catalog"
import { BrandCard } from "@/components/catalog/catalog-cards"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Merken",
  robots: { index: false, follow: false },
}

/**
 * /brands — alle merken, gegroepeerd op hun eerste categorie (de primaire,
 * uit brand_categories); merken zonder categorie onderaan. Admin-only tot
 * de laag publiek gaat.
 */
export default async function BrandsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireProductsAdmin()
  const { locale } = await params
  const nl = locale === "nl"

  const [brands, categories] = await Promise.all([getCatalogBrands(), getCatalogCategories()])
  const tree = categoryTree(categories)

  const groups = new Map<string, typeof brands>()
  const loose: typeof brands = []
  for (const b of brands) {
    const root = b.categoryIds[0] ? tree.rootOf(b.categoryIds[0]) : undefined
    if (!root) { loose.push(b); continue }
    const list = groups.get(root.id) ?? []
    list.push(b)
    groups.set(root.id, list)
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="wrap" style={{ paddingTop: 120, paddingBottom: 80 }}>
        <nav aria-label="Breadcrumb" className="discover-breadcrumb" style={{ marginBottom: 24 }}>
          <Link href="/products" className="discover-breadcrumb-item">{nl ? "Producten" : "Products"}</Link>
          <span className="discover-breadcrumb-sep" aria-hidden="true"> › </span>
          <span className="discover-breadcrumb-item discover-breadcrumb-current">{nl ? "Merken" : "Brands"}</span>
        </nav>
        <div style={{ maxWidth: 720, marginBottom: 48 }}>
          <h1 className="arco-page-title" style={{ marginBottom: 12 }}>{nl ? "Merken" : "Brands"}</h1>
          <p className="arco-body-text">
            {nl
              ? `${brands.length} merken, met hun series en de projecten waarin ze zijn toegepast.`
              : `${brands.length} brands, with their series and the projects they appear in.`}
          </p>
        </div>

        {tree.roots.filter((r) => groups.has(r.id)).map((root) => (
          <section key={root.id} style={{ marginBottom: 48 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 16 }}>{categoryLabel(root, locale)}</h2>
            <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {groups.get(root.id)!.map((b) => <BrandCard key={b.id} brand={b} locale={locale} />)}
            </div>
          </section>
        ))}
        {loose.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 16 }}>{nl ? "Nog zonder categorie" : "Not yet categorised"}</h2>
            <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {loose.map((b) => <BrandCard key={b.id} brand={b} locale={locale} />)}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
