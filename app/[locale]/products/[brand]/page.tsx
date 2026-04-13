import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { requireProductsAdmin } from "@/lib/products-gate"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const dynamic = "force-dynamic"

export default async function BrandProductsPage({ params }: { params: Promise<{ brand: string }> }) {
  await requireProductsAdmin()

  const { brand: brandSlug } = await params
  const supabase = createServiceRoleSupabaseClient()

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", brandSlug)
    .maybeSingle()

  if (!brand) notFound()
  const b = brand as any

  // Brand's products with photos
  const { data: products } = await supabase
    .from("products")
    .select(`
      id, slug, name, description, status,
      category:product_categories(name),
      family:product_families(id, name, slug),
      product_photos(url, is_primary, order_index)
    `)
    .eq("brand_id", b.id)
    .order("created_at", { ascending: false })

  const items = (products ?? []).map((p: any) => {
    const photos = (p.product_photos ?? []) as { url: string; is_primary: boolean; order_index: number }[]
    const primary = photos.find((ph) => ph.is_primary) ?? photos.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0]
    return { ...p, imageUrl: primary?.url ?? null }
  })

  // Brand's product families with a representative image
  const { data: families } = await supabase
    .from("product_families")
    .select("id, slug, name")
    .eq("brand_id", b.id)
    .order("name")

  const familyImages = new Map<string, string | null>()
  for (const item of items) {
    const fid = item.family?.id
    if (fid && !familyImages.has(fid) && item.imageUrl) {
      familyImages.set(fid, item.imageUrl)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Filter bar placeholder — keeps the sticky bar consistent */}
      <div className="discover-filter-bar">
        <div className="wrap">
          <div className="discover-filter-inner">
            <Link href="/products" className="filter-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
              All products
            </Link>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="discover-page-title">
        <div className="wrap">
          <nav aria-label="Breadcrumb" className="discover-breadcrumb">
            <Link href="/products" className="discover-breadcrumb-item">Products</Link>
            <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
            <span className="discover-breadcrumb-item discover-breadcrumb-current">{b.name}</span>
          </nav>
        </div>
      </div>

      {/* Brand header */}
      <div className="wrap" style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 32 }}>
          {b.logo_url ? (
            <div style={{ width: 96, height: 96, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
              <Image src={b.logo_url} alt={b.name} width={96} height={96} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--arco-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: "var(--text-secondary)", flexShrink: 0 }}>
              {b.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {b.country && <p className="arco-eyebrow">{b.country}{b.founded_year ? ` · Est. ${b.founded_year}` : ""}</p>}
            <h1 className="arco-page-title" style={{ marginTop: 8 }}>{b.name}</h1>
            {b.description && (
              <p className="arco-body-text" style={{ marginTop: 16, maxWidth: 720 }}>{b.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Family cards */}
      {(families?.length ?? 0) > 0 && (
        <div className="wrap" style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
            {(families ?? []).map((f: any) => {
              const img = familyImages.get(f.id) ?? null
              return (
                <div key={f.id} className="credit-card" style={{ width: 100, padding: 0 }}>
                  <div className="credit-icon">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span className="credit-icon-initials">{f.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <h3 className="arco-label">{f.name}</h3>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Products grid */}
      <div className="discover-results">
        <div className="wrap">
          <div className="discover-results-meta">
            <p className="discover-results-count">
              <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{items.length}</strong> products
            </p>
          </div>
          {items.length === 0 ? (
            <div className="empty-state">
              <h2 className="arco-section-title empty-state__title">No products yet</h2>
              <p className="arco-body-text empty-state__description">This brand doesn't have any products yet.</p>
            </div>
          ) : (
            <div className="discover-grid">
              {items.map((product: any) => (
                <Link key={product.id} href={`/products/${brandSlug}/${product.slug}`} className="discover-card">
                  <div className="discover-card-image-wrap">
                    {product.imageUrl ? (
                      <div className="discover-card-image-layer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.imageUrl} alt={product.name} />
                      </div>
                    ) : (
                      <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                    )}
                  </div>
                  <h3 className="discover-card-title">{product.name}</h3>
                  <p className="discover-card-sub">{product.category?.name ?? ""}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
