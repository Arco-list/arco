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
 * de detailbalk; de collecties waar bij een bedrijf de projecten staan; de
 * projecten waarin het merk is toegepast; en het contactblok.
 *
 * De merkenlaag gaat merk → collectie → foto. Een collectie (Occhio › Mito,
 * Drop › Spa) is hoe een merk zichzelf verkoopt, hoe een architect
 * specificeert en wat op een foto te herkennen is; product_collections is
 * de collectietabel. Categorieën (291) zeggen wat het merk maakt, zoals
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

  const [{ data: collections }, { data: links }, { data: categories }, { data: brandCategories }, { data: locationRows }] = await Promise.all([
    supabase
      .from("product_collections")
      .select("id, slug, name, description, hero_image_url, designer, launch_year, url, category_id")
      .eq("brand_id", id)
      .order("name"),
    // Waar is dit merk toegepast? De grove koppeling uit migratie 288 —
    // merk + collectie + ruimte, nog zonder foto. Dit is de lijst waarop de
    // publieke merkpagina straks gebouwd wordt.
    supabase
      .from("project_brands")
      .select("id, note, status, photo_id, projects(id, title, status, address_city), product_collections(name), spaces(name)")
      .eq("brand_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_categories")
      .select("id, slug, name, name_nl, parent_id, order_index")
      .order("order_index"),
    supabase
      .from("brand_categories")
      .select("category_id, position")
      .eq("brand_id", id)
      .order("position"),
    // Eigen showrooms van het merk (locations.brand_id, migratie 297).
    supabase.from("locations").select("*").eq("brand_id", id).order("position").order("created_at"),
  ])
  // De soorten en de designer op de kaart komen van de collectiepagina en
  // worden alleen daar aangepast; de kaart toont ze zoals de publieke kaart:
  // soorten · designer (zonder eigen soorten de ene soort of groep).
  const collectionIds = ((collections ?? []) as Array<{ id: string }>).map((c) => c.id)
  const [{ data: kindRows }, { data: coverRows }] = collectionIds.length > 0
    ? await Promise.all([
        supabase.from("product_collection_kinds").select("collection_id, category_id, position").in("collection_id", collectionIds).order("position"),
        // Focuspunt en maat van de omslag: de kaart snijdt bij zoals de
        // publieke kaart (focusPositionIn).
        supabase.from("product_collection_photos").select("collection_id, url, focus_x, focus_y, width, height").in("collection_id", collectionIds).eq("is_primary", true),
      ])
    : [{ data: [] as Array<{ collection_id: string; category_id: string }> }, { data: [] as any[] }]
  const coverOf = new Map(((coverRows ?? []) as any[]).map((r) => [r.collection_id as string, r]))
  const kindName = new Map(((categories ?? []) as any[]).map((c) => [c.id as string, (c.name_nl ?? c.name) as string]))
  const kindsOf = new Map<string, string[]>()
  for (const k of (kindRows ?? []) as Array<{ collection_id: string; category_id: string }>) {
    kindsOf.set(k.collection_id, [...(kindsOf.get(k.collection_id) ?? []), k.category_id])
  }
  const collectionRows = ((collections ?? []) as any[]).map((c) => {
    const names = (kindsOf.get(c.id) ?? (c.category_id ? [c.category_id] : [])).map((id) => kindName.get(id)).filter((n): n is string => Boolean(n))
    const kinds_label = names.length === 0 ? null : names.length > 2 ? `${names.slice(0, 2).join(" · ")} +${names.length - 2}` : names.join(" · ")
    const cover = coverOf.get(c.id)
    const sameImage = cover && cover.url === c.hero_image_url
    return {
      ...c,
      kinds_label,
      hero_focus: sameImage && cover.focus_x != null && cover.focus_y != null ? { x: cover.focus_x, y: cover.focus_y } : null,
      hero_size: sameImage && cover.width && cover.height ? { width: cover.width, height: cover.height } : null,
    }
  })
  // Zodra een collectie soorten of een groep heeft, volgen de categorieën van
  // het merk de collecties (lib/products/brand-categories) en is de keuzelijst weg.
  const categoriesAuto = collectionRows.some((c) => kindsOf.has(c.id) || Boolean(c.category_id))
  const locations = ((locationRows ?? []) as Record<string, unknown>[]).map(locationFromRow)

  const applied: BrandEditApplied[] = ((links ?? []) as any[])
    .filter((l) => l.projects)
    .map((l) => ({
      id: l.id,
      note: l.note ?? null,
      photoId: l.photo_id ?? null,
      project: { id: l.projects.id, title: l.projects.title, status: l.projects.status, city: l.projects.address_city ?? null },
      collectionName: l.product_collections?.name ?? null,
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
        collections={collectionRows}
        categoriesAuto={categoriesAuto}
        categories={categoryRows}
        categoryIds={((brandCategories ?? []) as Array<{ category_id: string }>).map((r) => r.category_id)}
        applied={applied}
        locations={locations}
      />
    </div>
  )
}
