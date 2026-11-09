import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { SeriesEditClient, type SeriesEditApplied, type SeriesEditCategory } from "./series-detail-client"

export const dynamic = "force-dynamic"
// "Fetch from the brand's page" scrapes one page and reads it with Claude.
export const maxDuration = 120

type Params = Promise<{ id: string; familyId: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { familyId } = await params
  const supabase = createServiceRoleSupabaseClient() as any
  const { data } = await supabase.from("product_families").select("name, brands(name)").eq("id", familyId).maybeSingle()
  return { title: data ? `${data.name} — ${data.brands?.name ?? "Brand"}` : "Series" }
}

/**
 * De seriepagina onder een merk — waar de productpagina stond. Beeld
 * links, naam en omschrijving rechts, de detailbalk eronder, dan de
 * eigen foto's van de serie (292) zoals een productpagina ze had, en de
 * projecten waarin de serie is toegepast — waar later de projectfoto's
 * bij komen die haar tonen.
 */
export default async function AdminSeriesDetailPage({ params }: { params: Params }) {
  const { id, familyId } = await params
  const supabase = createServiceRoleSupabaseClient() as any

  const [{ data: family }, { data: brand }] = await Promise.all([
    supabase
      .from("product_families")
      .select("id, slug, name, description, hero_image_url, designer, launch_year, url, category_id, is_featured, brand_id")
      .eq("id", familyId)
      .maybeSingle(),
    supabase
      .from("brands")
      .select("id, slug, name, logo_url, website")
      .eq("id", id)
      .maybeSingle(),
  ])

  // Een serie hoort bij precies één merk; een url met het verkeerde merk
  // erin is geen pagina.
  if (!family || !brand || family.brand_id !== brand.id) notFound()

  const [{ data: links }, { data: photos }] = await Promise.all([
    supabase
      .from("project_brands")
      .select("id, note, photo_id, projects(id, title, status, address_city), spaces(name)")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_family_photos")
      .select("id, url, alt_text, is_primary, order_index")
      .eq("family_id", familyId)
      .order("order_index"),
  ])
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, slug, name, name_nl, parent_id, order_index")
    .order("order_index")
  const categoryRows: SeriesEditCategory[] = ((categories ?? []) as any[]).map((c) => ({
    id: c.id, slug: c.slug, name: c.name, nameNl: c.name_nl ?? null, parentId: c.parent_id ?? null, orderIndex: c.order_index ?? 0,
  }))

  const applied: SeriesEditApplied[] = ((links ?? []) as any[])
    .filter((l) => l.projects)
    .map((l) => ({
      id: l.id,
      note: l.note ?? null,
      photoId: l.photo_id ?? null,
      project: { id: l.projects.id, title: l.projects.title, status: l.projects.status, city: l.projects.address_city ?? null },
      spaceName: l.spaces?.name ?? null,
    }))

  return (
    <div className="min-h-screen bg-white">
      <SeriesEditClient brand={brand} family={family} photos={photos ?? []} applied={applied} categories={categoryRows} />
    </div>
  )
}
