import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { getGscAccessToken, searchAnalyticsQuery, searchAnalyticsQueryAll, SITE_URL } from "@/lib/gsc/client"
import { classifyPageType, type SlugSets, type PageType } from "./page-types"

/**
 * Search Console ophalen op paginaniveau, en de indeling zelf maken.
 *
 * APART VAN syncGscIndexation, met reden. Die taak loopt per URL langs
 * de URL Inspection API — 274 adressen, ruim vier minuten — en de
 * Search Analytics-aanroepen stonden eráchter. Op 30 september werd de
 * lus langer dan de 300 seconden van Vercel, en sindsdien draaiden ze
 * niet meer: seo_daily_metrics stond stil en seo_query_metrics is nooit
 * gevuld. De cijfers horen niet achter de traagste aanroep van het
 * platform te staan, dus ze hebben nu een eigen cron.
 *
 * Één aanroep op date × page levert álles — ook de hubpagina's en de
 * overzichtspagina's, die in geen van de oude filters zaten en samen
 * 83% van de vertoningen bleken te dragen.
 */

/** Google rapporteert pas na ~2 dagen volledig; verder terug is stabiel. */
const LAG_DAYS = 2

async function loadSlugSets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<SlugSets> {
  const [{ data: companies }, { data: projects }] = await Promise.all([
    supabase.from("companies").select("slug").not("slug", "is", null).limit(10000),
    supabase.from("projects").select("slug").not("slug", "is", null).limit(10000),
  ])
  return {
    // ALLE bedrijven, niet alleen listed: een bedrijf dat vorige maand
    // listed was en nu niet meer heeft nog steeds vertoningen, en dat
    // blijft een bedrijfsprofiel. Zou de lijst alleen de huidige stand
    // bevatten, dan verhuisden oude rijen bij elke herberekening naar
    // 'proHub' en liep de historie stilletjes vol fouten.
    companies: new Set((companies ?? []).map((r: { slug: string }) => r.slug)),
    projects: new Set((projects ?? []).map((r: { slug: string }) => r.slug)),
  }
}

const fmt = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Search Console levert absolute URL's; wij bewaren het pad.
 *
 * Het domein is op elke rij hetzelfde en draagt niets bij — over een
 * backfill van 16 maanden is dat puur gewicht. De querystring blijft
 * staan: /projects?location=Amsterdam is een ander ding dan /projects,
 * en juist dat verschil is wat de restbak zichtbaar maakt.
 */
function toPath(url: string): string {
  return url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) || "/" : url
}

function defaultWindow(days: number): { startDate: string; endDate: string } {
  const end = new Date()
  end.setDate(end.getDate() - LAG_DAYS)
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return { startDate: fmt(start), endDate: fmt(end) }
}

/** Upsert in blokken — PostgREST struikelt over te grote payloads. */
async function upsertChunked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  chunk = 500,
): Promise<number> {
  let written = 0
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const { error } = await supabase.from(table).upsert(slice, { onConflict })
    if (error) throw new Error(`${table} upsert failed: ${error.message}`)
    written += slice.length
  }
  return written
}

export type PageSyncResult = { days: number; rows: number; truncated: boolean; start: string; end: string }

/**
 * date × page naar seo_page_metrics.
 *
 * Standaard 90 dagen; geef een bereik mee voor een backfill. Search
 * Console bewaart 16 maanden, dus de historie hoeft niet vanaf vandaag
 * opgebouwd te worden — dit is het enige cijfer op het platform dat we
 * met terugwerkende kracht kunnen ophalen.
 */
export async function syncSeoPageMetrics(range?: { startDate: string; endDate: string }): Promise<PageSyncResult> {
  const supabase = createServiceRoleSupabaseClient()
  const { startDate, endDate } = range ?? defaultWindow(90)
  const [token, slugs] = await Promise.all([getGscAccessToken(), loadSlugSets(supabase)])

  const { rows, truncated } = await searchAnalyticsQueryAll(token, {
    startDate,
    endDate,
    dimensions: ["date", "page"],
  })

  const out = rows
    .filter((r) => r.keys?.[0] && r.keys?.[1])
    .map((r) => ({
      metric_date: r.keys[0],
      page_url: toPath(r.keys[1]),
      page_type: classifyPageType(r.keys[1], slugs),
      impressions: Math.round(r.impressions ?? 0),
      clicks: Math.round(r.clicks ?? 0),
      position: r.position != null ? Number(r.position.toFixed(2)) : null,
    }))

  const written = await upsertChunked(supabase, "seo_page_metrics", out, "metric_date,page_url")
  const days = new Set(out.map((r) => r.metric_date)).size
  if (truncated) logger.warn("[seo-sync] page metrics hit the page cap", { startDate, endDate })
  return { days, rows: written, truncated, start: startDate, end: endDate }
}

export type QuerySyncResult = { rows: number; truncated: boolean }

/**
 * date × page × query naar seo_query_metrics, samengevat per paginatype.
 *
 * Migratie 275 liet de paginadimensie weg uit angst voor Googles
 * anonimiseringsdrempel. Gemeten klopt dat niet — page × query levert
 * 13,7% MEER vertoningen dan query alleen, omdat Google per dimensieset
 * anders ontdubbelt. De som hier ligt dus structureel hoger dan in
 * seo_page_metrics, en dat is het verwachte gedrag, geen fout.
 *
 * Venster korter dan de paginasync: drie dimensies vermenigvuldigen de
 * rijen, en de zoekopdrachtentabel kijkt toch maar 28 dagen terug.
 */
export async function syncSeoQueryMetrics(days = 45): Promise<QuerySyncResult> {
  const supabase = createServiceRoleSupabaseClient()
  const { startDate, endDate } = defaultWindow(days)
  const [token, slugs] = await Promise.all([getGscAccessToken(), loadSlugSets(supabase)])

  const { rows, truncated } = await searchAnalyticsQueryAll(token, {
    startDate,
    endDate,
    dimensions: ["date", "page", "query"],
  })

  // Meerdere pagina's van hetzelfde type op één zoekopdracht op één dag
  // vallen samen tot één rij: de tabel gaat over typen, niet over URL's.
  const agg = new Map<string, { metric_date: string; page_type: string; query: string; impressions: number; clicks: number; posSum: number }>()
  for (const r of rows) {
    const [date, page, query] = r.keys ?? []
    if (!date || !page || !query) continue
    const type = classifyPageType(page, slugs)
    const key = `${date}|${type}|${query}`
    const cur = agg.get(key) ?? { metric_date: date, page_type: type, query, impressions: 0, clicks: 0, posSum: 0 }
    cur.impressions += r.impressions ?? 0
    cur.clicks += r.clicks ?? 0
    cur.posSum += (r.position ?? 0) * (r.impressions ?? 0)
    agg.set(key, cur)
  }

  const out = [...agg.values()].map((a) => ({
    metric_date: a.metric_date,
    page_type: a.page_type,
    query: a.query,
    impressions: Math.round(a.impressions),
    clicks: Math.round(a.clicks),
    // Gewogen op vertoningen, want een gemiddelde van gemiddelden zou
    // een pagina met één vertoning even zwaar laten wegen.
    position: a.impressions ? Number((a.posSum / a.impressions).toFixed(2)) : null,
  }))

  const written = await upsertChunked(supabase, "seo_query_metrics", out, "metric_date,page_type,query")
  if (truncated) logger.warn("[seo-sync] query metrics hit the page cap", { startDate, endDate })
  return { rows: written, truncated }
}

export type SitemapSyncResult = { urls: number; types: number }

/**
 * Hoeveel URL's bieden we per type aan — de noemer van % Ranked.
 *
 * Uit onze eigen sitemap, want die is de enige plek die weet wat we
 * indexeerbaar aanbieden; een telling uit de tabellen zou de hubs
 * missen, precies de groep die het grootst blijkt. hreflang-varianten
 * tellen mee: Search Console rapporteert /nl/... en /en/... als twee
 * URL's, dus teller en noemer moeten hetzelfde tellen.
 */
export async function syncSitemapCounts(): Promise<SitemapSyncResult> {
  const supabase = createServiceRoleSupabaseClient()
  const slugs = await loadSlugSets(supabase)

  const res = await fetch(`${SITE_URL}/sitemap.xml`, { cache: "no-store" })
  if (!res.ok) throw new Error(`sitemap.xml ${res.status}`)
  const xml = await res.text()

  const urls = new Set<string>()
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(m[1].trim())
  // De hreflang-alternates staan als losse hrefs in de XML en zijn de
  // andere helft van wat we aanbieden.
  for (const m of xml.matchAll(/<xhtml:link[^>]*href="([^"]+)"/g)) urls.add(m[1].trim())
  // De kale "/" staat niet in de sitemap — die zet /nl als canonical —
  // maar Google rapporteert hem als eigen pagina (176 vertoningen, 33
  // klikken in september). Een pagina die we aanbieden zonder hem op te
  // schrijven, telt hier mee.
  urls.add(`${SITE_URL}/`)

  const counts = new Map<PageType, number>()
  for (const u of urls) {
    const t = classifyPageType(u, slugs)
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }

  const today = fmt(new Date())
  const rows = [...counts.entries()].map(([page_type, url_count]) => ({ snapshot_date: today, page_type, url_count }))
  await upsertChunked(supabase, "seo_sitemap_counts", rows, "snapshot_date,page_type")
  return { urls: urls.size, types: rows.length }
}

export type DailySyncResult = { scopes: number; days: number }

/**
 * De dagreeks per sitekant, verhuisd uit lib/gsc-sync.ts.
 *
 * Inhoudelijk ONGEWIJZIGD overgenomen, met opzet. Het groeidashboard
 * leest deze tabel rechtstreeks (table-actions.ts), en de scope-filters
 * hieronder tellen álle URL's die "/professionals/" bevatten — hubs
 * dus ook. Dat is iets anders dan de typen in seo_page_metrics, en het
 * ligt voor de hand om het gelijk te trekken, maar dan zouden de
 * dashboardcijfers met terugwerkende kracht verschuiven zonder dat
 * iemand daarom vroeg. Zolang beide tabellen bestaan telt deze wat hij
 * altijd telde; het gelijktrekken is een eigen beslissing, geen
 * bijvangst van een verhuizing.
 */
export async function syncSeoDailyMetrics(): Promise<DailySyncResult> {
  const supabase = createServiceRoleSupabaseClient()
  const token = await getGscAccessToken()
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - 480)

  const scopes = [
    { scope: "projects", pathContains: "/projects/" },
    { scope: "companies", pathContains: "/professionals/" },
  ]
  let totalDays = 0
  for (const { scope, pathContains } of scopes) {
    const rows = await searchAnalyticsQuery(token, {
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: ["date"],
      dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: pathContains }] }],
      rowLimit: 1000,
    })
    const out = rows
      .filter((r) => r.keys?.[0])
      .map((r) => ({
        metric_date: r.keys[0],
        scope,
        impressions: Math.round(r.impressions ?? 0),
        clicks: Math.round(r.clicks ?? 0),
      }))
    if (out.length > 0) {
      totalDays += await upsertChunked(supabase, "seo_daily_metrics", out, "metric_date,scope")
    }
  }
  return { scopes: scopes.length, days: totalDays }
}
