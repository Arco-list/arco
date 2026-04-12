import { notFound } from "next/navigation"
import Link from "next/link"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { requireProductsAdmin } from "@/lib/products-gate"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductGallery } from "@/components/product/product-gallery"
import { ProductSubNav } from "@/components/product/product-sub-nav"
import { ProductHero } from "@/components/product/product-hero"

export const dynamic = "force-dynamic"

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireProductsAdmin()

  const { slug } = await params
  const supabase = createServiceRoleSupabaseClient()

  const { data: product } = await supabase
    .from("products")
    .select(`
      *,
      brand:brands(id, name, slug, status, logo_url, country, domain),
      family:product_families(id, name, slug),
      category:product_categories(id, name, slug),
      product_photos(id, url, alt_text, is_primary, order_index)
    `)
    .eq("slug", slug)
    .maybeSingle()

  if (!product) notFound()
  const p = product as any

  const photos = (p.product_photos ?? []).sort((a: any, b: any) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return (a.order_index ?? 0) - (b.order_index ?? 0)
  })

  const specs = p.specs as Record<string, any> | null

  // Details bar items
  const detailsBar = [
    { label: "Collection", value: p.family?.name ?? null },
    { label: "Category", value: (p.category as any)?.name ?? null },
    { label: "Brand", value: p.brand?.name ?? null },
    { label: "Country", value: p.brand?.country ?? null },
  ].filter((d) => d.value)

  // Sibling products in the same family
  let familySiblings: any[] = []
  if (p.family?.id) {
    const { data } = await supabase
      .from("products")
      .select("id, slug, name, product_photos(url, is_primary)")
      .eq("family_id", p.family.id)
      .neq("id", p.id)
      .limit(6)
    familySiblings = (data ?? []).map((s: any) => {
      const ph = s.product_photos ?? []
      const primary = ph.find((x: any) => x.is_primary) ?? ph[0]
      return { ...s, imageUrl: primary?.url ?? null }
    })
  }

  // Other products by the same brand (excluding family siblings already shown)
  let brandSiblings: any[] = []
  if (p.brand?.id) {
    const excludeIds = [p.id, ...familySiblings.map((s) => s.id)]
    const { data } = await supabase
      .from("products")
      .select("id, slug, name, product_photos(url, is_primary)")
      .eq("brand_id", p.brand.id)
      .not("id", "in", `(${excludeIds.join(",")})`)
      .limit(6)
    brandSiblings = (data ?? []).map((s: any) => {
      const ph = s.product_photos ?? []
      const primary = ph.find((x: any) => x.is_primary) ?? ph[0]
      return { ...s, imageUrl: primary?.url ?? null }
    })
  }

  const variants = (p.variants ?? []) as Array<Record<string, any>>

  // Collect ALL variant image URLs so we can exclude them from the main gallery
  const variantImageUrls = new Set(
    variants
      .map((v: any) => v.image_url)
      .filter(Boolean)
      .map((url: string) => url.toLowerCase().replace(/\/+$/, ""))
  )

  // Filter gallery: remove photos whose URL matches a variant image
  const nonVariantPhotos = photos.filter(
    (photo: any) => !variantImageUrls.has(photo.url.toLowerCase().replace(/\/+$/, ""))
  )

  const heroPhoto = nonVariantPhotos[0] ?? null
  const galleryPhotos = nonVariantPhotos.slice(1)

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <ProductSubNav
        productName={p.name}
        brandName={p.brand?.name ?? ""}
        imageUrl={heroPhoto?.url ?? null}
        slug={slug}
        hasGallery={galleryPhotos.length > 0}
        hasColors={false}
        hasSpecs={!!specs && Object.keys(specs).length > 0}
      />

      {/* Breadcrumb */}
      <div className="wrap" style={{ marginTop: 100 }}>
        <nav aria-label="Breadcrumb" className="discover-breadcrumb" style={{ marginBottom: 24 }}>
          <Link href="/products" className="discover-breadcrumb-item">Products</Link>
          {p.brand && (
            <>
              <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
              <Link href={`/brands/${p.brand.slug}`} className="discover-breadcrumb-item">{p.brand.name}</Link>
            </>
          )}
          {p.family && (
            <>
              <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
              <span className="discover-breadcrumb-item">{p.family.name}</span>
            </>
          )}
          <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
          <span className="discover-breadcrumb-item discover-breadcrumb-current">{p.name}</span>
        </nav>
      </div>

      {/* Hero: primary image left + product info + variant selectors right */}
      <div id="details" className="wrap" style={{ marginBottom: 40 }}>
        <ProductHero
          name={p.name}
          description={p.description}
          brand={p.brand ? { name: p.brand.name, slug: p.brand.slug, logo_url: p.brand.logo_url } : null}
          heroImageUrl={heroPhoto?.url ?? null}
          variants={variants}
        />

        {/* Details bar — below the hero split */}
        {detailsBar.length > 0 && (
          <section className="specifications-bar">
            {detailsBar.map((d) => (
              <div key={d.label} className="spec-item">
                <span className="arco-eyebrow">{d.label}</span>
                <div className="arco-card-title">{d.value}</div>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* Remaining photos gallery */}
      {galleryPhotos.length > 0 && (
        <div id="gallery" className="wrap" style={{ marginBottom: 60 }}>
          <ProductGallery photos={galleryPhotos} productName={p.name} />
        </div>
      )}

      {/* Specifications section */}
      {specs && Object.keys(specs).length > 0 && (
        <div id="specs" className="wrap" style={{ marginBottom: 60 }}>
          <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Details</h2>
          <div style={{ borderTop: "1px solid var(--rule)" }}>
            {Object.entries(specs).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "14px 0",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <span className="arco-small-text" style={{ color: "var(--text-disabled)", textTransform: "capitalize" }}>
                  {key.replace(/_/g, " ")}
                </span>
                <span className="arco-small-text" style={{ color: "var(--text-primary)", textAlign: "right" }}>
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Family siblings */}
      {familySiblings.length > 0 && (
        <div id="related" className="wrap" style={{ marginBottom: 60 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
            <h2 className="arco-section-title">
              {p.family ? `More from ${p.family.name}` : "Related products"}
            </h2>
          </div>
          <div className="discover-grid">
            {familySiblings.map((sibling: any) => (
              <Link key={sibling.id} href={`/products/${sibling.slug}`} className="discover-card">
                <div className="discover-card-image-wrap">
                  {sibling.imageUrl ? (
                    <div className="discover-card-image-layer">
                      <img src={sibling.imageUrl} alt={sibling.name} />
                    </div>
                  ) : (
                    <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                  )}
                </div>
                <h3 className="discover-card-title">{sibling.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Brand siblings */}
      {brandSiblings.length > 0 && (
        <div id={familySiblings.length === 0 ? "related" : undefined} className="wrap" style={{ marginBottom: 80 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
            <h2 className="arco-section-title">More by {p.brand?.name}</h2>
            <Link href={`/brands/${p.brand?.slug}`} className="view-all-link">View all →</Link>
          </div>
          <div className="discover-grid">
            {brandSiblings.map((sibling: any) => (
              <Link key={sibling.id} href={`/products/${sibling.slug}`} className="discover-card">
                <div className="discover-card-image-wrap">
                  {sibling.imageUrl ? (
                    <div className="discover-card-image-layer">
                      <img src={sibling.imageUrl} alt={sibling.name} />
                    </div>
                  ) : (
                    <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                  )}
                </div>
                <h3 className="discover-card-title">{sibling.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Source link */}
      {p.source_url && (
        <div className="wrap" style={{ marginBottom: 40 }}>
          <p className="arco-small-text" style={{ textAlign: "center" }}>
            Source: <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-[#016D75] hover:underline">{p.brand?.domain ?? p.source_url}</a>
          </p>
        </div>
      )}

      <Footer />
    </div>
  )
}
