/**
 * One-way sync: Supabase → Notion Call list.
 *
 * Pulls the three Outbound Sales target segments (Apollo-sourced visitors,
 * organic drafts, contacted invites), upserts each as a row in the Notion
 * Call list (database id: NOTION_CALL_LIST_DB_ID).
 *
 * Dedup: by Company name (case-insensitive, trimmed). Manual rep-owned fields
 * (Outbound status, Notes, Touches, Last touch, Follow-up, ICP score, Status)
 * are NEVER written by this sync — only Supabase-controlled fields (Company,
 * Contact, Email, Created, Location, Phone, Website, Source). Rep edits are safe.
 *
 * Throttled to ~3 req/s to stay inside Notion's free-tier rate limit.
 */
import { Client } from "@notionhq/client"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

type Source = "Apollo" | "Organic" | "Invites" | "Arco"
type CallListRow = {
  company: string
  contact: string | null
  email: string | null
  created: string | null // ISO date or datetime
  location: string | null
  phone: string | null
  website: string | null
  source: Source
}

function notionClient() {
  const token = process.env.NOTION_API_KEY
  if (!token) throw new Error("NOTION_API_KEY not configured")
  if (!process.env.NOTION_CALL_LIST_DB_ID) throw new Error("NOTION_CALL_LIST_DB_ID not configured")
  return new Client({ auth: token })
}

function loc(city?: string | null, country?: string | null): string | null {
  return [city, country].filter(Boolean).join(", ") || null
}

async function fetchApolloRows(supabase: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<CallListRow[]> {
  // Apollo-sourced visitors: prospects with a recorded `/businesses` visit.
  const { data, error } = await supabase
    .from("prospects")
    .select("company_name, contact_name, email, phone, website, city, country, created_at, landing_visited_at")
    .not("landing_visited_at", "is", null)
    .not("company_name", "is", null)
    .order("landing_visited_at", { ascending: false })
  if (error) throw new Error(`fetchApolloRows: ${error.message}`)
  return (data ?? []).map(p => ({
    company: (p as any).company_name as string,
    contact: (p as any).contact_name as string | null,
    email: (p as any).email as string | null,
    created: ((p as any).created_at ?? (p as any).landing_visited_at) as string | null,
    location: loc((p as any).city, (p as any).country),
    phone: (p as any).phone as string | null,
    website: (p as any).website as string | null,
    source: "Apollo",
  }))
}

async function fetchOrganicDraftRows(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  apolloKeys: Set<string>,
): Promise<CallListRow[]> {
  // Organic drafts: companies in 'draft' status with an owner, NOT already
  // sourced from Apollo (dedup by domain or name).
  const { data, error } = await supabase
    .from("companies")
    .select("name, slug, domain, website, phone, email, city, country, owner_id, created_at, profiles:profiles!owner_id(first_name, last_name, email)")
    .eq("status", "draft")
    .not("owner_id", "is", null)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`fetchOrganicDraftRows: ${error.message}`)
  return (data ?? [])
    .filter((c: any) => {
      const dKey = (c.domain || c.website || "").toLowerCase().trim()
      const nKey = (c.name || "").toLowerCase().trim()
      return !(dKey && apolloKeys.has(dKey)) && !(nKey && apolloKeys.has(nKey))
    })
    .map((c: any) => {
      const owner = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
      const contact = owner ? [owner.first_name, owner.last_name].filter(Boolean).join(" ").trim() || null : null
      return {
        company: c.name as string,
        contact,
        email: (owner?.email as string | null) ?? (c.email as string | null) ?? null,
        created: c.created_at as string,
        location: loc(c.city, c.country),
        phone: c.phone as string | null,
        website: c.website as string | null,
        source: "Organic" as Source,
      }
    })
}

async function fetchInvitedRows(supabase: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<CallListRow[]> {
  // Contacted invites: project_professionals rows where someone was invited by
  // email but hasn't accepted (no professional_id yet, no responded_at).
  // One row per unique invited_email — the most recent invite wins.
  const { data, error } = await supabase
    .from("project_professionals")
    .select("invited_email, invited_at, status, professional_id, company_id, responded_at, companies:companies!company_id(name, website, phone, city, country, created_at)")
    .not("invited_email", "is", null)
    .is("professional_id", null)
    .is("responded_at", null)
    .order("invited_at", { ascending: false })
  if (error) throw new Error(`fetchInvitedRows: ${error.message}`)
  const byEmail = new Map<string, any>()
  for (const row of (data ?? [])) {
    const key = ((row as any).invited_email as string).toLowerCase()
    if (!byEmail.has(key)) byEmail.set(key, row)
  }
  return Array.from(byEmail.values()).map((r: any) => {
    const company = Array.isArray(r.companies) ? r.companies[0] : r.companies
    // No company name? Fall back to email domain so the rep at least has a label.
    const fallback = String(r.invited_email).split("@")[1] || String(r.invited_email)
    return {
      company: (company?.name as string | null) ?? fallback,
      contact: null,
      email: r.invited_email as string,
      created: (r.invited_at ?? company?.created_at ?? null) as string | null,
      location: loc(company?.city, company?.country),
      phone: (company?.phone as string | null) ?? null,
      website: (company?.website as string | null) ?? null,
      source: "Invites" as Source,
    }
  })
}

async function buildApolloKeySet(supabase: ReturnType<typeof createServiceRoleSupabaseClient>): Promise<Set<string>> {
  const { data } = await supabase
    .from("prospects")
    .select("website, company_name")
  const set = new Set<string>()
  for (const p of (data ?? [])) {
    const w = ((p as any).website as string | null)?.toLowerCase().trim()
    const n = ((p as any).company_name as string | null)?.toLowerCase().trim()
    if (w) set.add(w)
    if (n) set.add(n)
  }
  return set
}

async function fetchExistingNotionRows(notion: Client, dbId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let cursor: string | undefined
  do {
    const r = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
      page_size: 100,
    })
    for (const page of r.results) {
      const titleProp = (page as any).properties?.Company
      const title = titleProp?.title?.[0]?.plain_text?.trim().toLowerCase()
      if (title) map.set(title, page.id)
    }
    cursor = r.has_more ? (r.next_cursor ?? undefined) : undefined
  } while (cursor)
  return map
}

function buildProperties(row: CallListRow): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Company: { title: [{ text: { content: row.company.slice(0, 2000) } }] },
    Source: { select: { name: row.source } },
  }
  if (row.contact) props.Contact = { rich_text: [{ text: { content: row.contact.slice(0, 2000) } }] }
  if (row.email) props.Email = { email: row.email }
  if (row.created) props.Created = { date: { start: row.created.slice(0, 10) } }
  if (row.location) props.Location = { rich_text: [{ text: { content: row.location.slice(0, 2000) } }] }
  if (row.phone) props.Phone = { phone_number: row.phone }
  if (row.website && /^https?:\/\//i.test(row.website)) props.Website = { url: row.website }
  return props
}

export type CallListSyncResult = {
  total: number
  created: number
  updated: number
  skipped: number
  errors: number
  breakdown: { apollo: number; organicDrafts: number; invites: number }
}

export async function syncCallListToNotion(): Promise<CallListSyncResult> {
  const supabase = createServiceRoleSupabaseClient()
  const notion = notionClient()
  const dbId = process.env.NOTION_CALL_LIST_DB_ID!

  const apolloKeys = await buildApolloKeySet(supabase)
  const [apollo, organicDrafts, invites, existing] = await Promise.all([
    fetchApolloRows(supabase),
    fetchOrganicDraftRows(supabase, apolloKeys),
    fetchInvitedRows(supabase),
    fetchExistingNotionRows(notion, dbId),
  ])
  const all = [...apollo, ...organicDrafts, ...invites]

  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const row of all) {
    if (!row.company || !row.company.trim()) { skipped++; continue }
    const key = row.company.trim().toLowerCase()
    const existingId = existing.get(key)
    try {
      if (existingId) {
        await notion.pages.update({ page_id: existingId, properties: buildProperties(row) as any })
        updated++
      } else {
        await notion.pages.create({ parent: { database_id: dbId }, properties: buildProperties(row) as any })
        created++
      }
      // Throttle ~3 req/s — Notion free-tier rate limit is 3/s with bursts.
      await new Promise(r => setTimeout(r, 350))
    } catch (err) {
      errors++
      logger.error("[call-list-sync] row error", { company: row.company, source: row.source, err: String(err) })
    }
  }

  return {
    total: all.length,
    created,
    updated,
    skipped,
    errors,
    breakdown: { apollo: apollo.length, organicDrafts: organicDrafts.length, invites: invites.length },
  }
}
