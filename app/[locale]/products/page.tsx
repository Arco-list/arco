import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { requireProductsAdmin } from "@/lib/products-gate"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductsDiscoverClient } from "./products-discover-client"

export const dynamic = "force-dynamic"

export type DiscoverProduct = {
  id: string
  slug: string
  name: string
  brandId: string
  brandName: string
  brandSlug: string
  categoryName: string | null
  imageUrl: string | null
}

export type DiscoverBrand = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  productCount: number
}

export type DiscoverCategory = {
  id: string
  slug: string
  name: string
  parentId: string | null
  productCount: number
}

export default async function ProductsDiscoverPage() {
  await requireProductsAdmin()

  const supabase = createServiceRoleSupabaseClient()

  const [productsResult, brandsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select(`
        id, slug, name, brand_id,
        brand:brands!inner(id, name, slug),
        category:product_categories(id, name, slug),
        product_photos(url, is_primary, order_index)
      `)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("brands")
      .select("id, slug, name, logo_url")
      .order("name"),
    supabase
      .from("product_categories")
      .select("id, slug, name, parent_id")
      .order("order_index"),
  ])

  // Map products
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
      categoryName: p.category?.name ?? null,
      imageUrl: primary?.url ?? null,
    }
  })

  // Count products per brand
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
      productCount: brandProductCounts.get(b.id) ?? 0,
    }))
    .filter((b: DiscoverBrand) => b.productCount > 0)

  // Count products per category
  const categoryProductCounts = new Map<string, number>()
  for (const p of products) {
    if (p.categoryName) {
      const cat = (categoriesResult.data ?? []).find((c: any) => c.name === p.categoryName)
      if (cat) categoryProductCounts.set(cat.id, (categoryProductCounts.get(cat.id) ?? 0) + 1)
    }
  }

  const categories: DiscoverCategory[] = (categoriesResult.data ?? []).map((c: any) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    parentId: c.parent_id,
    productCount: categoryProductCounts.get(c.id) ?? 0,
  }))

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <ProductsDiscoverClient
        initialProducts={products}
        brands={brands}
        categories={categories}
      />
      <Footer />
    </div>
  )
}
