"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * De cijfers waar de propositie op rust, live gelezen.
 *
 * NIET OVERGETYPT, met reden. CLAUDE.md noemt `reviews` en
 * `company_ratings` als kerntabellen; geen van beide bestaat. Zo verouderen
 * vastgelegde cijfers: iemand schrijft ze één keer op en niemand merkt het
 * wanneer ze niet meer kloppen. Een merkclaim die op een verouderd getal
 * steunt is erger dan geen claim.
 *
 * Het getal dat telt is `firmsWithBuiltWork` tegen `firms`. "Alleen
 * gebouwd werk" is pas te stempelen op 153 hubpagina's als het op élk
 * bureau waar is; zakt die verhouding, dan moet de claim mee.
 */

export type BrandProof = {
  firms: number
  firmsWithBuiltWork: number
  projects: number
  photos: number
  rooms: number
  cities: number
}

export type PageTypePerformance = {
  label: string
  title: string
  impressions: number
  clicks: number
  ctr: number
  position: number | null
}

export type BrandAudience = {
  homeowners: number
  professionalUsers: number
  companiesListed: number
  companiesProspected: number
  projectsPublished: number
  payingSubscriptions: number
}

export type BrandData = {
  proof: BrandProof
  audience: BrandAudience
  performance: PageTypePerformance[]
}

type Row = Record<string, unknown>
type Db = {
  rpc: <T>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T[] | null; error: unknown }>
}

export async function fetchBrandData(): Promise<BrandData> {
  const db = createServiceRoleSupabaseClient() as unknown as Db

  // Eén trip: tellingen die niets met elkaar te maken hebben, maar die
  // samen het bewijsblok vormen.
  const { data: proofRows } = await db.rpc<Row>("brand_proof_counts")
  const p = (proofRows?.[0] ?? {}) as Record<string, number>

  const { data: audienceRows } = await db.rpc<Row>("brand_audience_counts")
  const a = (audienceRows?.[0] ?? {}) as Record<string, number>

  const { data: perfRows } = await db.rpc<Row>("brand_page_type_performance", { day_count: 42 })

  const LABELS: Record<string, { label: string; title: string }> = {
    proHub: { label: "Hub — stad, dienst, categorie", title: "Architecten in Nederland – bekijk hun projecten" },
    ovBedrijven: { label: "Overzicht bedrijven", title: "Architecten en interieurontwerpers in Nederland" },
    bedrijfsprofiel: { label: "Bedrijfsprofiel", title: "Wolterinck" },
    projectpagina: { label: "Projectpagina", title: "Villa Mel" },
    projectHub: { label: "Hub — project", title: "Nieuwbouw in Gelderland – bekijk hun projecten" },
    ovProjecten: { label: "Overzicht projecten", title: "Projecten in Nederland" },
  }

  const performance = ((perfRows ?? []) as Array<Record<string, number | string>>)
    .filter((r) => LABELS[String(r.page_type)])
    .map((r) => ({
      ...LABELS[String(r.page_type)],
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      ctr: Number(r.ctr) || 0,
      position: r.avg_position != null ? Number(r.avg_position) : null,
    }))
    .sort((a, b) => b.ctr - a.ctr)

  return {
    audience: {
      homeowners: Number(a.homeowners) || 0,
      professionalUsers: Number(a.professional_users) || 0,
      companiesListed: Number(a.companies_listed) || 0,
      companiesProspected: Number(a.companies_prospected) || 0,
      projectsPublished: Number(a.projects_published) || 0,
      payingSubscriptions: Number(a.paying_subscriptions) || 0,
    },
    proof: {
      firms: Number(p.firms) || 0,
      firmsWithBuiltWork: Number(p.firms_with_built_work) || 0,
      projects: Number(p.projects) || 0,
      photos: Number(p.photos) || 0,
      rooms: Number(p.rooms) || 0,
      cities: Number(p.cities) || 0,
    },
    performance,
  }
}
