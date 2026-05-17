/**
 * One-way sync: Supabase -> Notion Outbound database.
 *
 * Two data sources:
 *   1. prospects (status in visitor/signup/company/active) — primary funnel
 *   2. companies (matched by domain to existing Notion rows that aren't in
 *      the prospect funnel) — the "Direct" channel
 *
 * Per-row rules (mirrors admin/sales + admin/professionals UX):
 *   - Visitor / Signup  -> use admin/sales (prospect) data
 *                          Owner = prospect.contact_name
 *                          Owner email = prospect.email
 *                          Owner phone = prospect.phone
 *                          Website = derived from email apex domain
 *                          Created = NULL unless the prospect has a linked
 *                                    company (then companies.created_at)
 *   - Draft / Listed    -> use admin/professionals (company + profile) data
 *                          Owner = profile.first_name + last_name
 *                          Owner email = auth.users.email
 *                          Owner phone = companies.phone
 *                          Website = companies.website
 *                          Created = companies.created_at
 *
 *   Arco page is set whenever a linked company exists
 *     (https://www.arcolist.com/en/professionals/<slug>).
 *
 *   Channel is derived from prospects.source for funnel rows
 *     (arco -> Showcase, invites -> Invite, apollo -> Outreach) and "Direct"
 *     for rows where a Website domain matches a company that isn't in the
 *     prospect funnel.
 *
 * Match strategy (Notion <-> platform): apex domain first, name second.
 * Existing manual fields in Notion (Contact status, Last contacted,
 * Scheduled, Notes) are NEVER overwritten by this sync.
 *
 * Throttled to ~3 req/s to stay inside Notion's free-tier rate limit.
 */
import { Client } from "@notionhq/client"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

type ProspectStatus = "visitor" | "signup" | "company" | "active"
type CompanyStatus =
  | "listed"
  | "unlisted"
  | "draft"
  | "deactivated"
  | "prospected"
  | "unclaimed"
  | "added"

type NotionStatus =
  | "Listed"
  | "unlisted"
  | "Draft"
  | "Visitor"
  | "Signup"
  | "Prospected"
  | "unclaimed"
  | "Deactivated"

type NotionChannel = "Showcase" | "Outreach" | "Invite" | "Direct"

type OutboundRow = {
  name: string
  status: NotionStatus
  channel: NotionChannel | null
  owner: string | null
  ownerEmail: string | null
  ownerPhone: string | null
  website: string | null
  arcoPage: string | null
  created: string | null // YYYY-MM-DD
}

const FREE_WEBMAIL = new Set([
  "gmail.com",
  "hotmail.com",
  "yahoo.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "gmx.com",
  "mail.com",
])

const PROSPECT_STATUS_TO_NOTION: Record<ProspectStatus, NotionStatus> = {
  visitor: "Visitor",
  signup: "Signup",
  company: "Draft",
  active: "Listed",
}

const COMPANY_STATUS_TO_NOTION: Record<CompanyStatus, NotionStatus> = {
  listed: "Listed",
  unlisted: "unlisted",
  draft: "Draft",
  deactivated: "Deactivated",
  prospected: "Prospected",
  unclaimed: "unclaimed",
  // Legacy: `added` was renamed to `unclaimed` in migration 128 but stays
  // in the enum as a tombstone — map it the same way in case any row
  // still references it.
  added: "unclaimed",
}

const PROSPECT_SOURCE_TO_CHANNEL: Record<string, NotionChannel> = {
  arco: "Showcase",
  invites: "Invite",
  apollo: "Outreach",
}

function notionClient() {
  const token = process.env.NOTION_API_KEY
  if (!token) throw new Error("NOTION_API_KEY not configured")
  if (!process.env.NOTION_OUTBOUND_DB_ID) throw new Error("NOTION_OUTBOUND_DB_ID not configured")
  return new Client({ auth: token })
}

function apexFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = String(url).trim()
  if (!trimmed) return null
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const host = new URL(withScheme).hostname.toLowerCase()
    return host.replace(/^www\./, "") || null
  } catch {
    return null
  }
}

function apexFromEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.indexOf("@")
  if (at < 0) return null
  const host = email.slice(at + 1).toLowerCase().trim()
  if (!host) return null
  return host.replace(/^www\./, "")
}

function deriveWebsiteFromEmail(email: string | null | undefined): string | null {
  const apex = apexFromEmail(email)
  if (!apex || FREE_WEBMAIL.has(apex)) return null
  return `https://${apex}`
}

function toDate(ts: string | null | undefined): string | null {
  if (!ts) return null
  return String(ts).slice(0, 10)
}

function arcoPageFor(slug: string | null | undefined): string | null {
  if (!slug) return null
  return `https://www.arcolist.com/en/professionals/${slug}`
}

type ProspectRow = {
  id: string
  status: ProspectStatus
  source: string | null
  email: string | null
  contact_name: string | null
  phone: string | null
  company_id: string | null
  company_name: string | null
  created_at: string | null
  last_email_sent_at: string | null
}

type CompanyRow = {
  id: string
  name: string | null
  website: string | null
  phone: string | null
  slug: string | null
  domain: string | null
  created_at: string | null
  owner_id: string | null
  status: CompanyStatus | null
}

async function loadProspectFunnel(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
): Promise<Map<string, OutboundRow & { domainKey: string | null; nameKey: string }>> {
  // Pull all prospects in the funnel statuses with their linked company
  // (when present) and the linked company's owner profile + auth email.
  // We use a service-role client to bypass RLS — admin-only flow.
  const { data: prospects, error: prospectError } = await supabase
    .from("prospects")
    .select(
      "id, status, source, email, contact_name, phone, company_id, company_name, created_at, last_email_sent_at",
    )
    .in("status", ["visitor", "signup", "company", "active"] satisfies ProspectStatus[])
  if (prospectError) throw new Error(`loadProspectFunnel.prospects: ${prospectError.message}`)
  const rawProspects = (prospects ?? []) as ProspectRow[]

  const companyIds = Array.from(
    new Set(rawProspects.map((p) => p.company_id).filter((x): x is string => Boolean(x))),
  )

  const companiesById = new Map<string, CompanyRow>()
  const profileById = new Map<string, { first_name: string | null; last_name: string | null }>()
  const ownerEmailById = new Map<string, string>()

  if (companyIds.length > 0) {
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, name, website, phone, slug, domain, created_at, owner_id, status")
      .in("id", companyIds)
    if (companiesError) throw new Error(`loadProspectFunnel.companies: ${companiesError.message}`)

    for (const c of companies ?? []) {
      const row = c as CompanyRow
      companiesById.set(row.id, row)
    }

    const ownerIds = Array.from(
      new Set(
        Array.from(companiesById.values())
          .map((c) => c.owner_id)
          .filter((x): x is string => Boolean(x)),
      ),
    )

    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", ownerIds)
      for (const p of profiles ?? []) {
        profileById.set((p as { id: string }).id, {
          first_name: (p as { first_name: string | null }).first_name,
          last_name: (p as { last_name: string | null }).last_name,
        })
      }
      // auth.users isn't reachable via PostgREST — pull individually via
      // the service role's admin API. ownerIds is small (typically <20).
      for (const id of ownerIds) {
        const { data } = await supabase.auth.admin.getUserById(id)
        const email = data?.user?.email
        if (email) ownerEmailById.set(id, email)
      }
    }
  }

  // Dedup prospects: group by (company_id OR lowercased company_name).
  // Primary contact = most recent last_email_sent_at, tiebreak created_at.
  const groups = new Map<string, ProspectRow[]>()
  for (const p of rawProspects) {
    const key = p.company_id ?? (p.company_name ?? "").trim().toLowerCase()
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(p)
    groups.set(key, list)
  }

  const out = new Map<string, OutboundRow & { domainKey: string | null; nameKey: string }>()
  for (const [groupKey, members] of groups) {
    members.sort((a, b) => {
      const at = a.last_email_sent_at ?? ""
      const bt = b.last_email_sent_at ?? ""
      if (at !== bt) return bt.localeCompare(at)
      return (b.created_at ?? "").localeCompare(a.created_at ?? "")
    })
    const primary = members[0]
    const company = primary.company_id ? companiesById.get(primary.company_id) : undefined
    const name = company?.name ?? primary.company_name ?? ""
    if (!name.trim()) continue

    const status = PROSPECT_STATUS_TO_NOTION[primary.status]
    const channel =
      primary.source && PROSPECT_SOURCE_TO_CHANNEL[primary.source]
        ? PROSPECT_SOURCE_TO_CHANNEL[primary.source]
        : null

    let row: OutboundRow
    if (primary.status === "visitor" || primary.status === "signup") {
      row = {
        name,
        status,
        channel,
        owner: primary.contact_name,
        ownerEmail: primary.email,
        ownerPhone: primary.phone,
        website: deriveWebsiteFromEmail(primary.email),
        arcoPage: arcoPageFor(company?.slug),
        created: toDate(company?.created_at),
      }
    } else {
      // Draft / Listed — admin/professionals data
      const profile = company?.owner_id ? profileById.get(company.owner_id) : undefined
      const ownerName = profile
        ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || null
        : null
      const ownerEmail =
        (company?.owner_id ? ownerEmailById.get(company.owner_id) : undefined) ?? primary.email
      row = {
        name,
        status,
        channel,
        owner: ownerName,
        ownerEmail,
        ownerPhone: company?.phone ?? null,
        website: company?.website ?? null,
        arcoPage: arcoPageFor(company?.slug),
        created: toDate(company?.created_at),
      }
    }

    const domainKey = apexFromUrl(row.website) ?? apexFromEmail(primary.email)
    const nameKey = name.trim().toLowerCase()
    out.set(groupKey, { ...row, domainKey, nameKey })
  }
  return out
}

type NotionPageMatch = {
  pageId: string
  name: string | null
  websiteDomain: string | null
  channel: string | null
}

async function fetchExistingNotionRows(notion: Client, dbId: string): Promise<NotionPageMatch[]> {
  const out: NotionPageMatch[] = []
  let cursor: string | undefined
  do {
    const r = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
      page_size: 100,
    })
    for (const page of r.results) {
      const props = (page as { properties?: Record<string, unknown> }).properties ?? {}
      const titleProp = props["Name"] as { title?: Array<{ plain_text?: string }> } | undefined
      const websiteProp = props["Website"] as { url?: string | null } | undefined
      const channelProp = props["Channel"] as { select?: { name?: string } | null } | undefined
      const name = titleProp?.title?.[0]?.plain_text?.trim() ?? null
      out.push({
        pageId: page.id,
        name,
        websiteDomain: apexFromUrl(websiteProp?.url),
        channel: channelProp?.select?.name ?? null,
      })
    }
    cursor = r.has_more ? r.next_cursor ?? undefined : undefined
  } while (cursor)
  return out
}

function buildNotionProperties(row: OutboundRow): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Name: { title: [{ text: { content: row.name.slice(0, 2000) } }] },
    Status: { select: { name: row.status } },
  }
  if (row.channel) props.Channel = { select: { name: row.channel } }
  // Use the literal `null` JSON token to *clear* fields where we have no
  // value — the call-list-sync pattern omits empties instead. We follow
  // the omit pattern here so existing values aren't accidentally erased
  // when a single sync run can't determine the field (e.g. an outage).
  if (row.owner) props.Owner = { rich_text: [{ text: { content: row.owner.slice(0, 2000) } }] }
  if (row.ownerEmail) props["Owner email"] = { email: row.ownerEmail }
  if (row.ownerPhone)
    props["Owner phone"] = { rich_text: [{ text: { content: row.ownerPhone.slice(0, 200) } }] }
  if (row.website && /^https?:\/\//i.test(row.website)) props.Website = { url: row.website }
  if (row.arcoPage) props["Arco page"] = { url: row.arcoPage }
  if (row.created) props.Created = { date: { start: row.created } }
  return props
}

async function lookupCompanyByDomain(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  domain: string,
): Promise<OutboundRow | null> {
  // Try exact domain match first, then a website ILIKE fallback for rows
  // whose domain column is www-prefixed or missing.
  const { data } = await supabase
    .from("companies")
    .select("id, name, status, website, phone, slug, created_at, owner_id")
    .or(`domain.eq.${domain},domain.eq.www.${domain},website.ilike.%${domain}%`)
    .limit(1)
  const company = (data ?? [])[0] as
    | {
        id: string
        name: string | null
        status: CompanyStatus | null
        website: string | null
        phone: string | null
        slug: string | null
        created_at: string | null
        owner_id: string | null
      }
    | undefined
  if (!company || !company.name) return null

  let owner: string | null = null
  let ownerEmail: string | null = null
  if (company.owner_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", company.owner_id)
      .maybeSingle()
    if (prof) {
      const name = [
        (prof as { first_name: string | null }).first_name,
        (prof as { last_name: string | null }).last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .trim()
      owner = name || null
    }
    const { data: authData } = await supabase.auth.admin.getUserById(company.owner_id)
    ownerEmail = authData?.user?.email ?? null
  }

  const status =
    company.status && COMPANY_STATUS_TO_NOTION[company.status]
      ? COMPANY_STATUS_TO_NOTION[company.status]
      : null
  if (!status) return null

  return {
    name: company.name,
    status,
    channel: "Direct",
    owner,
    ownerEmail,
    ownerPhone: company.phone,
    website: company.website,
    arcoPage: arcoPageFor(company.slug),
    created: toDate(company.created_at),
  }
}

export type OutboundSyncResult = {
  prospectsCount: number
  notionRowCount: number
  created: number
  updated: number
  directEnriched: number
  unmatchedNotionRows: number
  errors: number
  errorDetails: Array<{ company: string; err: string }>
}

export async function syncOutboundToNotion(): Promise<OutboundSyncResult> {
  const supabase = createServiceRoleSupabaseClient()
  const notion = notionClient()
  const dbId = process.env.NOTION_OUTBOUND_DB_ID!

  const [funnel, existing] = await Promise.all([
    loadProspectFunnel(supabase),
    fetchExistingNotionRows(notion, dbId),
  ])

  // Index existing Notion rows by domain and by name for matching.
  const byDomain = new Map<string, NotionPageMatch>()
  const byName = new Map<string, NotionPageMatch>()
  for (const r of existing) {
    if (r.websiteDomain) byDomain.set(r.websiteDomain, r)
    if (r.name) byName.set(r.name.toLowerCase(), r)
  }

  const matchedPageIds = new Set<string>()
  let created = 0
  let updated = 0
  let errors = 0
  const errorDetails: Array<{ company: string; err: string }> = []

  // Pass 1: prospect-driven funnel rows.
  for (const row of funnel.values()) {
    const match =
      (row.domainKey && byDomain.get(row.domainKey)) ||
      byName.get(row.nameKey) ||
      null
    try {
      if (match) {
        matchedPageIds.add(match.pageId)
        await notion.pages.update({
          page_id: match.pageId,
          properties: buildNotionProperties(row) as never,
        })
        updated++
      } else {
        await notion.pages.create({
          parent: { database_id: dbId },
          properties: buildNotionProperties(row) as never,
        })
        created++
      }
      await new Promise((r) => setTimeout(r, 350))
    } catch (err) {
      errors++
      const msg = err instanceof Error ? err.message : String(err)
      errorDetails.push({ company: row.name, err: msg })
      logger.error("[outbound-sync] row error", { company: row.name, err: msg })
    }
  }

  // Pass 2: Direct enrichment. For Notion rows the prospect funnel didn't
  // touch, if they have a Website domain that matches a company, fill the
  // row from admin/companies data and tag Channel=Direct.
  let directEnriched = 0
  let unmatchedNotionRows = 0
  for (const r of existing) {
    if (matchedPageIds.has(r.pageId)) continue
    if (!r.websiteDomain) {
      unmatchedNotionRows++
      continue
    }
    try {
      const enriched = await lookupCompanyByDomain(supabase, r.websiteDomain)
      if (!enriched) {
        unmatchedNotionRows++
        continue
      }
      await notion.pages.update({
        page_id: r.pageId,
        properties: buildNotionProperties(enriched) as never,
      })
      directEnriched++
      await new Promise((r) => setTimeout(r, 350))
    } catch (err) {
      errors++
      const msg = err instanceof Error ? err.message : String(err)
      errorDetails.push({ company: r.name ?? r.websiteDomain ?? r.pageId, err: msg })
      logger.error("[outbound-sync] direct enrich error", {
        page: r.pageId,
        domain: r.websiteDomain,
        err: msg,
      })
    }
  }

  return {
    prospectsCount: funnel.size,
    notionRowCount: existing.length,
    created,
    updated,
    directEnriched,
    unmatchedNotionRows,
    errors,
    errorDetails,
  }
}
