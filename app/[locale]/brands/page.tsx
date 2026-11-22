import type { Metadata } from "next"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { requireProductsAdmin } from "@/lib/products-gate"
import { activeCategories, getCatalogBrands, getCatalogCategories } from "@/lib/products/catalog"
import { BrandsDiscoverClient } from "@/components/catalog/brands-discover-client"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Merken",
  robots: { index: false, follow: false },
}

/**
 * /brands — alle merken als discover, in de vorm van /products: filter-
 * balk, kruimelpad (Producten › groep › subgroep › Merken), teller met
 * sortering en een grid van disc tiles. Admin-only tot de laag publiek
 * gaat.
 */
export default async function BrandsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireProductsAdmin()
  const { locale } = await params
  const [brands, categories] = await Promise.all([getCatalogBrands(), getCatalogCategories()])

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main style={{ paddingBottom: 80 }}>
        <BrandsDiscoverClient locale={locale} brands={brands} categories={activeCategories(categories)} />
      </main>
      <Footer />
    </div>
  )
}
