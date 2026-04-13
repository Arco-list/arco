import { notFound, redirect } from "next/navigation"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Legacy route: /products/[slug]
 * Redirects to /products/[brand]/[slug]
 */
export default async function ProductRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServiceRoleSupabaseClient()

  const { data: product } = await supabase
    .from("products")
    .select("slug, brand:brands(slug)")
    .eq("slug", slug)
    .maybeSingle()

  if (!product || !(product as any).brand?.slug) notFound()

  redirect(`/products/${(product as any).brand.slug}/${(product as any).slug}`)
}
