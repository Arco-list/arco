import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { requireProductsAdmin } from "@/lib/products-gate"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

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

  // Extract color variants for the swatch section
  const variants = (p.variants ?? []) as Array<Record<string, any>>
  const colorVariants = variants.filter((v: any) => v.color)

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Breadcrumb + Header */}
      <div id="details" className="wrap" style={{ marginTop: 120, marginBottom: 60 }}>
        <nav aria-label="Breadcrumb" className="discover-breadcrumb" style={{ justifyContent: "center", marginBottom: 24 }}>
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

        <section className="professional-header">
          {/* Brand icon */}
          <div className="company-icon">
            {p.brand?.logo_url ? (
              <Link href={`/brands/${p.brand.slug}`}>
                <Image
                  src={p.brand.logo_url}
                  alt={p.brand.name}
                  width={100}
                  height={100}
                  className="company-icon-image"
                />
              </Link>
            ) : (
              <div className="company-icon-initials">
                {(p.brand?.name ?? p.name).charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Brand name eyebrow */}
          {p.brand && (
            <Link href={`/brands/${p.brand.slug}`} className="professional-badge" style={{ display: "block", marginBottom: 16 }}>
              {p.brand.name}
            </Link>
          )}

          {/* Product name */}
          <h1 className="arco-page-title">{p.name}</h1>

          {/* Description */}
          {p.description && (
            <div className="professional-description" style={{ marginTop: 24 }}>
              {p.description.split("\n\n").map((para: string, i: number) => (
                <p key={i} className="arco-body-text">{para}</p>
              ))}
            </div>
          )}
        </section>

        {/* Details bar — mirrors specifications-bar */}
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

      {/* Photo gallery — masonry columns, full wrap width, preserves orientation */}
      {photos.length > 0 && (
        <div className="wrap" style={{ marginBottom: 60 }}>
          <div className="product-gallery">
            {photos.map((photo: any, i: number) => (
              <div key={photo.id} className="product-gallery-item">
                <Image
                  src={photo.url}
                  alt={photo.alt_text ?? p.name}
                  width={800}
                  height={600}
                  className="product-gallery-img"
                  priority={i === 0}
                  sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Color variants — dots with names, hover/click for variant image */}
      {colorVariants.length > 0 && (
        <div className="wrap" style={{ maxWidth: 1000, marginBottom: 60 }}>
          <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Colors</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {colorVariants.map((v: any, i: number) => {
              const colorHex = v.hex ?? v.color_hex ?? null
              const variantImageUrl = v.image_url ?? null
              return (
                <div
                  key={i}
                  className="product-color-swatch"
                  style={{ position: "relative" }}
                >
                  <div
                    className="product-color-dot"
                    style={{
                      background: colorHex ?? "var(--arco-surface)",
                      border: colorHex ? "none" : "1px solid var(--rule)",
                    }}
                  />
                  <span className="product-color-label">{v.color}</span>
                  {variantImageUrl && (
                    <div className="product-color-preview">
                      <Image
                        src={variantImageUrl}
                        alt={`${p.name} — ${v.color}`}
                        width={200}
                        height={200}
                        className="product-color-preview-img"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Specifications section */}
      {specs && Object.keys(specs).length > 0 && (
        <div className="wrap" style={{ maxWidth: 800, marginBottom: 60 }}>
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
        <div className="wrap" style={{ marginBottom: 60 }}>
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
        <div className="wrap" style={{ marginBottom: 80 }}>
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
