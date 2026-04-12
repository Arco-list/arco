import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { BrandsClient } from "./brands-client"

export const dynamic = "force-dynamic"

export type AdminBrandRow = {
  id: string
  slug: string
  name: string
  domain: string | null
  website: string | null
  logo_url: string | null
  description: string | null
  country: string | null
  status: string
  is_featured: boolean
  product_count: number
  created_at: string
}

export default async function AdminBrandsPage() {
  const supabase = createServiceRoleSupabaseClient()

  // Fetch brands with product counts in one query
  const { data: brands } = await supabase
    .from("brands")
    .select("id, slug, name, domain, website, logo_url, description, country, status, is_featured, created_at")
    .order("created_at", { ascending: false })

  // Get product counts per brand
  const brandIds = (brands ?? []).map((b: any) => b.id)
  const productCounts = new Map<string, number>()
  if (brandIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("brand_id")
      .in("brand_id", brandIds)
    for (const p of products ?? []) {
      productCounts.set(p.brand_id, (productCounts.get(p.brand_id) ?? 0) + 1)
    }
  }

  const rows: AdminBrandRow[] = (brands ?? []).map((b: any) => ({
    ...b,
    product_count: productCounts.get(b.id) ?? 0,
  }))

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <BrandsClient initialBrands={rows} />
        </div>
      </div>
    </div>
  )
}
