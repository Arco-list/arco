import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { requireProductsAdmin } from "@/lib/products-gate"
import { activeCategories, categoryLabel, getCatalogBrands, getCatalogCategories, getCatalogCollections } from "@/lib/products/catalog"
import { ProductsDiscoverClient } from "@/components/catalog/products-discover-client"

export const dynamic = "force-dynamic"

type Params = Promise<{ locale: string; category: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, category } = await params
  const categories = await getCatalogCategories()
  const c = categories.find((x) => x.slug === category)
  return { title: c ? categoryLabel(c, locale) : "Producten", robots: { index: false, follow: false } }
}

/**
 * /products/[soort] — de discover met de soort vast: een hoofdgroep
 * (Verlichting) toont alles eronder, een soort (Hanglampen) zichzelf en
 * haar kinderen; het merk blijft te filteren. Admin-only tot de laag
 * publiek gaat.
 */
export default async function ProductCategoryPage({ params }: { params: Params }) {
  await requireProductsAdmin()
  const { locale, category: slug } = await params
  const [allCategories, collection, brands] = await Promise.all([getCatalogCategories(), getCatalogCollections(), getCatalogBrands()])
  // Een inactieve soort heeft geen pagina.
  const categories = activeCategories(allCategories)
  const category = categories.find((c) => c.slug === slug)
  if (!category) notFound()

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main style={{ paddingBottom: 80 }}>
        <ProductsDiscoverClient locale={locale} collection={collection} brands={brands} categories={categories} fixedKind={category} />
      </main>
      <Footer />
    </div>
  )
}
