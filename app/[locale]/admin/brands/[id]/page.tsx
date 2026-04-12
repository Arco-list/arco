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

  const { data: products } = await supabase
    .from("products")
    .select("id, slug, name, description, source_url, status, scraped_at, product_photos(url, is_primary)")
    .eq("brand_id", id)
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <BrandDetailClient brand={brand as any} products={(products ?? []) as any} />
        </div>
      </div>
    </div>
  )
}
