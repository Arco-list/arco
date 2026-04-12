import { notFound } from "next/navigation"
import Link from "next/link"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { requireProductsAdmin } from "@/lib/products-gate"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const dynamic = "force-dynamic"

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  // Phase 1: admin-only.
  await requireProductsAdmin()

  const { slug } = await params
  const supabase = createServiceRoleSupabaseClient()

  const { data: product } = await supabase
    .from("products")
    .select(`
      *,
      brand:brands(id, name, slug, status, logo_url, country),
      family:product_families(id, name, slug),
      category:product_categories(id, name, slug),
      product_photos(id, url, alt_text, is_primary, order_index)
    `)
    .eq("slug", slug)
    .maybeSingle()

  if (!product) notFound()
  const p = product as any
  // Phase 1: admin-only, show all statuses. Phase 4: gate by status.

  const photos = (p.product_photos ?? []).sort((a: any, b: any) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return (a.order_index ?? 0) - (b.order_index ?? 0)
  })

  // Sibling products in the same family
  let familySiblings: any[] = []
  if (p.family?.id) {
    const { data } = await supabase
      .from("products")
      .select("id, slug, name, product_photos(url, is_primary)")
      .eq("family_id", p.family.id)
      .neq("id", p.id)
      .eq("status", "listed")
      .limit(6)
    familySiblings = (data ?? []).map((s: any) => {
      const photos = s.product_photos ?? []
      const primary = photos.find((ph: any) => ph.is_primary) ?? photos[0]
      return { ...s, imageUrl: primary?.url ?? null }
    })
  }

  // Other products by the same brand
  let brandSiblings: any[] = []
  if (p.brand?.id) {
    const { data } = await supabase
      .from("products")
      .select("id, slug, name, product_photos(url, is_primary)")
      .eq("brand_id", p.brand.id)
      .neq("id", p.id)
      .eq("status", "listed")
      .limit(6)
    brandSiblings = (data ?? []).map((s: any) => {
      const photos = s.product_photos ?? []
      const primary = photos.find((ph: any) => ph.is_primary) ?? photos[0]
      return { ...s, imageUrl: primary?.url ?? null }
    })
  }

  const specs = p.specs as Record<string, any> | null

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="wrap" style={{ paddingTop: 60, paddingBottom: 80, maxWidth: 1200 }}>
        {/* Breadcrumb */}
        <div className="arco-eyebrow" style={{ marginBottom: 16 }}>
          <Link href="/products">Products</Link>
          {p.category && <> · {p.category.name}</>}
          {p.brand && <> · <Link href={`/brands/${p.brand.slug}`}>{p.brand.name}</Link></>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 60, alignItems: "start" }}>
          {/* Photos */}
          <div>
            {photos[0] ? (
              <img src={photos[0].url} alt={p.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 4 }} />
            ) : (
              <div style={{ width: "100%", aspectRatio: "1", background: "var(--arco-surface)", borderRadius: 4 }} />
            )}
            {photos.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 8 }}>
                {photos.slice(1, 9).map((ph: any) => (
                  <img key={ph.id} src={ph.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 3 }} />
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {p.brand && (
              <Link href={`/brands/${p.brand.slug}`} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                {p.brand.logo_url && (
                  <img src={p.brand.logo_url} alt={p.brand.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                )}
                <span className="arco-small-text" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{p.brand.name}</span>
              </Link>
            )}
            <h1 className="arco-page-title">{p.name}</h1>

            {p.description && (
              <p className="arco-body-text" style={{ marginTop: 20 }}>{p.description}</p>
            )}

            {specs && Object.keys(specs).length > 0 && (
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--rule)" }}>
                <h4 className="arco-label" style={{ marginBottom: 16 }}>Specifications</h4>
                <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 32px" }}>
                  {Object.entries(specs).map(([key, value]) => (
                    <div key={key} style={{ display: "contents" }}>
                      <dt className="arco-small-text" style={{ color: "var(--text-disabled)", textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</dt>
                      <dd className="arco-small-text" style={{ color: "var(--text-primary)" }}>{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        {/* Family siblings */}
        {familySiblings.length > 0 && (
          <section style={{ marginTop: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>
              {p.family ? `More from ${p.family.name}` : "Related products"}
            </h2>
            <div className="discover-grid">
              {familySiblings.map((sibling) => (
                <Link key={sibling.id} href={`/products/${sibling.slug}`} className="discover-card">
                  <div className="discover-card-image-wrap">
                    {sibling.imageUrl && (
                      <div className="discover-card-image-layer">
                        <img src={sibling.imageUrl} alt={sibling.name} />
                      </div>
                    )}
                  </div>
                  <h3 className="discover-card-title">{sibling.name}</h3>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Other products by brand */}
        {brandSiblings.length > 0 && (
          <section style={{ marginTop: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>
              More by {p.brand?.name}
            </h2>
            <div className="discover-grid">
              {brandSiblings.map((sibling) => (
                <Link key={sibling.id} href={`/products/${sibling.slug}`} className="discover-card">
                  <div className="discover-card-image-wrap">
                    {sibling.imageUrl && (
                      <div className="discover-card-image-layer">
                        <img src={sibling.imageUrl} alt={sibling.name} />
                      </div>
                    )}
                  </div>
                  <h3 className="discover-card-title">{sibling.name}</h3>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <Footer />
    </div>
  )
}
