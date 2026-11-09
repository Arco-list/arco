import type { Metadata } from "next"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { BrandsClient } from "./brands-client"

export const metadata: Metadata = { title: "Brands" }

export const dynamic = "force-dynamic"
// Add brand runs as three server actions (brand, series, one per series
// page); the longest scrapes one page and reads it with Claude.
export const maxDuration = 120

/**
 * Eén rij per merk, in de vorm van de Companies-tabel.
 *
 * De twee tellingen die de rij dragen zijn de merk-equivalenten van wat
 * bij een bedrijf "gepubliceerd werk" is: hoeveel SERIES het merk heeft
 * (is er iets te tonen) en in hoeveel PROJECTEN het is toegepast (is er
 * bewijs). Producten tellen niet meer mee; die laag is uit het model.
 */
export type AdminBrandRow = {
  id: string
  slug: string
  name: string
  domain: string | null
  website: string | null
  logo_url: string | null
  country: string | null
  status: string
  is_featured: boolean
  /** Aantal series (product_families). */
  series_count: number
  /** Aantal projecten waarin het merk is getagd (project_brands, distinct). */
  project_count: number
  /** Waarvan met een aangewezen foto — de fijne koppeling. */
  pinned_count: number
  /** Naam van de eigenaar als het merk geclaimd is. */
  owner_name: string | null
  created_at: string
  updated_at: string | null
}

export default async function AdminBrandsPage() {
  const supabase = createServiceRoleSupabaseClient() as any

  const [{ data: brands }, { data: families }, { data: links }] = await Promise.all([
    supabase
      .from("brands")
      .select("id, slug, name, domain, website, logo_url, country, status, is_featured, owner_user_id, created_at, updated_at")
      .order("created_at", { ascending: false }),
    supabase.from("product_families").select("brand_id"),
    supabase.from("project_brands").select("brand_id, project_id, photo_id"),
  ])

  const seriesByBrand = new Map<string, number>()
  for (const f of (families ?? []) as Array<{ brand_id: string }>) {
    seriesByBrand.set(f.brand_id, (seriesByBrand.get(f.brand_id) ?? 0) + 1)
  }
  const projectsByBrand = new Map<string, Set<string>>()
  const pinnedByBrand = new Map<string, Set<string>>()
  for (const l of (links ?? []) as Array<{ brand_id: string; project_id: string; photo_id: string | null }>) {
    const set = projectsByBrand.get(l.brand_id) ?? new Set<string>()
    set.add(l.project_id)
    projectsByBrand.set(l.brand_id, set)
    if (l.photo_id) {
      const p = pinnedByBrand.get(l.brand_id) ?? new Set<string>()
      p.add(l.project_id)
      pinnedByBrand.set(l.brand_id, p)
    }
  }

  // Eigenaarnaam voor geclaimde merken — één vraag voor alle rijen.
  const ownerIds = Array.from(new Set(((brands ?? []) as Array<{ owner_user_id: string | null }>).map((b) => b.owner_user_id).filter((id): id is string => Boolean(id))))
  const ownerName = new Map<string, string>()
  if (ownerIds.length > 0) {
    // profiles kent first_name/last_name — geen full_name, geen email.
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ownerIds)
    for (const p of (profiles ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>) {
      ownerName.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "—")
    }
  }

  const rows: AdminBrandRow[] = ((brands ?? []) as any[]).map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    domain: b.domain ?? null,
    website: b.website ?? null,
    logo_url: b.logo_url ?? null,
    country: b.country ?? null,
    status: b.status,
    is_featured: Boolean(b.is_featured),
    series_count: seriesByBrand.get(b.id) ?? 0,
    project_count: projectsByBrand.get(b.id)?.size ?? 0,
    pinned_count: pinnedByBrand.get(b.id)?.size ?? 0,
    owner_name: b.owner_user_id ? (ownerName.get(b.owner_user_id) ?? "—") : null,
    created_at: b.created_at,
    updated_at: b.updated_at ?? null,
  }))

  return (
    <div className="min-h-screen bg-white">
      <BrandsClient initialBrands={rows} />
    </div>
  )
}
