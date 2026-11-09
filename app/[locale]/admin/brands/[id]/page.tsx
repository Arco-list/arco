import { locationFromRow } from "@/lib/locations/types"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { BrandEditClient, type BrandEditApplied, type BrandEditCategory } from "./brand-detail-client"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = createServiceRoleSupabaseClient() as any
  const { data } = await supabase.from("brands").select("name").eq("id", id).maybeSingle()
  return { title: data?.name ?? "Brand" }
}

/**
 * De merkpagina voor admins — de tweeling van de bedrijfspagina
 * (/dashboard/company): kop met logo, naam, categorieën en omschrijving;
 * de detailbalk; de series waar bij een bedrijf de projecten staan; de
 * projecten waarin het merk is toegepast; en het contactblok.
 *
 * De merkenlaag gaat merk → serie → foto. Een serie (Occhio › Mito,
 * Drop › Spa) is hoe een merk zichzelf verkoopt, hoe een architect
 * specificeert en wat op een foto te herkennen is; product_families is
 * de serietabel. Categorieën (291) zeggen wat het merk maakt, zoals
 * services_offered zegt wat een bedrijf doet.
 */
export default async function AdminBrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceRoleSupabaseClient() as any

  const { data: brand } = await supabase
    .from("brands")
    .select("id, slug, name, domain, website, logo_url, description, country, founded_year, status")
    .eq("id", id)
    .maybeSingle()

  if (!brand) notFound()

  const [{ data: families }, { data: links }, { data: categories }, { data: brandCategories }, { data: locationRows }] = await Promise.all([
    supabase
      .from("product_families")
      .select("id, slug, name, description, hero_image_url, designer, launch_year, url")
      .eq("brand_id", id)
      .order("name"),
    // Waar is dit merk toegepast? De grove koppeling uit migratie 288 —
    // merk + serie + ruimte, nog zonder foto. Dit is de lijst waarop de
    // publieke merkpagina straks gebouwd wordt.
    supabase
      .from("project_brands")
      .select("id, note, status, photo_id, projects(id, title, status, address_city), product_families(name), spaces(name)")
      .eq("brand_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_categories")
      .select("id, slug, name, parent_id, order_index")
      .order("order_index"),
    supabase
      .from("brand_categories")
      .select("category_id, position")
      .eq("brand_id", id)
      .order("position"),
    // Eigen showrooms van het merk (locations.brand_id, migratie 297).
    supabase.from("locations").select("*").eq("brand_id", id).order("position").order("created_at"),
  ])
  const locations = ((locationRows ?? []) as Record<string, unknown>[]).map(locationFromRow)

  const applied: BrandEditApplied[] = ((links ?? []) as any[])
    .filter((l) => l.projects)
    .map((l) => ({
      id: l.id,
      note: l.note ?? null,
      photoId: l.photo_id ?? null,
      project: { id: l.projects.id, title: l.projects.title, status: l.projects.status, city: l.projects.address_city ?? null },
      familyName: l.product_families?.name ?? null,
      spaceName: l.spaces?.name ?? null,
    }))

  const categoryRows: BrandEditCategory[] = ((categories ?? []) as any[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    parentId: c.parent_id ?? null,
    orderIndex: c.order_index ?? 0,
  }))

  return (
    <div className="min-h-screen bg-white">
      <BrandEditClient
        brand={brand}
        families={families ?? []}
        categories={categoryRows}
        categoryIds={((brandCategories ?? []) as Array<{ category_id: string }>).map((r) => r.category_id)}
        applied={applied}
        locations={locations}
      />
    </div>
  )
}
