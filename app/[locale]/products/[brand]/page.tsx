import { notFound, redirect } from "next/navigation"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { requireProductsAdmin } from "@/lib/products-gate"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductsDiscoverClient } from "../products-discover-client"
import type { DiscoverProduct, DiscoverBrand, DiscoverCategory } from "../page"

export const dynamic = "force-dynamic"

export default async function BrandProductsPage({ params }: { params: Promise<{ brand: string }> }) {
  await requireProductsAdmin()

  const { brand: brandSlug } = await params
  const supabase = createServiceRoleSupabaseClient()

  // Check if this is a brand slug
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", brandSlug)
    .maybeSingle()

  // If not a brand, check if it's a legacy product slug and redirect
  if (!brand) {
    const { data: product } = await supabase
      .from("products")
      .select("slug, brand:brands(slug)")
      .eq("slug", brandSlug)
      .maybeSingle()

    if (product && (product as any).brand?.slug) {
      redirect(`/products/${(product as any).brand.slug}/${(product as any).slug}`)
    }
    notFound()
  }

  // Fetch same data as the main products page
  const [productsResult, brandsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select(`
        id, slug, name, brand_id,
        brand:brands!inner(id, name, slug, logo_url, description),
        category:product_categories(id, name, slug),
        family:product_families(id, name),
        product_photos(url, is_primary, order_index)
      `)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("brands")
      .select("id, slug, name, logo_url, description")
      .order("name"),
    supabase
      .from("product_categories")
      .select("id, slug, name, parent_id")
      .order("order_index"),
  ])

  const products: DiscoverProduct[] = (productsResult.data ?? []).map((p: any) => {
    const photos = (p.product_photos ?? []) as { url: string; is_primary: boolean; order_index: number }[]
    const primary = photos.find((ph) => ph.is_primary) ?? photos.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0]
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brandId: p.brand?.id ?? p.brand_id,
      brandName: p.brand?.name ?? "",
      brandSlug: p.brand?.slug ?? "",
      brandLogoUrl: p.brand?.logo_url ?? null,
      categoryId: p.category?.id ?? null,
      categoryName: p.category?.name ?? null,
      familyId: p.family?.id ?? null,
      familyName: p.family?.name ?? null,
      imageUrl: primary?.url ?? null,
    }
  })

  const brandProductCounts = new Map<string, number>()
  for (const p of products) {
    brandProductCounts.set(p.brandId, (brandProductCounts.get(p.brandId) ?? 0) + 1)
  }

  const brands: DiscoverBrand[] = (brandsResult.data ?? [])
    .map((b: any) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      logoUrl: b.logo_url,
      description: b.description ?? null,
      productCount: brandProductCounts.get(b.id) ?? 0,
    }))
    .filter((b: DiscoverBrand) => b.productCount > 0)

  const categories: DiscoverCategory[] = (categoriesResult.data ?? []).map((c: any) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    parentId: c.parent_id,
    productCount: 0,
  }))

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <ProductsDiscoverClient
        initialProducts={products}
        brands={brands}
        categories={categories}
        initialBrandSlug={brandSlug}
      />
      <Footer />
    </div>
  )
}
