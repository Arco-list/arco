import { Fragment } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceRoleSupabaseClient() as any

  const { data: product } = await supabase
    .from("products")
    .select(`
      *,
      brand:brands(id, name, slug, logo_url),
      category:product_categories(name),
      product_photos(id, url, alt_text, is_primary, order_index)
    `)
    .eq("id", id)
    .maybeSingle()

  if (!product) notFound()

  const photos = ((product as any).product_photos ?? []).sort((a: any, b: any) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return (a.order_index ?? 0) - (b.order_index ?? 0)
  })

  const specs = (product as any).specs as Record<string, any> | null

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap" style={{ maxWidth: 1000, paddingBottom: 80 }}>
          <Link href="/admin/products" className="arco-small-text" style={{ display: "inline-block", marginBottom: 24 }}>
            ← All products
          </Link>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 40 }}>
            {/* Photos */}
            <div>
              {photos[0] ? (
                <img src={photos[0].url} alt={(product as any).name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 4 }} />
              ) : (
                <div style={{ width: "100%", aspectRatio: "1", background: "var(--arco-surface)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="arco-small-text">No photos</span>
                </div>
              )}
              {photos.length > 1 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 8 }}>
                  {photos.slice(1).map((p: any) => (
                    <img key={p.id} src={p.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 3 }} />
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              {(product as any).brand && (
                <Link href={`/admin/brands/${(product as any).brand.id}`} className="arco-eyebrow" style={{ display: "inline-block", marginBottom: 8 }}>
                  {(product as any).brand.name}
                </Link>
              )}
              <h2 className="arco-page-title">{(product as any).name}</h2>
              {(product as any).description && (
                <p className="arco-body-text" style={{ marginTop: 16 }}>
                  {(product as any).description}
                </p>
              )}

              {specs && Object.keys(specs).length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <h4 className="arco-label" style={{ marginBottom: 12 }}>Specifications</h4>
                  <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 24px" }}>
                    {Object.entries(specs).map(([key, value]) => (
                      <Fragment key={key}>
                        <dt className="arco-small-text" style={{ color: "var(--text-disabled)" }}>{key}</dt>
                        <dd className="arco-small-text" style={{ color: "var(--text-primary)" }}>{String(value)}</dd>
                      </Fragment>
                    ))}
                  </dl>
                </div>
              )}

              {(product as any).source_url && (
                <p className="arco-small-text" style={{ marginTop: 24 }}>
                  Source: <a href={(product as any).source_url} target="_blank" rel="noopener noreferrer" className="text-[#016D75] hover:underline">{(product as any).source_url}</a>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

