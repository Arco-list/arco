import type { Metadata } from "next"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { requireProductsAdmin } from "@/lib/products-gate"
import { activeCategories, getCatalogBrands, getCatalogCategories, getCatalogCollections } from "@/lib/products/catalog"
import { ProductsDiscoverClient } from "@/components/catalog/products-discover-client"

export const dynamic = "force-dynamic"

// Zelfde titel als de kop van de pagina. Nog niet indexeren: de laag is
// admin-only (requireProductsAdmin).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === "nl" ? "Designmerken in architectuurprojecten" : "Design brands in architecture projects",
    robots: { index: false, follow: false },
  }
}

/**
 * /products — de productdiscover, in de vorm van /projects en
 * /professionals: filterbalk (merk, soort); zonder keuze een ingang
 * (titel, hoofdgroepen, merken, uitgelicht), met keuze de grid van
 * collecties. Admin-only tot de laag publiek gaat (requireProductsAdmin);
 * daarom geen index en de teksten nog inline in plaats van in messages/.
 */
export default async function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireProductsAdmin()
  const { locale } = await params
  const [categories, collection, brands] = await Promise.all([getCatalogCategories(), getCatalogCollections(), getCatalogBrands()])

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main style={{ paddingBottom: 40 }}>
        <ProductsDiscoverClient locale={locale} collection={collection} brands={brands} categories={activeCategories(categories)} />
      </main>
      <Footer />
    </div>
  )
}
