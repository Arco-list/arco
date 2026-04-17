import { notFound } from "next/navigation"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { BrandDetailClient } from "./brand-detail-client"

export const dynamic = "force-dynamic"

export default async function AdminBrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceRoleSupabaseClient()

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!brand) notFound()

  const [{ data: products }, { data: families }] = await Promise.all([
    supabase
      .from("products")
      .select("id, slug, name, description, source_url, status, scraped_at, family_id, category:product_categories(id, name), product_photos(url, is_primary, order_index)")
      .eq("brand_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_families")
      .select("id, slug, name, description, hero_image_url")
      .eq("brand_id", id)
      .order("name"),
  ])

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <BrandDetailClient
            brand={brand as any}
            products={(products ?? []) as any}
            families={(families ?? []) as any}
          />
        </div>
      </div>
    </div>
  )
}
