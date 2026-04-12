import { notFound } from "next/navigation"
import Link from "next/link"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { requireProductsAdmin } from "@/lib/products-gate"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const dynamic = "force-dynamic"

export default async function BrandDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  // Phase 1: admin-only.
  await requireProductsAdmin()

  const { slug } = await params
  const supabase = createServiceRoleSupabaseClient()

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .maybeSingle()

  if (!brand) notFound()
  const b = brand as any
  // Hide unlisted from non-admin in the future. For now, admin-gated already.
  // Phase 1: admin-only, show all statuses. Phase 4: gate by status.

  // Brand's products
  const { data: products } = await supabase
    .from("products")
    .select("id, slug, name, description, status, product_photos(url, is_primary, order_index)")
    .eq("brand_id", b.id)
    .order("created_at", { ascending: false })

  const items = (products ?? []).map((p: any) => {
    const photos = (p.product_photos ?? []) as { url: string; is_primary: boolean; order_index: number }[]
    const primary = photos.find((ph) => ph.is_primary) ?? photos.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0]
    return { ...p, imageUrl: primary?.url ?? null }
  })

  // Brand's product families
  const { data: families } = await supabase
    .from("product_families")
    .select("id, slug, name")
    .eq("brand_id", b.id)
    .order("name")

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="wrap" style={{ paddingTop: 60, paddingBottom: 80 }}>
        {/* Hero */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 32, marginBottom: 60 }}>
          {b.logo_url ? (
            <img src={b.logo_url} alt={b.name} style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--arco-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: "var(--text-secondary)", flexShrink: 0 }}>
              {b.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {b.country && <p className="arco-eyebrow">{b.country}{b.founded_year ? ` · Est. ${b.founded_year}` : ""}</p>}
            <h1 className="arco-page-title" style={{ marginTop: 8 }}>{b.name}</h1>
            {b.description && (
              <p className="arco-body-text" style={{ marginTop: 16, maxWidth: 720 }}>
                {b.description}
              </p>
            )}
            {b.website && (
              <a href={b.website} target="_blank" rel="noopener noreferrer" className="view-all-link" style={{ marginTop: 16, display: "inline-block" }}>
                Visit website →
              </a>
            )}
          </div>
        </div>

        {/* Families (if any) */}
        {(families?.length ?? 0) > 0 && (
          <section style={{ marginBottom: 60 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Collections</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {(families ?? []).map((f: any) => (
                <span key={f.id} className="status-pill">{f.name}</span>
              ))}
            </div>
          </section>
        )}

        {/* Products grid */}
        <section>
          <h2 className="arco-section-title" style={{ marginBottom: 24 }}>
            Products ({items.length})
          </h2>
          {items.length === 0 ? (
            <div className="empty-state">
              <h2 className="arco-section-title empty-state__title">No products yet</h2>
              <p className="arco-body-text empty-state__description">This brand doesn't have any listed products yet.</p>
            </div>
          ) : (
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
                  {product.description && <p className="discover-card-sub">{product.description}</p>}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <Footer />
    </div>
  )
}
