"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { BUCKET_UNIT, type SeoTimeframe } from "@/lib/seo/timeframes"
import {
  GROUP_OF, MARKET_SIDE, PAGE_TYPES,
  type PageType, type PageGroup,
} from "@/lib/seo/page-types"

/**
 * Alles wat /admin/seo toont, in één server-aanroep.
 *
 * AGGREGEREN GEBEURT IN DE DATABASE. seo_page_metrics telt bij een
 * volle backfill tienduizenden rijen en PostgREST kapt af op 1.000 —
 * zonder foutmelding. Dat is precies hoe
 * recomputeProspectLastEmailSentAt maandenlang het oudste kwart van de
 * mailgeschiedenis zat te herberekenen. De SQL-functies uit migratie
 * 278 doen het optellen, hier wordt alleen nog omgevormd.
 */

/**
 * De gegenereerde types in lib/supabase/types.ts lopen achter op de
 * database: seo_page_metrics, seo_sitemap_counts en de drie functies uit
 * migratie 278 staan er nog niet in. Dezelfde situatie als 'prospected'
 * in app/sitemap.ts, dat daar met een cast ter plekke wordt opgelost.
 *
 * Hier staat die cast op ÉÉN plek in plaats van bij elke aanroep, met
 * de vorm van wat terugkomt ernaast. Zo is hij in één handeling weg
 * zodra `generate_typescript_types` opnieuw gedraaid is, en in de
 * tussentijd is wél zichtbaar welke kolommen verwacht worden.
 */
type RpcResult<T> = Promise<{ data: T[] | null; error: unknown }>
type UntypedDb = {
  rpc: <T>(fn: string, args?: Record<string, unknown>) => RpcResult<T>
  from: (table: string) => {
    select: (cols: string) => {
      order: (col: string, opts: { ascending: boolean }) => {
        limit: (n: number) => RpcResult<Record<string, unknown>>
      }
    }
  }
}

type WeeklyRow = {
  bucket_start: string; page_type: string; urls: number
  impressions: number; clicks: number; avg_position: number | null; impressions_top10: number
}
type SitemapRow = { page_type: string; url_count: number; snapshot_date: string }
type TopQueryRow = { query: string; impressions: number; clicks: number; avg_position: number | null }
type TopPageRow = { page_url: string; page_type: string; impressions: number; clicks: number; avg_position: number | null }

export type Series = { u: number[]; i: number[]; c: number[]; p: (number | null)[]; i10: number[] }
export type QueryRow = { query: string; impressions: number; clicks: number; position: number | null }
export type PageRow = { url: string; type: PageType; side: string; impressions: number; clicks: number; position: number | null }

export type SeoOverview = {
  timeframe: SeoTimeframe
  weeks: string[]
  types: Record<PageType, Series>
  published: Partial<Record<PageType, number>>
  queries: Record<string, QueryRow[]>
  pages: PageRow[]
  lastDate: string | null
  /** Hoe oud de nieuwste rij is, in dagen. Search Console loopt ~2 dagen achter. */
  staleDays: number | null
}

const WEEK_COUNT = 8

const emptySeries = (): Series => ({
  u: Array(WEEK_COUNT).fill(0),
  i: Array(WEEK_COUNT).fill(0),
  c: Array(WEEK_COUNT).fill(0),
  p: Array(WEEK_COUNT).fill(null),
  i10: Array(WEEK_COUNT).fill(0),
})

/** De paginatypen achter één marktzijde — de filters op de tabellen. */
function typesForSide(side: string): PageType[] | null {
  if (side === "all") return null
  return PAGE_TYPES.filter((t) => MARKET_SIDE[GROUP_OF[t]] === side)
}

export async function fetchSeoOverview(timeframe: SeoTimeframe = "weeks"): Promise<SeoOverview> {
  // Service-role, zoals de rest van de admin-acties (table-actions.ts
  // doet hetzelfde voor seo_daily_metrics). De seo_*-tabellen staan op
  // RLS zonder policy — server-only, met opzet — dus een gebruikersclient
  // leest er nul rijen uit, zonder foutmelding. De autorisatie zit in
  // app/[locale]/admin/layout.tsx, die niet-admins wegstuurt vóór deze
  // actie draait.
  const db = createServiceRoleSupabaseClient() as unknown as UntypedDb

  const [weekly, sitemap, latest, topPages] = await Promise.all([
    db.rpc<WeeklyRow>("seo_metrics_by_bucket", {
      bucket_unit: BUCKET_UNIT[timeframe] ?? "week",
      bucket_count: WEEK_COUNT,
    }),
    db.from("seo_sitemap_counts")
      .select("page_type, url_count, snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(50),
    db.from("seo_page_metrics")
      .select("metric_date")
      .order("metric_date", { ascending: false })
      .limit(1),
    db.rpc<TopPageRow>("seo_top_pages", { day_count: 28, types: null, row_limit: 200 }),
  ])

  // ── weekassen ─────────────────────────────────────────────────
  // De functie geeft alleen weken terug waarin íets gebeurde, dus de
  // as wordt uit de nieuwste week afgeleid en niet uit de rijen: een
  // stille week hoort als gat zichtbaar te zijn, niet weggelaten.
  const rows = weekly.data ?? []
  const known = [...new Set(rows.map((r) => r.bucket_start))].sort()
  const lastBucket = known[known.length - 1]
  const weeks: string[] = []
  if (lastBucket) {
    // De as wordt terugwaarts uit de NIEUWSTE bucket opgebouwd, niet uit
    // de rijen: een periode zonder vertoningen hoort als gat zichtbaar te
    // zijn, niet weggelaten te worden.
    const step = (d: Date, back: number) => {
      const x = new Date(d)
      if (timeframe === "days") x.setUTCDate(x.getUTCDate() - back)
      else if (timeframe === "weeks") x.setUTCDate(x.getUTCDate() - back * 7)
      else if (timeframe === "months") x.setUTCMonth(x.getUTCMonth() - back)
      else x.setUTCFullYear(x.getUTCFullYear() - back)
      return x
    }
    const end = new Date(`${lastBucket}T00:00:00Z`)
    for (let k = WEEK_COUNT - 1; k >= 0; k--) weeks.push(step(end, k).toISOString().slice(0, 10))
  }
  const weekIndex = new Map(weeks.map((w, i) => [w, i]))

  const types = Object.fromEntries(PAGE_TYPES.map((t) => [t, emptySeries()])) as Record<PageType, Series>
  for (const r of rows) {
    const idx = weekIndex.get(r.bucket_start)
    const t = r.page_type as PageType
    if (idx == null || !types[t]) continue
    types[t].u[idx] = Number(r.urls) || 0
    types[t].i[idx] = Number(r.impressions) || 0
    types[t].c[idx] = Number(r.clicks) || 0
    types[t].p[idx] = r.avg_position != null ? Number(r.avg_position) : null
    types[t].i10[idx] = Number(r.impressions_top10) || 0
  }

  // ── noemer van % Ranked ───────────────────────────────────────
  // Alleen de nieuwste momentopname: oudere staan er voor later, maar
  // de reeks hiernaast is op dit moment nog tegen de stand van vandaag
  // gerekend. Dat is een onderschatting voor de vroege weken, en het
  // staat zo in de voetnoot van de tabel.
  const published: Partial<Record<PageType, number>> = {}
  const sitemapRows = (sitemap.data ?? []) as unknown as SitemapRow[]
  const newest = sitemapRows[0]?.snapshot_date
  for (const r of sitemapRows) {
    if (r.snapshot_date !== newest) continue
    published[r.page_type as PageType] = r.url_count
  }

  // ── tabellen ──────────────────────────────────────────────────
  const sides = ["all", "pro", "project", "arco"]
  const queryResults = await Promise.all(
    sides.map((side) =>
      db.rpc<TopQueryRow>("seo_top_queries", { day_count: 28, types: typesForSide(side), row_limit: 10 }),
    ),
  )
  const queries: Record<string, QueryRow[]> = {}
  sides.forEach((side, n) => {
    queries[side] = (queryResults[n].data ?? []).map((r) => ({
      query: r.query,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      position: r.avg_position != null ? Number(r.avg_position) : null,
    }))
  })

  const pages: PageRow[] = (topPages.data ?? []).map((r) => {
    const t = r.page_type as PageType
    return {
      url: r.page_url,
      type: t,
      side: MARKET_SIDE[GROUP_OF[t] as PageGroup],
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      position: r.avg_position != null ? Number(r.avg_position) : null,
    }
  })

  const lastDate = (latest.data?.[0] as { metric_date?: string } | undefined)?.metric_date ?? null
  const staleDays = lastDate
    ? Math.round((Date.now() - new Date(`${lastDate}T00:00:00Z`).getTime()) / 86_400_000)
    : null

  return { timeframe, weeks, types, published, queries, pages, lastDate, staleDays }
}
