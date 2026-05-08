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

  // Domain-based company fallback. Two passes for rows that didn't
  // resolve a company via direct prospect match:
  //
  //   Pass A (sales side): query prospects for any with an email at the
  //   same domain. Surfaces /admin/sales companies — sales-funnel
  //   entries that don't have a companies row yet but share a domain
  //   with the inbound sender. Carries the full funnel context (status,
  //   sequence, channel) so the inbox cell behaves like a real prospect
  //   match — just resolved by domain instead of exact email.
  //
  //   Pass B (marketplace side): for domains still unresolved after A,
  //   query companies.domain directly. Catches claimed marketplace
  //   companies that aren't in the sales funnel at all.
  //
  // Free-mail providers (gmail, outlook, etc.) are skipped so a
  // gmail.com sender doesn't accidentally pin to the first gmail.com
  // company in the DB.
  const unmatchedDomains = new Set<string>()
  for (const r of rows) {
    const p = r.prospect_id ? prospectMap.get(r.prospect_id) : null
    if (p?.company_id || p?.company_name) continue
    const dom = emailDomain(r.from_email)
    if (!dom || FREE_EMAIL_DOMAINS.has(dom)) continue
    unmatchedDomains.add(dom)
  }

  // Pass A — sales-side domain match via prospects
  type DomainProspectMatch = {
    company_name: string
    status: string
    source: string
    sequence_status: string
    company_id: string | null
  }
  const prospectsByDomain = new Map<string, DomainProspectMatch>()
  if (unmatchedDomains.size > 0) {
    const orFilter = Array.from(unmatchedDomains)
      .map((d) => `email.ilike.%@${d}`)
      .join(",")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: domainProspects } = await (supabase as any)
      .from("prospects")
      .select("email, company_name, status, source, sequence_status, company_id")
      .not("company_name", "is", null)
      .or(orFilter)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (domainProspects ?? []) as any[]) {
      const dom = emailDomain(p.email)
      // First-seen wins — multiple prospects per domain just pick one
      // representative. company_id-linked prospects are preferred since
      // they pull richer info from the companies table; otherwise any
      // prospect with company_name does.
      if (!dom || prospectsByDomain.has(dom)) continue
      prospectsByDomain.set(dom, {
        company_name: p.company_name,
        status: p.status,
        source: p.source,
        sequence_status: p.sequence_status,
        company_id: p.company_id,
      })
    }

    // Pull additional companies for domain-prospect matches that have
    // company_id set (so we get slug + canonical name) — extends the
    // existing companyMap rather than a parallel structure.
    const extraCompanyIds = Array.from(prospectsByDomain.values())
      .map((p) => p.company_id)
      .filter((id): id is string => Boolean(id) && !companyMap.has(id as string))
    if (extraCompanyIds.length > 0) {
      const { data: extras } = await supabase
        .from("companies")
        .select("id, name, slug")
        .in("id", extraCompanyIds)
      for (const c of extras ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = c as any
        companyMap.set(row.id, { name: row.name, slug: row.slug ?? null })
      }
    }
  }

  // Pass B — marketplace-side companies.domain for domains still
  // unmatched after A.
  const stillUnmatched = Array.from(unmatchedDomains).filter((d) => !prospectsByDomain.has(d))
  const domainCompanyMap = new Map<string, { id: string; name: string; slug: string | null }>()
  if (stillUnmatched.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, slug, domain")
      .not("domain", "is", null)
    for (const c of companies ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = c as any
      const dom = normaliseDomain(row.domain)
      if (!dom || !stillUnmatched.includes(dom)) continue
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

    // Resolution priority for unmatched-prospect rows:
    //   pass A: prospect-by-domain (sales funnel — full pills)
    //   pass B: companies-by-domain (claimed marketplace — name + slug only)
    const dom = emailDomain(r.from_email)
    const needsFallback =
      !linkedCompany && !p?.company_name && dom && !FREE_EMAIL_DOMAINS.has(dom)
    const prospectDomainMatch = needsFallback ? prospectsByDomain.get(dom!) ?? null : null
    const companyDomainMatch =
      needsFallback && !prospectDomainMatch
        ? domainCompanyMap.get(dom!) ?? null
        : null

    // Resolve the displayed company name, slug and id — prefer the
    // canonical companies row (linked or domain-matched) over free-text
    // prospect.company_name.
    const claimedFromProspectDomain = prospectDomainMatch?.company_id
      ? companyMap.get(prospectDomainMatch.company_id) ?? null
      : null
    const resolvedClaimedCompany =
      linkedCompany ?? claimedFromProspectDomain ?? companyDomainMatch
    const resolvedCompanyName =
      resolvedClaimedCompany?.name
      ?? p?.company_name
      ?? prospectDomainMatch?.company_name
      ?? null
    const resolvedCompanyId =
      p?.company_id
      ?? prospectDomainMatch?.company_id
      ?? companyDomainMatch?.id
      ?? null

    return {
      id: r.id,
      fromEmail: r.from_email,
      fromName: r.from_name,
      subject: r.subject,
      snippet: r.snippet,
      receivedAt: r.received_at,
      status: r.status,
      prospectId: r.prospect_id,
      prospectCompanyName: resolvedCompanyName,
      // Funnel context — direct prospect first, then domain-matched
      // prospect. companies-only matches stay null (no funnel context
      // to surface, which the UI uses to hide the pills).
      prospectStatus: p?.status ?? prospectDomainMatch?.status ?? null,
      prospectSequence: p?.sequence_status ?? prospectDomainMatch?.sequence_status ?? null,
      prospectChannel: p?.source ?? prospectDomainMatch?.source ?? null,
      companyId: resolvedCompanyId,
      companySlug: resolvedClaimedCompany?.slug ?? null,
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

  // Domain fallback — same two-pass shape as fetchInboundEmails:
  //   A. prospect-by-domain (sales funnel context, full pills)
  //   B. companies-by-domain (claimed marketplace, name + slug only)
  let domainProspect: {
    company_name: string
    status: string
    source: string
    sequence_status: string
    company_id: string | null
  } | null = null
  let claimedFromDomainProspect: { id: string; name: string; slug: string | null } | null = null
  let domainCompany: { id: string; name: string; slug: string | null } | null = null
  if (!linkedCompany && !prospect?.company_name) {
    const dom = emailDomain(row.from_email)
    if (dom && !FREE_EMAIL_DOMAINS.has(dom)) {
      // Pass A — any prospect with email at this domain that has a
      // company_name. Take the first hit; prefer ones with company_id
      // when there are multiple by sorting nulls last.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: domainProspects } = await (supabase as any)
        .from("prospects")
        .select("email, company_name, status, source, sequence_status, company_id")
        .ilike("email", `%@${dom}`)
        .not("company_name", "is", null)
        .order("company_id", { ascending: false, nullsFirst: false })
        .limit(1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dp = ((domainProspects ?? []) as any[])[0]
      if (dp) {
        domainProspect = {
          company_name: dp.company_name,
          status: dp.status,
          source: dp.source,
          sequence_status: dp.sequence_status,
          company_id: dp.company_id,
        }
        if (dp.company_id) {
          const { data: c } = await supabase
            .from("companies")
            .select("id, name, slug")
            .eq("id", dp.company_id)
            .maybeSingle()
          if (c) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const co = c as any
            claimedFromDomainProspect = { id: co.id, name: co.name, slug: co.slug ?? null }
          }
        }
      }

      // Pass B — only if A didn't resolve. Match against companies.domain.
      if (!domainProspect) {
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
  }
  const resolvedCompany = linkedCompany ?? claimedFromDomainProspect ?? domainCompany

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
    prospectCompanyName:
      resolvedCompany?.name
      ?? prospect?.company_name
      ?? domainProspect?.company_name
      ?? null,
    prospectStatus: prospect?.status ?? domainProspect?.status ?? null,
    prospectSequence: prospect?.sequence_status ?? domainProspect?.sequence_status ?? null,
    prospectChannel: prospect?.source ?? domainProspect?.source ?? null,
    companyId:
      prospect?.company_id
      ?? domainProspect?.company_id
      ?? domainCompany?.id
      ?? null,
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

/**
 * Generate (or return cached) AI draft reply for an inbound email.
 *
 * Uses Anthropic's API (claude-sonnet-4-6) with a system prompt
 * styled in Niek's voice — short, direct, founder-tone, language-
 * matched to the original email. Drafts are cached on
 * inbound_emails.ai_draft_text so re-opening the Respond popup
 * doesn't re-bill the model. Pass force=true to regenerate.
 *
 * Returns the draft text and the resolved reply locale ('nl' | 'en')
 * so the UI can show a small language indicator.
 */
export async function generateReplyDraft(
  id: string,
  opts: { force?: boolean } = {},
): Promise<{
  success: boolean
  draft?: string
  locale?: "nl" | "en"
  /** Full plain-text body of the original email so the Respond popup
   *  can render it under the "Show original" disclosure without a
   *  second roundtrip. Falls back to a stripped body_html when the
   *  text part is empty. */
  originalBody?: string
  error?: string
}> {
  const supabase = createServiceRoleSupabaseClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("inbound_emails")
    .select("id, from_email, from_name, subject, body_text, body_html, snippet, ai_draft_text, prospect_id")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return { success: false, error: error?.message ?? "Email not found" }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any

  // Plain-text body for the popup's "Show original" disclosure.
  // body_text is already parsed at sync time; if empty, fall back to
  // a tag-stripped body_html so we still surface something readable.
  const originalBody: string =
    (row.body_text as string | null)?.trim()
    || stripHtml((row.body_html as string | null) ?? "")
    || (row.snippet as string | null)
    || ""

  if (!opts.force && row.ai_draft_text) {
    return {
      success: true,
      draft: row.ai_draft_text,
      locale: detectLocale(row.subject, row.body_text),
      originalBody,
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: "ANTHROPIC_API_KEY not set" }
  }

  // Resolve a tiny prospect context block — helps the model write a
  // reply that's relevant to where they sit in the funnel.
  let prospectContext = ""
  if (row.prospect_id) {
    const { data: p } = await supabase
      .from("prospects")
      .select("company_name, status, source, sequence_status, last_email_sent_at")
      .eq("id", row.prospect_id)
      .maybeSingle()
    if (p) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pr = p as any
      prospectContext = [
        pr.company_name ? `Company: ${pr.company_name}` : null,
        pr.status ? `Funnel stage: ${pr.status}` : null,
        pr.source ? `Channel: ${pr.source} (arco=Showcase, invites=Invite, apollo=Outreach)` : null,
        pr.sequence_status ? `Drip sequence: ${pr.sequence_status}` : null,
        pr.last_email_sent_at ? `Last contacted: ${pr.last_email_sent_at}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    }
  }

  const locale = detectLocale(row.subject, row.body_text)
  const promptBody = (row.body_text || row.snippet || "").trim()
  const fromLabel = row.from_name?.trim() ? `${row.from_name} <${row.from_email}>` : row.from_email

  // Few-shot examples: the last N inbound emails Niek has personally
  // replied to. Pair each (original body) with (admin's actual reply
  // text) so the model picks up real voice, real tone, real formatting
  // from edited sends — not just the static system-prompt instructions.
  // Cheaper than RAG and updates organically every time Niek sends.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: examples } = await (supabase as any)
    .from("inbound_emails")
    .select("subject, from_name, from_email, body_text, snippet, replied_text")
    .not("replied_text", "is", null)
    .neq("id", id)
    .order("replied_at", { ascending: false })
    .limit(5)

  type FewShotExample = { userMsg: string; assistantMsg: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fewShot: FewShotExample[] = ((examples ?? []) as any[])
    .map((ex) => {
      const exFrom = ex.from_name?.trim() ? `${ex.from_name} <${ex.from_email}>` : ex.from_email
      const exBody = (ex.body_text || ex.snippet || "").toString().trim()
      const exReply = (ex.replied_text || "").toString().trim()
      if (!exBody || !exReply) return null
      // Cap each side to keep token usage bounded — replies are usually
      // short, but bodies can be long. ~2k chars ≈ 500 tokens.
      const cappedBody = exBody.length > 2000 ? exBody.slice(0, 2000) + "…" : exBody
      const cappedReply = exReply.length > 2000 ? exReply.slice(0, 2000) + "…" : exReply
      return {
        userMsg: [
          `From: ${exFrom}`,
          `Subject: ${ex.subject ?? "(no subject)"}`,
          "",
          "Original email:",
          cappedBody,
        ].join("\n"),
        assistantMsg: cappedReply,
      } as FewShotExample
    })
    .filter((x): x is FewShotExample => x !== null)

  const systemPrompt = [
    "You are Niek van Leeuwen, founder of Arco — a curated professional network for architects in the Netherlands.",
    "You're drafting a reply to an inbound email. Voice: friendly, direct, brief, founder-style. Short paragraphs. First person ('ik' or 'I').",
    "Sign off with just 'Niek' on its own line — no full name, no title.",
    `MATCH THE LANGUAGE OF THE ORIGINAL EMAIL. The detected language is ${locale === "nl" ? "Dutch (write in Dutch)" : "English (write in English)"}.`,
    "Don't include a subject line. Don't include greetings beyond the opener (e.g. 'Hi Marieke,'). Return only the reply body.",
    "If the email asks to be removed / unsubscribed, confirm warmly and offer no further pitch.",
    "If the email is positive interest, propose a clear next step (e.g. 'Hop on a 15-min call?' / 'Stuur ik je een uitnodiging?').",
    "If the email asks how Arco works, give a 2-3 sentence pitch then ask one focused follow-up question.",
    fewShot.length > 0
      ? `\nThe assistant turns below are real Niek-edited replies (newest first). Use them to ground the voice — don't copy phrasing verbatim, but match tone, length, and how Niek opens/closes.`
      : "",
  ]
    .filter(Boolean)
    .join("\n")

  const userMessage = [
    prospectContext ? `Sender context:\n${prospectContext}\n` : null,
    `From: ${fromLabel}`,
    `Subject: ${row.subject ?? "(no subject)"}`,
    "",
    "Original email:",
    promptBody || "(empty body — likely an auto-reply or read-receipt)",
  ]
    .filter((s) => s !== null)
    .join("\n")

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    // Compose the messages array as [user, assistant, user, assistant,
    // ..., user(current)] so Claude sees the few-shot pairs as a
    // conversational pattern and continues with an assistant turn.
    // Reverse fewShot so oldest examples come first — gives the model
    // a chronological sense of how recently they happened.
    const messages: { role: "user" | "assistant"; content: string }[] = []
    for (const ex of [...fewShot].reverse()) {
      messages.push({ role: "user", content: ex.userMsg })
      messages.push({ role: "assistant", content: ex.assistantMsg })
    }
    messages.push({ role: "user", content: userMessage })

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: systemPrompt,
      messages,
    })

    const draft = response.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("")
      .trim()

    if (!draft) return { success: false, error: "Model returned empty draft" }

    // Cache it so re-opening the popup doesn't re-bill.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("inbound_emails")
      .update({ ai_draft_text: draft, updated_at: new Date().toISOString() })
      .eq("id", id)

    return { success: true, draft, locale, originalBody }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate draft",
    }
  }
}

/** Strip HTML tags + collapse whitespace so a body_html-only email
 *  still renders as readable plain text in the Respond popup's
 *  "Show original" disclosure. Doesn't try to be smart about tables
 *  or styles — first-pass is just remove tags + decode common entities. */
function stripHtml(html: string): string {
  if (!html) return ""
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Send a reply via Gmail and mark the inbound email as 'replied'.
 * Subject defaults to "Re: <original>" (no double-prefix). Threading
 * uses the original Message-ID + threadId so the recipient's inbox
 * client groups the reply under the same conversation.
 */
export async function sendReply(
  id: string,
  bodyText: string,
): Promise<{ success: boolean; error?: string }> {
  if (!bodyText.trim()) {
    return { success: false, error: "Reply body is empty" }
  }
  const supabase = createServiceRoleSupabaseClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("inbound_emails")
    .select("id, from_email, subject, thread_id, metadata, prospect_id")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return { success: false, error: error?.message ?? "Email not found" }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any
  const replySubject = row.subject?.match(/^re:\s/i)
    ? row.subject
    : `Re: ${row.subject ?? ""}`

  const meta = (row.metadata ?? {}) as Record<string, unknown>
  const inReplyTo = (meta.messageId as string | null) ?? null
  const references = (meta.references as string | null) ?? inReplyTo

  try {
    const { sendGmailReply } = await import("@/lib/gmail/send")
    await sendGmailReply(supabase, {
      to: row.from_email,
      subject: replySubject,
      bodyText,
      threadId: row.thread_id ?? null,
      inReplyTo,
      references,
    })
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Send failed" }
  }

  const now = new Date().toISOString()
  // Persist the actually-sent body (post any admin edits) so future
  // generateReplyDraft calls can include it as a few-shot example —
  // the model learns Niek's voice from real edited replies, not just
  // the static system prompt.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("inbound_emails")
    .update({
      status: "replied",
      replied_at: now,
      replied_text: bodyText,
      updated_at: now,
    })
    .eq("id", id)

  // Log a prospect_events row when matched so the /admin/sales popup
  // timeline picks it up. Replies don't automatically cancel drips on
  // the *outbound* side because the recipient hasn't replied to *us* —
  // we replied to *them*. Their next reply will trigger the existing
  // sync-side cancellation path.
  if (row.prospect_id) {
    await supabase.from("prospect_events").insert({
      prospect_id: row.prospect_id,
      event_type: "admin_replied",
      metadata: { inbound_email_id: id, sent_at: now },
    })
  }

  return { success: true }
}

/** Heuristic language detection for AI draft + Send threading. */
function detectLocale(subject: string | null, body: string | null): "nl" | "en" {
  const text = `${subject ?? ""} ${body ?? ""}`.toLowerCase()
  // Common Dutch giveaways. Cheap regex, errs toward NL since most
  // outbound is to NL recipients — false-EN would feel more wrong.
  const dutch = /\b(de|het|een|niet|met|naar|voor|jouw|jullie|hartelijk|groet|bedankt|graag|even|maar|gaat|ben|heb|kan|zijn|maandag|dinsdag|woensdag|donderdag|vrijdag)\b/
  if (dutch.test(text)) return "nl"
  return "en"
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
