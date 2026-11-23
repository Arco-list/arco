import type { Metadata } from "next"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LocationCards, type LocationOwner } from "@/components/locations/location-cards"
import { requireProductsAdmin } from "@/lib/products-gate"
import { getAllShowrooms } from "@/lib/products/catalog"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Showrooms",
  robots: { index: false, follow: false },
}

/**
 * /showrooms — alle showrooms van bedrijven en merken op één pagina, in
 * dezelfde kaart als op de bedrijfspagina (foto, naam, eigenaar · plaats);
 * een klik opent adres, openingstijden en een link naar het bedrijf of
 * merk. Admin-only, zoals merken en producten.
 */
export default async function ShowroomsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireProductsAdmin()
  const { locale } = await params
  const nl = locale === "nl"
  const showrooms = await getAllShowrooms()
  const owners: Record<string, LocationOwner> = Object.fromEntries(showrooms.map((s) => [s.location.id, s.owner]))

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="wrap" style={{ paddingTop: 120, paddingBottom: 80 }}>
        <section style={{ marginBottom: 40 }}>
          <h1 className="arco-page-title">Showrooms</h1>
          <p className="arco-body-text" style={{ marginTop: 12 }}>
            {nl
              ? "Plekken waar je langs kunt om materialen, meubels en verlichting in het echt te zien."
              : "Places to visit and see materials, furniture and lighting in person."}
          </p>
        </section>
        {showrooms.length === 0 ? (
          <p className="arco-body-text" style={{ color: "#a1a1a0" }}>{nl ? "Nog geen showrooms." : "No showrooms yet."}</p>
        ) : (
          <LocationCards mode="public" locations={showrooms.map((s) => s.location)} owners={owners} locale={locale} />
        )}
      </main>
      <Footer />
    </div>
  )
}
