import type { Metadata } from "next"
import { categoryLevels } from "@/lib/products/collection-subgroups"
import { notFound } from "next/navigation"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { CollectionEditClient, type CollectionEditApplied, type CollectionEditCategory, type CollectionEditProduct } from "./collection-detail-client"

export const dynamic = "force-dynamic"
// "Fetch from the brand's page" scrapes one page and reads it with Claude.
export const maxDuration = 120

type Params = Promise<{ id: string; collectionId: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { collectionId } = await params
  const supabase = createServiceRoleSupabaseClient() as any
  const { data } = await supabase.from("product_collections").select("name, brands(name)").eq("id", collectionId).maybeSingle()
  return { title: data ? `${data.name} — ${data.brands?.name ?? "Brand"}` : "Collection" }
}

/**
 * De collectiepagina onder een merk — waar de productpagina stond. Beeld
 * links, naam en omschrijving rechts, de detailbalk eronder, dan de
 * eigen foto's van de collectie (292) zoals een productpagina ze had, en de
 * projecten waarin de collectie is toegepast — waar later de projectfoto's
 * bij komen die haar tonen.
 */
export default async function AdminCollectionDetailPage({ params }: { params: Params }) {
  const { id, collectionId } = await params
  const supabase = createServiceRoleSupabaseClient() as any

  const [{ data: collection }, { data: brand }] = await Promise.all([
    supabase
      .from("product_collections")
      .select("id, slug, name, description, hero_image_url, designer, launch_year, url, category_id, is_featured, brand_id")
      .eq("id", collectionId)
      .maybeSingle(),
    supabase
      .from("brands")
      .select("id, slug, name, logo_url, website, status")
      .eq("id", id)
      .maybeSingle(),
  ])

  // Een collectie hoort bij precies één merk; een url met het verkeerde merk
  // erin is geen pagina.
  if (!collection || !brand || collection.brand_id !== brand.id) notFound()

  const [{ data: links }, { data: photos }] = await Promise.all([
    supabase
      .from("project_brands")
      .select("id, note, photo_id, projects(id, title, status, address_city), spaces(name)")
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_collection_photos")
      .select("id, url, alt_text, is_primary, order_index, kind, width, height, focus_x, focus_y")
      .eq("collection_id", collectionId)
      .order("order_index"),
  ])
  const { data: productRows } = await supabase
    .from("products")
    .select("id, name, url, image_url, position, category_id, price_type, price_amount, price_currency, price_country")
    .eq("collection_id", collectionId)
    .order("position")
  const { data: kindRows } = await supabase
    .from("product_collection_kinds")
    .select("category_id")
    .eq("collection_id", collectionId)
    .order("position")
  const kindIds = ((kindRows ?? []) as Array<{ category_id: string }>).map((k) => k.category_id)
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, slug, name, name_nl, parent_id, order_index, is_active")
    .order("order_index")
  // Alleen actieve categorieën (geparkeerd = ook alles eronder weg, migratie 351).
  const levels = categoryLevels((categories ?? []) as any[])
  const categoryRows: CollectionEditCategory[] = ((categories ?? []) as any[]).filter((c) => levels.isLive(c.id)).map((c) => ({
    id: c.id, slug: c.slug, name: c.name, nameNl: c.name_nl ?? null, parentId: c.parent_id ?? null, orderIndex: c.order_index ?? 0,
  }))

  const applied: CollectionEditApplied[] = ((links ?? []) as any[])
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
      <CollectionEditClient brand={brand} collection={collection} photos={photos ?? []} applied={applied} categories={categoryRows} kindIds={kindIds} products={(productRows ?? []) as CollectionEditProduct[]} />
    </div>
  )
}
