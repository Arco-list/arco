import Link from "next/link"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { requireProductsAdmin } from "@/lib/products-gate"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const dynamic = "force-dynamic"

export default async function BrandsDiscoverPage() {
  await requireProductsAdmin()

  const supabase = createServiceRoleSupabaseClient()

  const { data: brands } = await supabase
    .from("brands")
    .select("id, slug, name, logo_url, country, description, status")
    .order("name")

  const items = (brands ?? []) as any[]

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="discover-page-title">
        <div className="wrap">
          <p className="arco-eyebrow">Brands</p>
          <h1 className="arco-page-title" style={{ marginTop: 8 }}>Discover brands</h1>
        </div>
      </div>

      <div className="discover-results">
        <div className="wrap">
          {items.length === 0 ? (
            <div className="empty-state">
              <h2 className="arco-section-title empty-state__title">No brands yet</h2>
              <p className="arco-body-text empty-state__description">Scrape brands in /admin/brands to populate the directory.</p>
            </div>
          ) : (
            <>
              <div className="discover-results-meta">
                <p className="discover-results-count">
                  <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{items.length}</strong> brands
                </p>
              </div>
              <div className="discover-grid">
                {items.map((brand: any) => (
                  <Link key={brand.id} href={`/brands/${brand.slug}`} className="discover-card">
                    <div className="discover-card-image-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--arco-surface)" }}>
                      {brand.logo_url ? (
                        <img src={brand.logo_url} alt={brand.name} style={{ maxWidth: "60%", maxHeight: "60%", objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: 48, color: "var(--text-disabled)" }}>{brand.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <h3 className="discover-card-title">{brand.name}</h3>
                    <p className="discover-card-sub">{brand.country ?? ""}</p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
