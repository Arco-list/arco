import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { ProductsClient } from "./products-client"

export const dynamic = "force-dynamic"

export type AdminProductRow = {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  source_url: string | null
  scraped_at: string | null
  created_at: string
  brand: { id: string; name: string; logo_url: string | null } | null
  category: { name: string } | null
  primary_photo: string | null
  photo_count: number
}

export default async function AdminProductsPage() {
  const supabase = createServiceRoleSupabaseClient() as any

  const { data: products } = await supabase
    .from("products")
    .select(`
      id, slug, name, description, status, source_url, scraped_at, created_at,
      brand:brands(id, name, logo_url),
      category:product_categories(name),
      product_photos(url, is_primary)
    `)
    .order("created_at", { ascending: false })

  const rows: AdminProductRow[] = (products ?? []).map((p: any) => {
    const photos = (p.product_photos ?? []) as { url: string; is_primary: boolean }[]
    const primary = photos.find((ph) => ph.is_primary) ?? photos[0]
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      status: p.status,
      source_url: p.source_url,
      scraped_at: p.scraped_at,
      created_at: p.created_at,
      brand: p.brand,
      category: p.category,
      primary_photo: primary?.url ?? null,
      photo_count: photos.length,
    }
  })

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <ProductsClient initialProducts={rows} />
        </div>
      </div>
    </div>
  )
}
