import type { Metadata } from "next"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { requireProductsAdmin } from "@/lib/products-gate"
import { getCatalogBrands, getCatalogCategories, getCatalogSeries } from "@/lib/products/catalog"
import { ProductsDiscoverClient } from "@/components/catalog/products-discover-client"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Producten",
  robots: { index: false, follow: false },
}

/**
 * /products — de productdiscover, in de vorm van /projects en
 * /professionals: filterbalk (merk, soort); zonder keuze een ingang
 * (titel, hoofdgroepen, merken, uitgelicht), met keuze de grid van
 * series. Admin-only tot de laag publiek gaat (requireProductsAdmin);
 * daarom geen index en de teksten nog inline in plaats van in messages/.
 */
export default async function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireProductsAdmin()
  const { locale } = await params
  const [categories, series, brands] = await Promise.all([getCatalogCategories(), getCatalogSeries(), getCatalogBrands()])

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main style={{ paddingBottom: 40 }}>
        <ProductsDiscoverClient locale={locale} series={series} brands={brands} categories={categories} />
      </main>
      <Footer />
    </div>
  )
}
