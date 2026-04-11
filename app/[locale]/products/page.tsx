import Link from "next/link"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { requireProductsAdmin } from "@/lib/products-gate"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const dynamic = "force-dynamic"

export default async function ProductsDiscoverPage() {
  // Phase 1: admin-only. Remove this when Phase 4 ships.
  await requireProductsAdmin()

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: products } = await supabase
    .from("products")
    .select(`
      id, slug, name, description,
      brand:brands!inner(id, name, slug, status),
      product_photos(url, is_primary, order_index)
    `)
    .eq("status", "listed")
    .order("created_at", { ascending: false })
    .limit(60)

  // Filter on the joined brand status in JS (Supabase REST doesn't support
  // .in() against joined columns reliably).
  const items = (products ?? [])
    .filter((p: any) => p.brand && ["listed", "unlisted"].includes(p.brand.status))
    .map((p: any) => {
    const photos = (p.product_photos ?? []) as { url: string; is_primary: boolean; order_index: number }[]
    const primary = photos.find((ph) => ph.is_primary) ?? photos.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0]
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      brand: p.brand,
      imageUrl: primary?.url ?? null,
    }
  })

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="discover-page-title">
        <div className="wrap">
          <p className="arco-eyebrow">Products · Nederland</p>
          <h1 className="arco-page-title" style={{ marginTop: 8 }}>Discover products</h1>
          <p className="arco-body-text" style={{ marginTop: 12, maxWidth: 600 }}>
            High-end interior products from curated brands. See how architects apply them in real projects, and find where to buy them.
          </p>
        </div>
      </div>

      <div className="discover-results">
        <div className="wrap">
          {items.length === 0 ? (
            <div className="empty-state">
              <h2 className="arco-section-title empty-state__title">No products yet</h2>
              <p className="arco-body-text empty-state__description">Scrape brands and products in /admin/brands to populate the catalog.</p>
            </div>
          ) : (
            <>
              <div className="discover-results-meta">
                <p className="discover-results-count">
                  <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{items.length}</strong> products
                </p>
              </div>
              <div className="discover-grid">
                {items.map((product: any) => (
                  <Link key={product.id} href={`/products/${product.slug}`} className="discover-card">
                    <div className="discover-card-image-wrap">
                      {product.imageUrl ? (
                        <div className="discover-card-image-layer">
                          <img src={product.imageUrl} alt={product.name} />
                        </div>
                      ) : (
                        <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                      )}
                    </div>
                    <h3 className="discover-card-title">{product.name}</h3>
                    <p className="discover-card-sub">{product.brand?.name ?? ""}</p>
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
