import { notFound } from "next/navigation"
import Link from "next/link"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { requireProductsAdmin } from "@/lib/products-gate"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductGallery } from "@/components/product/product-gallery"
import { ProductSubNav } from "@/components/product/product-sub-nav"
import { ProductHero } from "@/components/product/product-hero"
import { SmartImage } from "@/components/smart-image"
import { groupSpecs, specLabel } from "@/lib/products/spec-groups"

export const dynamic = "force-dynamic"

export default async function ProductDetailPage({ params }: { params: Promise<{ brand: string; product: string }> }) {
  await requireProductsAdmin()

  const { brand: brandSlug, product: slug } = await params
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

  const rawSpecs = p.specs as Record<string, any> | null

  // Normalise scoped vs flat specs — same logic as admin product edit.
  const specsScoped: Record<string, Record<string, any>> = (() => {
    if (!rawSpecs) return {}
    const firstVal = Object.values(rawSpecs)[0]
    const looksScoped =
      firstVal !== undefined
      && Object.values(rawSpecs).every((v) => v && typeof v === "object" && !Array.isArray(v))
    return looksScoped ? rawSpecs : { _shared: rawSpecs }
  })()
  const specs = specsScoped._shared ?? {}

  // Extract a spec value (case-insensitive key lookup on the shared scope)
  const specVal = (key: string) => {
    const lower = key.toLowerCase()
    for (const [k, v] of Object.entries(specs)) {
      if (k.toLowerCase() === lower && v) return String(v)
    }
    return null
  }

  // Details bar items — surface key metadata + commonly valued specs.
  // Uses the same eyebrow-label + card-title-value pattern as the admin.
  // Same fields as the admin product edit details bar.
  const detailsBar = [
    { label: "Category", value: (p.category as any)?.name ?? null },
    { label: "Collection", value: p.family?.name ?? null },
    { label: "Designer", value: specVal("designer") },
    { label: "Year", value: specVal("year") },
  ].filter((d) => d.value)

  // Sibling products in the same family
  let familySiblings: any[] = []
  if (p.family?.id) {
    const { data } = await supabase
      .from("products")
      .select("id, slug, name, brand:brands(name, slug, logo_url), category:product_categories(name), product_photos(url, is_primary)")
      .eq("family_id", p.family.id)
      .neq("id", p.id)
      .limit(3)
    familySiblings = (data ?? []).map((s: any) => {
      const ph = s.product_photos ?? []
      const primary = ph.find((x: any) => x.is_primary) ?? ph[0]
      return {
        ...s,
        imageUrl: primary?.url ?? null,
        brandName: s.brand?.name ?? "",
        brandSlug: s.brand?.slug ?? brandSlug,
        brandLogoUrl: s.brand?.logo_url ?? null,
        categoryName: s.category?.name ?? null,
      }
    })
  }

  // Other products by the same brand (excluding family siblings already shown)
  let brandSiblings: any[] = []
  if (p.brand?.id) {
    const excludeIds = [p.id, ...familySiblings.map((s) => s.id)]
    const { data } = await supabase
      .from("products")
      .select("id, slug, name, brand:brands(name, slug, logo_url), category:product_categories(name), product_photos(url, is_primary)")
      .eq("brand_id", p.brand.id)
      .not("id", "in", `(${excludeIds.join(",")})`)
      .limit(3)
    brandSiblings = (data ?? []).map((s: any) => {
      const ph = s.product_photos ?? []
      const primary = ph.find((x: any) => x.is_primary) ?? ph[0]
      return {
        ...s,
        imageUrl: primary?.url ?? null,
        brandName: s.brand?.name ?? "",
        brandSlug: s.brand?.slug ?? brandSlug,
        brandLogoUrl: s.brand?.logo_url ?? null,
        categoryName: s.category?.name ?? null,
      }
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
        slug={`${brandSlug}/${slug}`}
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
              <Link href={`/products/${p.brand.slug}`} className="discover-breadcrumb-item">{p.brand.name}</Link>
            </>
          )}
          {p.family && (
            <>
              <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
              <Link href={`/products/${p.brand?.slug ?? brandSlug}?collection=${encodeURIComponent(p.family.name)}`} className="discover-breadcrumb-item">{p.family.name}</Link>
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
        {(detailsBar.length > 0 || p.source_url) && (
          <section className="specifications-bar">
            {detailsBar.map((d) => (
              <div key={d.label} className="spec-item">
                <span className="arco-eyebrow">{d.label}</span>
                <div className="arco-card-title">{d.value}</div>
              </div>
            ))}
            {p.source_url && (
              <div className="spec-item">
                <span className="arco-eyebrow">Brand website</span>
                <div className="arco-card-title">
                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link-plain"
                  >
                    {(() => {
                      try {
                        return p.brand?.domain ?? new URL(p.source_url).hostname.replace(/^www\./, "")
                      } catch { return p.brand?.domain ?? p.source_url }
                    })()} →
                  </a>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Remaining photos gallery */}
      {galleryPhotos.length > 0 && (
        <div id="gallery" className="wrap" style={{ marginBottom: 60 }}>
          <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Gallery</h2>
          <ProductGallery photos={galleryPhotos} productName={p.name} />
        </div>
      )}

      {/* Specifications section — uses the shared groupSpecs util so
          grouping stays aligned with the admin product edit page. */}
      {(() => {
        const omitKeys = new Set(["designer", "year"])

        // Extract unique model labels.
        const modelLabels: string[] = []
        const seenModels = new Set<string>()
        for (const v of variants) {
          const m = v.attributes?.model ?? v.attributes?.size ?? v.size
          if (typeof m === "string" && m.trim() && !seenModels.has(m)) {
            seenModels.add(m)
            modelLabels.push(m)
          }
        }

        // Collect all spec keys + per-model values for inline rendering.
        const allKeys = new Set<string>()
        const sharedValues: Record<string, any> = {}
        const perModelValues: Record<string, Record<string, any>> = {}
        for (const [k, v] of Object.entries(specs)) {
          if (omitKeys.has(k.toLowerCase())) continue
          allKeys.add(k)
          sharedValues[k] = v
        }
        for (const model of modelLabels) {
          const mSpecs = specsScoped[model] ?? {}
          for (const [k, v] of Object.entries(mSpecs)) {
            if (omitKeys.has(k.toLowerCase())) continue
            allKeys.add(k)
            if (!perModelValues[k]) perModelValues[k] = {}
            perModelValues[k][model] = v
          }
        }

        // Build merged view for grouping.
        const merged: Record<string, any> = {}
        for (const k of allKeys) {
          if (k in sharedValues) {
            merged[k] = sharedValues[k]
          } else {
            const firstModel = Object.keys(perModelValues[k] ?? {})[0]
            merged[k] = firstModel ? perModelValues[k][firstModel] : ""
          }
        }

        const grouped = groupSpecs(merged, {
          specOrder: (p.spec_order as string[] | null) ?? null,
          specGroupOverrides: (p.spec_groups as Record<string, string> | null) ?? null,
        })
        if (grouped.length === 0) return null

        return (
          <div id="specs" className="wrap" style={{ marginBottom: 60 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 32 }}>Specifications</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
              {grouped.map((group) => (
                <div key={group.label}>
                  <h4 className="arco-label" style={{ marginBottom: 12 }}>{group.label}</h4>
                  <div style={{ borderTop: "1px solid var(--rule)" }}>
                    {group.entries.map(([key]) => {
                      const isPerModel = !!(perModelValues[key] && Object.keys(perModelValues[key]).length > 0)
                      return (
                        <div
                          key={key}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            alignItems: "baseline",
                            padding: "12px 0",
                            borderBottom: "1px solid var(--rule)",
                            gap: 16,
                          }}
                        >
                          <span className="arco-small-text" style={{ color: "var(--text-disabled)", textTransform: "capitalize" }}>
                            {specLabel(key)}
                          </span>
                          <span className="arco-small-text" style={{ color: "var(--text-primary)" }}>
                            {isPerModel ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {modelLabels.map((model, i) => {
                                  const v = perModelValues[key]?.[model]
                                  if (!v) return null
                                  return (
                                    <span key={model} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                      {String(v)}
                                      <span className="status-pill" style={{ fontSize: 10, padding: "1px 6px" }}>{model}</span>
                                      {i < modelLabels.filter((m) => perModelValues[key]?.[m]).length - 1 && (
                                        <span style={{ color: "var(--text-disabled)", margin: "0 2px" }}>/</span>
                                      )}
                                    </span>
                                  )
                                })}
                              </span>
                            ) : (
                              String(merged[key])
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Family siblings */}
      {familySiblings.length > 0 && (
        <div id="related" className="wrap" style={{ marginBottom: 60 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
            <h2 className="arco-section-title">
              {p.family ? `More from the ${p.family.name} collection` : "Related products"}
            </h2>
          </div>
          <div className="discover-grid">
            {familySiblings.map((sibling: any) => (
              <Link key={sibling.id} href={`/products/${sibling.brandSlug}/${sibling.slug}`} className="discover-card">
                <div className="discover-card-image-wrap">
                  {sibling.imageUrl ? (
                    <div className="discover-card-image-layer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <SmartImage src={sibling.imageUrl} alt={sibling.name} />
                    </div>
                  ) : (
                    <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                  )}
                </div>
                <div className="pro-card-info">
                  {sibling.brandLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sibling.brandLogoUrl} alt="" className="pro-card-logo" width={34} height={34} loading="lazy" />
                  ) : (
                    <div className="pro-card-logo pro-card-logo-placeholder">
                      {(sibling.brandName || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="discover-card-title">{sibling.name}</h3>
                    <p className="discover-card-sub">{[sibling.brandName, sibling.categoryName].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
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
            <Link href={`/products/${p.brand?.slug}`} className="view-all-link">View all →</Link>
          </div>
          <div className="discover-grid">
            {brandSiblings.map((sibling: any) => (
              <Link key={sibling.id} href={`/products/${sibling.brandSlug}/${sibling.slug}`} className="discover-card">
                <div className="discover-card-image-wrap">
                  {sibling.imageUrl ? (
                    <div className="discover-card-image-layer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <SmartImage src={sibling.imageUrl} alt={sibling.name} />
                    </div>
                  ) : (
                    <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                  )}
                </div>
                <div className="pro-card-info">
                  {sibling.brandLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sibling.brandLogoUrl} alt="" className="pro-card-logo" width={34} height={34} loading="lazy" />
                  ) : (
                    <div className="pro-card-logo pro-card-logo-placeholder">
                      {(sibling.brandName || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="discover-card-title">{sibling.name}</h3>
                    <p className="discover-card-sub">{[sibling.brandName, sibling.categoryName].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}


      <Footer />
    </div>
  )
}
