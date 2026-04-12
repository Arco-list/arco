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

  const heroPhoto = photos[0]
  const galleryPhotos = photos.slice(1)

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero — full width but not full viewport height like projects */}
      {heroPhoto && (
        <section className="relative w-full overflow-hidden bg-black" style={{ height: "60vh", minHeight: 400, maxHeight: 600 }}>
          <Image
            src={heroPhoto.url}
            alt={p.name}
            fill
            className="object-contain"
            priority
            sizes="100vw"
            style={{ background: "#f5f5f4" }}
          />
        </section>
      )}

      {/* Header — mirrors professional-header pattern */}
      <div id="details" className="wrap" style={{ marginTop: heroPhoto ? 60 : 120, marginBottom: 60 }}>
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

      {/* Photo gallery — constrained width, not full bleed */}
      {galleryPhotos.length > 0 && (
        <div className="wrap" style={{ maxWidth: 1000, marginBottom: 60 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {galleryPhotos.map((photo: any) => (
              <div key={photo.id} style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", borderRadius: 3 }}>
                <Image
                  src={photo.url}
                  alt={photo.alt_text ?? p.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 500px"
                />
              </div>
            ))}
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

      {/* Variants */}
      {p.variants && Array.isArray(p.variants) && p.variants.length > 0 && (
        <div className="wrap" style={{ maxWidth: 800, marginBottom: 60 }}>
          <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Variants</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {p.variants.map((v: any, i: number) => (
              <span key={i} className="status-pill">
                {Object.values(v).join(" · ")}
              </span>
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
