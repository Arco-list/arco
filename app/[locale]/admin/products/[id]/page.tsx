import { notFound } from "next/navigation"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { ProductDetailClient } from "./product-detail-client"

export const dynamic = "force-dynamic"

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceRoleSupabaseClient()

  const { data: product } = await supabase
    .from("products")
    .select(`
      *,
      brand:brands(id, name, slug, logo_url, domain),
      family:product_families(id, name, slug),
      category:product_categories(id, name, slug, parent_id),
      product_photos(id, url, alt_text, is_primary, order_index)
    `)
    .eq("id", id)
    .maybeSingle()

  if (!product) notFound()
  const p = product as any

  // Siblings used for "More from [collection]" and "More by [brand]" rows,
  // kept read-only on the admin page so editors can navigate between
  // products without leaving the edit context.
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
      return { id: s.id, slug: s.slug, name: s.name, imageUrl: primary?.url ?? null }
    })
  }

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
      return { id: s.id, slug: s.slug, name: s.name, imageUrl: primary?.url ?? null }
    })
  }

  // Editable dropdown sources
  const [{ data: categories }, { data: families }] = await Promise.all([
    supabase
      .from("product_categories")
      .select("id, slug, name, parent_id")
      .order("order_index"),
    supabase
      .from("product_families")
      .select("id, slug, name")
      .eq("brand_id", p.brand.id)
      .order("name"),
  ])

  return (
    <ProductDetailClient
      product={p}
      categories={(categories ?? []) as any}
      families={(families ?? []) as any}
      familySiblings={familySiblings}
      brandSiblings={brandSiblings}
    />
  )
}
