"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

// Mirror of the free-mail skip set used in syncPlatformProspects — we
// don't want every gmail.com sender to silently match the first
// gmail.com company in the DB. Same list, kept local to avoid a
// shared-helper migration that's overkill for this slice.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "hotmail.nl", "live.com", "live.nl",
  "yahoo.com", "yahoo.nl", "icloud.com", "me.com",
  "proton.me", "protonmail.com",
  "ziggo.nl", "kpn.nl", "kpnmail.nl", "planet.nl", "home.nl",
])

/** Normalise companies.domain or an email-host string to a comparable
 *  form: strip protocol, leading www, trailing slash, lowercase. */
function normaliseDomain(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
  return cleaned || null
}

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 0) return null
  return normaliseDomain(email.slice(at + 1))
}

export type InboundEmailStatus = "unread" | "read" | "replied" | "archived"

/**
 * Inbox tab key — drives the WHERE clause on inbound_emails.status.
 *
 *   active   — unread + read (the working inbox; default tab)
 *   replied  — admin already responded
 *   archived — admin dismissed without replying
 *   all      — everything (debug / search)
 */
export type InboundTab = "active" | "replied" | "archived" | "all"

export type InboundEmailRow = {
  id: string
  fromEmail: string
  fromName: string | null
  subject: string | null
  snippet: string | null
  receivedAt: string
  status: InboundEmailStatus
  prospectId: string | null
  prospectCompanyName: string | null
  prospectStatus: string | null
  prospectSequence: string | null
  prospectChannel: string | null
  /** Slug of the linked company when prospects.company_id resolves to a
   *  companies row — drives the deep-link from the From cell to the
   *  public professional page. Null when the prospect is unlinked
   *  (Apollo contacts pre-domain-match) or matched company has no slug. */
  companyId: string | null
  companySlug: string | null
}

export type InboundEmailDetail = InboundEmailRow & {
  threadId: string | null
  toEmails: string[]
  bodyHtml: string | null
  bodyText: string | null
  metadata: Record<string, unknown>
}

type FetchOpts = {
  tab?: InboundTab
  search?: string
  limit?: number
  offset?: number
}

export type FetchInboundResult = {
  emails: InboundEmailRow[]
  total: number
  unreadCount: number
}

/**
 * List inbound emails for the inbox table. Filters are post-WHERE on
 * status; the prospect join happens in JS to keep the query simple
 * (per-page row counts are <= 50, so a second IN-list lookup is fine).
 *
 * unreadCount is the badge counter on the Inbox tab — counted across
 * the whole table regardless of the active filter.
 */
export async function fetchInboundEmails(opts: FetchOpts = {}): Promise<FetchInboundResult> {
  const supabase = createServiceRoleSupabaseClient()
  const { tab = "active", search, limit = 50, offset = 0 } = opts

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("inbound_emails")
    .select(
      "id, from_email, from_name, subject, snippet, received_at, status, prospect_id",
      { count: "exact" },
    )
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (tab === "active") {
    query = query.in("status", ["unread", "read"])
  } else if (tab !== "all") {
    query = query.eq("status", tab)
  }

  if (search) {
    const escaped = search.replace(/[%_]/g, (c) => `\\${c}`)
    query = query.or(
      `from_email.ilike.%${escaped}%,from_name.ilike.%${escaped}%,subject.ilike.%${escaped}%,snippet.ilike.%${escaped}%`,
    )
  }

  const { data, count, error } = await query
  if (error) {
    console.error("[inbox] fetchInboundEmails failed", error)
    return { emails: [], total: 0, unreadCount: 0 }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[]
  const prospectIds = Array.from(
    new Set(rows.map((r) => r.prospect_id).filter((id): id is string => Boolean(id))),
  )
  type ProspectRow = {
    company_name: string | null
    status: string
    source: string
    sequence_status: string
    company_id: string | null
  }
  const prospectMap = new Map<string, ProspectRow>()
  if (prospectIds.length > 0) {
    const { data: prospects } = await supabase
      .from("prospects")
      .select("id, company_name, status, source, sequence_status, company_id")
      .in("id", prospectIds)
    for (const p of prospects ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = p as any
      prospectMap.set(row.id, {
        company_name: row.company_name,
        status: row.status,
        source: row.source,
        sequence_status: row.sequence_status,
        company_id: row.company_id,
      })
    }
  }

  // Companies — fetch claimed-company info for prospects that have a
  // company_id so the From cell can render the canonical company name
  // + slug instead of the (possibly stale) prospects.company_name string.
  const companyIds = Array.from(
    new Set(
      Array.from(prospectMap.values())
        .map((p) => p.company_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  const companyMap = new Map<string, { name: string; slug: string | null }>()
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, slug")
      .in("id", companyIds)
    for (const c of companies ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = c as any
      companyMap.set(row.id, { name: row.name, slug: row.slug ?? null })
    }
  }

  // Domain-based company fallback. When a row has no prospect, OR has
  // a prospect but no linked company_id, try to resolve the company
  // from the sender's email domain (skipping free-mail providers so a
  // gmail.com sender doesn't match the first gmail.com company by
  // accident). One extra companies query, runs only if any row needs it.
  const unmatchedDomains = new Set<string>()
  for (const r of rows) {
    const p = r.prospect_id ? prospectMap.get(r.prospect_id) : null
    if (p?.company_id) continue
    const dom = emailDomain(r.from_email)
    if (!dom || FREE_EMAIL_DOMAINS.has(dom)) continue
    unmatchedDomains.add(dom)
  }
  const domainCompanyMap = new Map<string, { id: string; name: string; slug: string | null }>()
  if (unmatchedDomains.size > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, slug, domain")
      .not("domain", "is", null)
    for (const c of companies ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = c as any
      const dom = normaliseDomain(row.domain)
      if (!dom || !unmatchedDomains.has(dom)) continue
      // Take the first hit per domain; multiple companies with the same
      // domain is rare but possible (scraper noise). Don't overwrite —
      // first-seen wins.
      if (!domainCompanyMap.has(dom)) {
        domainCompanyMap.set(dom, { id: row.id, name: row.name, slug: row.slug ?? null })
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: unreadCount } = await (supabase as any)
    .from("inbound_emails")
    .select("id", { count: "exact", head: true })
    .eq("status", "unread")

  const emails: InboundEmailRow[] = rows.map((r) => {
    const p = r.prospect_id ? prospectMap.get(r.prospect_id) : null
    const linkedCompany = p?.company_id ? companyMap.get(p.company_id) : null
    // Domain fallback: applies only when the prospect path didn't
    // resolve a company. Pills (sequence/channel) stay gated on
    // prospectId in the UI, so a domain-only match shows just the
    // company name without a sequence/channel pill — accurate signal.
    const dom = emailDomain(r.from_email)
    const domainMatch =
      !linkedCompany && !p?.company_name && dom && !FREE_EMAIL_DOMAINS.has(dom)
        ? domainCompanyMap.get(dom) ?? null
        : null
    const resolvedCompany = linkedCompany ?? domainMatch
    return {
      id: r.id,
      fromEmail: r.from_email,
      fromName: r.from_name,
      subject: r.subject,
      snippet: r.snippet,
      receivedAt: r.received_at,
      status: r.status,
      prospectId: r.prospect_id,
      prospectCompanyName: resolvedCompany?.name ?? p?.company_name ?? null,
      prospectStatus: p?.status ?? null,
      prospectSequence: p?.sequence_status ?? null,
      prospectChannel: p?.source ?? null,
      companyId: p?.company_id ?? domainMatch?.id ?? null,
      companySlug: resolvedCompany?.slug ?? null,
    }
  })

  return { emails, total: count ?? 0, unreadCount: unreadCount ?? 0 }
}

/**
 * Single inbound email with full body + prospect context. Used by the
 * detail popup. Marks the row as 'read' as a side effect when it was
 * 'unread' — same pattern as Gmail / most inbox UIs.
 */
export async function fetchInboundEmailDetail(id: string): Promise<InboundEmailDetail | null> {
  const supabase = createServiceRoleSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("inbound_emails")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any
  let prospect: {
    company_name: string | null
    status: string
    source: string
    sequence_status: string
    company_id: string | null
  } | null = null
  let linkedCompany: { id: string; name: string; slug: string | null } | null = null
  if (row.prospect_id) {
    const { data: p } = await supabase
      .from("prospects")
      .select("id, company_name, status, source, sequence_status, company_id")
      .eq("id", row.prospect_id)
      .maybeSingle()
    if (p) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pr = p as any
      prospect = {
        company_name: pr.company_name,
        status: pr.status,
        source: pr.source,
        sequence_status: pr.sequence_status,
        company_id: pr.company_id,
      }
      if (pr.company_id) {
        const { data: c } = await supabase
          .from("companies")
          .select("id, name, slug")
          .eq("id", pr.company_id)
          .maybeSingle()
        if (c) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const co = c as any
          linkedCompany = { id: co.id, name: co.name, slug: co.slug ?? null }
        }
      }
    }
  }

  // Domain fallback (same shape as fetchInboundEmails). Only fires
  // when the prospect path didn't resolve a company.
  let domainCompany: { id: string; name: string; slug: string | null } | null = null
  if (!linkedCompany && !prospect?.company_name) {
    const dom = emailDomain(row.from_email)
    if (dom && !FREE_EMAIL_DOMAINS.has(dom)) {
      const { data: candidates } = await supabase
        .from("companies")
        .select("id, name, slug, domain")
        .not("domain", "is", null)
      for (const c of candidates ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const co = c as any
        if (normaliseDomain(co.domain) === dom) {
          domainCompany = { id: co.id, name: co.name, slug: co.slug ?? null }
          break
        }
      }
    }
  }
  const resolvedCompany = linkedCompany ?? domainCompany

  // Mark as read — fire and forget. The eq("status", "unread") guard
  // makes this idempotent so re-opening already-read emails is a no-op.
  if (row.status === "unread") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any)
      .from("inbound_emails")
      .update({ status: "read", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "unread")
      .then(() => undefined)
  }

  return {
    id: row.id,
    fromEmail: row.from_email,
    fromName: row.from_name,
    subject: row.subject,
    snippet: row.snippet,
    receivedAt: row.received_at,
    status: row.status === "unread" ? "read" : row.status,
    prospectId: row.prospect_id,
    prospectCompanyName: resolvedCompany?.name ?? prospect?.company_name ?? null,
    prospectStatus: prospect?.status ?? null,
    prospectSequence: prospect?.sequence_status ?? null,
    prospectChannel: prospect?.source ?? null,
    companyId: prospect?.company_id ?? domainCompany?.id ?? null,
    companySlug: resolvedCompany?.slug ?? null,
    threadId: row.thread_id,
    toEmails: row.to_emails ?? [],
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    metadata: row.metadata ?? {},
  }
}

export async function archiveInboundEmail(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("inbound_emails")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function unarchiveInboundEmail(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("inbound_emails")
    .update({ status: "read", updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Drop a connected Gmail mailbox from /admin/inbox. Deletes the
 * gmail_connections row and best-effort revokes the refresh token at
 * Google so a stale browser session can't keep using it.
 *
 * inbound_emails rows previously synced through this mailbox stay
 * around — they're keyed on provider_message_id, not the connection,
 * and represent real history we don't want to lose. They'll continue
 * to show up under Archived / All on the inbox tabs.
 */
export async function disconnectGmailConnection(
  gmailAddress: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleSupabaseClient()

  // Pull the encrypted refresh token first so we can revoke at Google
  // before the row is gone. Best-effort — a failure here doesn't block
  // the local disconnect (the worst case is a stale token that no
  // longer maps to anything in our DB).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any)
    .from("gmail_connections")
    .select("refresh_token")
    .eq("gmail_address", gmailAddress)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteErr } = await (supabase as any)
    .from("gmail_connections")
    .delete()
    .eq("gmail_address", gmailAddress)

  if (deleteErr) return { success: false, error: deleteErr.message }

  if (row && (row as { refresh_token: string }).refresh_token) {
    try {
      const { decryptRefreshToken } = await import("@/lib/gmail/oauth")
      const refresh = decryptRefreshToken((row as { refresh_token: string }).refresh_token)
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    } catch (err) {
      console.error("[inbox] revoke after disconnect failed (non-fatal)", err)
    }
  }

  return { success: true }
}

export async function markInboundEmailUnread(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("inbound_emails")
    .update({ status: "unread", updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
