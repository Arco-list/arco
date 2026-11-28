import type { Metadata } from "next"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { requireProductsAdmin } from "@/lib/products-gate"
import { activeCategories, getCatalogBrands, getCatalogCategories, getCatalogCollections } from "@/lib/products/catalog"
import { BrandsDiscoverClient } from "@/components/catalog/brands-discover-client"
import { brandCardImages } from "@/lib/products/brand-card-image"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Merken",
  robots: { index: false, follow: false },
}

/**
 * /brands — alle merken als discover, in de vorm van /products: filter-
 * balk, kruimelpad (Producten › groep › subgroep › Merken), teller met
 * sortering en een grid van staande merkkaarten (zoals de carrousel op
 * /products). Alleen merken met een catalogus: Catalogued en verder
 * (Showcased, Listed). Admin-only tot de laag publiek gaat.
 */
const BRAND_PAGE_STATUSES = new Set(["catalogued", "prospected", "listed"])
export default async function BrandsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireProductsAdmin()
  const { locale } = await params
  const [allBrands, categories, collections] = await Promise.all([getCatalogBrands(), getCatalogCategories(), getCatalogCollections()])
  const brands = allBrands.filter((b) => BRAND_PAGE_STATUSES.has(b.status))
  // Het beeld van de kaart: een staande sfeerfoto, anders de hero op zijn
  // focuspunt (lib/products/brand-card-image).
  const imageByBrand = await brandCardImages(collections)

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main style={{ paddingBottom: 80 }}>
        <BrandsDiscoverClient locale={locale} brands={brands} categories={activeCategories(categories)} imageByBrand={imageByBrand} />
      </main>
      <Footer />
    </div>
  )
}
