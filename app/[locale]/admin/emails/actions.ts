'use server'

import { Resend } from 'resend'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Fetch every Resend email up to `maxEmails`, paginating via cursor.
 * Resend's `emails.list()` defaults to 20 results and caps at 100 per call;
 * without pagination the dashboard ceilings every "sends" count to that page
 * size and silently undercounts. We loop with `after` until either:
 *   - the cap is hit (default 1000),
 *   - the API runs out of pages (`has_more === false`), or
 *   - we cross the `sinceIso` cutoff (results come back newest-first, so the
 *     first email older than the cutoff means everything after it is too).
 */
async function fetchAllResendEmails(
  sinceIso?: string,
  maxEmails: number = 1000,
): Promise<any[]> {
  const out: any[] = []
  let after: string | undefined
  // Resend caps each page at 100
  const pageSize = 100
  // Hard ceiling on loop iterations as a safety net
  const maxPages = Math.ceil(maxEmails / pageSize)

  for (let page = 0; page < maxPages; page++) {
    const opts: { limit: number; after?: string } = { limit: pageSize }
    if (after) opts.after = after
    const { data, error } = await resend.emails.list(opts)
    if (error) throw new Error(error.message)

    const rows = (data as any)?.data ?? []
    if (rows.length === 0) break

    let hitCutoff = false
    for (const row of rows) {
      if (sinceIso && row.created_at && new Date(row.created_at) < new Date(sinceIso)) {
        hitCutoff = true
        break
      }
      out.push(row)
      if (out.length >= maxEmails) break
    }

    if (hitCutoff) break
    if (out.length >= maxEmails) break
    if (!(data as any)?.has_more) break

    const lastId = rows[rows.length - 1]?.id
    if (!lastId) break
    after = lastId
  }

  return out
}

export type ResendEmail = {
  id: string
  from: string
  to: string[]
  subject: string
  created_at: string
  last_event: string
  templateId: string | null
  templateName: string | null
  /**
   * Language the email was sent in. Pulled from the Resend `locale`
   * tag that sendTransactionalEmail writes. Null for historical sends
   * that predate the tag (best-effort inferred from subject — see
   * inferLocaleFromSubject).
   */
  locale: 'nl' | 'en' | null
}

/**
 * Best-effort guess of the send locale for a Resend row that has no
 * `locale` tag (historical sends). Subject-string match against the
 * Dutch translations of the three client-welcome templates. Everything
 * else defaults to `en` since it was the default before PR #2.
 */
const DUTCH_SUBJECT_PATTERNS: RegExp[] = [
  // Welcome / drip series
  /^Welkom bij Arco$/i,
  /^Ontdek projecten op Arco$/i,
  /^Vind de juiste professional op Arco$/i,
  // Transactional Dutch variants (PR #4)
  /staat live op Arco$/i,
  /^Update over /i,
  /heeft je gecrediteerd op /i,
  /^Je bent uitgenodigd om lid te worden van /i,
  /is je Arco domein-verificatiecode$/i,
  /heeft een kennismaking aangevraagd op Arco$/i,
  // Dutch auth subjects
  /is je Arco-inlogcode/i,
  /^Inloggen bij Arco$/i,
  /is je Arco-verificatiecode/i,
  /^Bevestig je Arco-account/i,
  /^Wachtwoord herstellen$/i,
  /^Bevestig je nieuwe e-mailadres$/i,
  /^Je bent uitgenodigd voor Arco$/i,
  // Dutch prospect subject patterns. English variants ("A stage for X",
  // "X on Arco", "Claim X on Arco") fall through to the EN default,
  // which is correct for them.
  /^Een podium voor /i,
  /op Arco$/i,
  /^Claim .* op Arco$/i,
]
function inferLocaleFromSubject(subject: string): 'nl' | 'en' {
  return DUTCH_SUBJECT_PATTERNS.some((re) => re.test(subject)) ? 'nl' : 'en'
}

function extractTag(
  tags: unknown,
  name: string,
): string | null {
  if (!Array.isArray(tags)) return null
  for (const tag of tags) {
    if (tag && typeof tag === 'object' && (tag as { name?: unknown }).name === name) {
      const value = (tag as { value?: unknown }).value
      return typeof value === 'string' ? value : null
    }
  }
  return null
}

/**
 * Display name per template id. Used when the Resend `template` tag
 * identifies the send — subject regex fallback carries its own name in
 * SUBJECT_TO_TEMPLATE, but the tag path is authoritative and shouldn't
 * have to round-trip through the regex map just to recover a label.
 *
 * Keep in sync with INITIAL_TEMPLATES in page.tsx — any new template
 * added there needs a row here too, otherwise the sent-emails tab will
 * show the raw id instead of a human name.
 */
const TEMPLATE_ID_TO_NAME: Record<string, string> = {
  "domain-verification": "Domain Verification",
  "professional-invite": "Professional Invite",
  "team-invite": "Team Invite",
  "project-live": "Project Live",
  "project-rejected": "Project Rejected",
  "introduction-request": "Introduction Request",
  "welcome-homeowner": "Welcome",
  "discover-projects": "Discover Projects",
  "find-professionals": "Find Professionals",
  "prospect-intro": "Prospect Intro",
  "prospect-followup": "Prospect Follow-up",
  "prospect-final": "Prospect Final",
  "new-professional-invite": "New Professional Invite",
  "new-professional-followup": "New Professional Follow-up",
  "new-professional-final": "New Professional Final",
}

const SUBJECT_TO_TEMPLATE: [RegExp, string, string][] = [
  // Auth templates — EN + NL
  [/is your Arco sign-in code/i, "magic-link", "Sign-in Code"],
  [/is je Arco-inlogcode/i, "magic-link", "Sign-in Code"],
  [/^Sign in to Arco$/i, "magic-link", "Sign-in Code"],
  [/^Inloggen bij Arco$/i, "magic-link", "Sign-in Code"],
  [/is your Arco verification code/i, "signup", "Signup Confirmation"],
  [/is je Arco-verificatiecode/i, "signup", "Signup Confirmation"],
  [/Confirm your Arco account/i, "signup", "Signup Confirmation"],
  [/Bevestig je Arco-account/i, "signup", "Signup Confirmation"],
  [/Reset your Arco password/i, "password-reset", "Password Reset"],
  [/^Wachtwoord herstellen$/i, "password-reset", "Password Reset"],
  // Email change — EN + NL
  [/^Confirm your new email address$/i, "email-change", "Email Change"],
  [/^Bevestig je nieuwe e-mailadres$/i, "email-change", "Email Change"],
  // Auth invite — EN + NL
  [/^You're invited to Arco$/i, "auth-invite", "Auth Invite"],
  [/^Je bent uitgenodigd voor Arco$/i, "auth-invite", "Auth Invite"],
  // Domain verification — EN + NL
  [/is your Arco domain verification code/i, "domain-verification", "Domain Verification"],
  [/Verify your domain/i, "domain-verification", "Domain Verification"],
  [/is je Arco domein-verificatiecode$/i, "domain-verification", "Domain Verification"],
  // Professional invite — EN + NL. NL pattern must come before the
  // prospect "op Arco" catch-all below.
  [/credited you on/i, "professional-invite", "Professional Invite"],
  [/heeft je gecrediteerd op /i, "professional-invite", "Professional Invite"],
  // Team invite — EN + NL
  [/invited to join.*on Arco/i, "team-invite", "Team Invite"],
  [/^Je bent uitgenodigd om lid te worden van /i, "team-invite", "Team Invite"],
  // Project live — EN + NL. NL is end-anchored to avoid colliding with
  // the generic "op Arco" catch-all for prospect-followup below.
  [/is now live on Arco/i, "project-live", "Project Live"],
  [/staat live op Arco$/i, "project-live", "Project Live"],
  // Project rejected — EN + NL
  [/^Update on /i, "project-rejected", "Project Rejected"],
  [/^Update over /i, "project-rejected", "Project Rejected"],
  // Introduction request — EN + NL
  [/requested an introduction on Arco$/i, "introduction-request", "Introduction Request"],
  [/heeft een kennismaking aangevraagd op Arco$/i, "introduction-request", "Introduction Request"],
  // Welcome / drip series (PR #2)
  [/^Welcome to Arco$/i, "welcome-homeowner", "Welcome"],
  [/^Welkom bij Arco$/i, "welcome-homeowner", "Welcome"],
  [/Discover projects on Arco/i, "discover-projects", "Discover Projects"],
  [/Ontdek projecten op Arco/i, "discover-projects", "Discover Projects"],
  [/Find the right professional/i, "find-professionals", "Find Professionals"],
  [/Vind de juiste professional op Arco/i, "find-professionals", "Find Professionals"],
  // Prospect series (PR #3)
  [/Een podium voor/i, "prospect-intro", "Prospect Intro"],
  [/^A stage for /i, "prospect-intro", "Prospect Intro"],
  // Both prospect followup and final end in "op Arco" / "on Arco". Final
  // has the distinguishing "Claim …" prefix and MUST be matched first,
  // otherwise the followup's end-anchored pattern would swallow it.
  // Sequence is first-match-wins via matchTemplate().
  [/^Claim .* op Arco$/i, "prospect-final", "Prospect Final"],
  [/^Claim .* on Arco$/i, "prospect-final", "Prospect Final"],
  [/op Arco$/i, "prospect-followup", "Prospect Follow-up"],
  [/ on Arco$/i, "prospect-followup", "Prospect Follow-up"],
]

function matchTemplate(subject: string): { id: string; name: string } | null {
  for (const [pattern, id, name] of SUBJECT_TO_TEMPLATE) {
    if (pattern.test(subject)) return { id, name }
  }
  return null
}

/**
 * Resolve the template id + display name for a Resend row. Prefers the
 * `template` tag that sendTransactionalEmail writes on every send, because
 * subject regex is ambiguous — e.g. both the claimed-company `professional-invite`
 * and the unclaimed `new-professional-invite` render `"X credited you on Arco"`,
 * and the Dutch new-professional-invite subject ends in `"op Arco"` which
 * the prospect-followup catch-all would otherwise swallow. Falls back to
 * subject regex for historical sends that predate the tag.
 */
function resolveTemplate(subject: string, tags: unknown): { id: string; name: string } | null {
  const tagTemplate = extractTag(tags, 'template')
  if (tagTemplate && TEMPLATE_ID_TO_NAME[tagTemplate]) {
    return { id: tagTemplate, name: TEMPLATE_ID_TO_NAME[tagTemplate] }
  }
  return matchTemplate(subject)
}

export async function fetchRecentEmails(): Promise<{ emails: ResendEmail[]; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { emails: [], error: 'RESEND_API_KEY not configured' }
  }

  try {
    // Surface up to ~500 most recent emails on the recent-emails tab.
    // The previous default of 20 hid almost everything.
    const rows = await fetchAllResendEmails(undefined, 500)

    const emails: ResendEmail[] = rows.map((e: any) => {
      const subject: string = e.subject ?? ''
      const tagLocale = extractTag(e.tags, 'locale')
      const locale: ResendEmail['locale'] =
        tagLocale === 'nl' || tagLocale === 'en'
          ? tagLocale
          : inferLocaleFromSubject(subject)
      const template = resolveTemplate(subject, e.tags)
      return {
        id: e.id,
        from: e.from,
        to: Array.isArray(e.to) ? e.to : [e.to],
        subject,
        created_at: e.created_at,
        last_event: e.last_event ?? 'sent',
        templateId: template?.id ?? null,
        templateName: template?.name ?? null,
        locale,
      }
    })

    return { emails }
  } catch (err) {
    return { emails: [], error: err instanceof Error ? err.message : 'Failed to fetch emails' }
  }
}

export async function fetchEmailById(id: string): Promise<{ email: any; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { email: null, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await resend.emails.get(id)
    if (error) return { email: null, error: error.message }
    return { email: data }
  } catch (err) {
    return { email: null, error: err instanceof Error ? err.message : 'Failed to fetch email' }
  }
}

export type TemplateStats = {
  sends: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
}

export async function fetchTemplateStats(sinceDate?: string): Promise<{ stats: Record<string, TemplateStats>; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { stats: {}, error: 'RESEND_API_KEY not configured' }
  }

  try {
    // Pull up to ~1000 most recent emails (10 pages of 100). Previous
    // call was bounded by Resend's default of 20, which silently capped
    // every "sends" count.
    const rows = await fetchAllResendEmails(sinceDate, 1000)

    // Reuse SUBJECT_TO_TEMPLATE so stats and the sent-email list stay in
    // sync. Both ran independent copies of this map previously, which
    // drifted when PR #4 added Dutch transactional subjects.
    const stats: Record<string, TemplateStats> = {}

    for (const email of rows) {
      const subject = (email as any).subject ?? ""
      const event = (email as any).last_event ?? "sent"

      const templateId = resolveTemplate(subject, (email as any).tags)?.id ?? null
      if (!templateId) continue

      if (!stats[templateId]) {
        stats[templateId] = { sends: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }
      }
      stats[templateId].sends++
      if (event === "delivered" || event === "opened" || event === "clicked") stats[templateId].delivered++
      if (event === "opened" || event === "clicked") stats[templateId].opened++
      if (event === "clicked") stats[templateId].clicked++
      if (event === "bounced") stats[templateId].bounced++
    }

    // Override prospect-intro with the canonical count from company_outreach.
    // The intro is sent synchronously by sendProspectEmailAction, which logs
    // each send as a row in company_outreach with the resend_message_id.
    // Counting from that table is immune to Resend's pagination ceiling and
    // immune to subject-regex drift.
    //
    // Per-row delivery state lives in last_event_cached, populated live by
    // the Resend webhook. For rows where the cached state is terminal
    // (delivered/opened/clicked/bounced/complained) we use the cache and
    // skip the API call entirely. For rows that are still in-flight or
    // never got a webhook, we fall back to a sequential, rate-limited
    // resend.emails.get() and write the result back into the cache so the
    // next dashboard load gets it for free.
    try {
      const supabase = createServiceRoleSupabaseClient()
      let outreachQuery = supabase
        .from("company_outreach" as any)
        .select("id, resend_message_id, last_event_cached, created_at")
        .eq("template", "prospect_intro")
      if (sinceDate) outreachQuery = outreachQuery.gte("created_at", sinceDate)
      const { data: outreachRows, error: outreachError } = await outreachQuery

      if (!outreachError && outreachRows) {
        const rows = (outreachRows as any[]).filter(
          (r) => typeof r.resend_message_id === "string" && r.resend_message_id.length > 0,
        )

        const introStats: TemplateStats = {
          sends: (outreachRows as any[]).length,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
        }

        // Helper that maps a Resend last_event value into the four counters.
        const TERMINAL = new Set(["delivered", "opened", "clicked", "bounced", "complained", "failed"])
        const applyEvent = (event: string) => {
          const isFailure = event === "queued" || event === "bounced" || event === "complained" || event === "failed"
          if (!isFailure) introStats.delivered++
          if (event === "opened" || event === "clicked") introStats.opened++
          if (event === "clicked") introStats.clicked++
          if (event === "bounced") introStats.bounced++
        }

        // Split rows into "use cache" vs "needs fetch".
        const cacheHit: Array<{ event: string }> = []
        const needsFetch: Array<{ id: string; messageId: string }> = []
        for (const r of rows) {
          const cached = r.last_event_cached as string | null
          if (cached && TERMINAL.has(cached)) {
            cacheHit.push({ event: cached })
          } else {
            needsFetch.push({ id: r.id, messageId: r.resend_message_id })
          }
        }

        for (const { event } of cacheHit) applyEvent(event)

        // Sequential fetch with backoff for the remaining in-flight rows.
        // Resend's /emails/{id} caps around 2 RPS; previous parallel batches
        // were being silently rate-limited and dropping most of the count.
        const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

        const fetchOne = async (id: string): Promise<any | null> => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const res = await resend.emails.get(id)
              if (res?.error) {
                const statusCode = (res.error as { statusCode?: number }).statusCode
                if (statusCode && statusCode !== 429 && statusCode < 500) return null
                await sleep(500 * (attempt + 1))
                continue
              }
              return res
            } catch {
              await sleep(500 * (attempt + 1))
            }
          }
          return null
        }

        // Collect cache writes so we can flush them in a single update batch.
        const cacheUpdates: Array<{ outreachRowId: string; event: string }> = []

        for (const { id: outreachRowId, messageId } of needsFetch) {
          const r = await fetchOne(messageId)
          // 600ms gap = ~1.6 RPS
          await sleep(600)

          if (!r) continue
          const event = ((r.data as any)?.last_event ?? "sent") as string
          applyEvent(event)
          // Only persist terminal states — non-terminal sends are still
          // in flight and could change, no point pinning the cache.
          if (TERMINAL.has(event)) {
            cacheUpdates.push({ outreachRowId, event })
          }
        }

        // Flush cache writes (best-effort; failures are non-fatal).
        if (cacheUpdates.length > 0) {
          const nowIso = new Date().toISOString()
          await Promise.all(
            cacheUpdates.map(({ outreachRowId, event }) =>
              supabase
                .from("company_outreach" as any)
                .update({ last_event_cached: event, last_event_cached_at: nowIso })
                .eq("id", outreachRowId),
            ),
          )
        }

        console.log("[fetchTemplateStats] prospect-intro override:", {
          totalSends: introStats.sends,
          totalRows: rows.length,
          cacheHits: cacheHit.length,
          fetched: needsFetch.length,
          cacheWritesPersisted: cacheUpdates.length,
          computed: { delivered: introStats.delivered, opened: introStats.opened, clicked: introStats.clicked },
        })

        if (introStats.sends > 0) {
          stats["prospect-intro"] = introStats
        }
      }
    } catch {
      // Non-fatal: if the company_outreach lookup fails, fall back to the
      // subject-regex count we already computed above.
    }

    // Persist to cache so next page load is instant
    persistStatsCache(stats).catch(() => {})

    return { stats }
  } catch (err) {
    return { stats: {}, error: err instanceof Error ? err.message : 'Failed to fetch stats' }
  }
}

/**
 * Load cached email stats from Supabase. Returns instantly — no Resend
 * API calls. Used to render the dashboard immediately on page load.
 */
export async function fetchCachedStats(): Promise<{ stats: Record<string, TemplateStats>; cachedAt: string | null }> {
  try {
    const supabase = createServiceRoleSupabaseClient()
    const { data, error } = await supabase
      .from('email_stats_cache' as any)
      .select('template_id, sends, delivered, opened, clicked, bounced, cached_at')

    if (error || !data) return { stats: {}, cachedAt: null }

    const stats: Record<string, TemplateStats> = {}
    let latestCachedAt: string | null = null

    for (const row of data as any[]) {
      stats[row.template_id] = {
        sends: row.sends,
        delivered: row.delivered,
        opened: row.opened,
        clicked: row.clicked,
        bounced: row.bounced,
      }
      if (!latestCachedAt || row.cached_at > latestCachedAt) {
        latestCachedAt = row.cached_at
      }
    }

    return { stats, cachedAt: latestCachedAt }
  } catch {
    return { stats: {}, cachedAt: null }
  }
}

/**
 * Persist stats to the email_stats_cache table. Called after a fresh
 * fetch from Resend completes so the next page load can show data
 * instantly.
 */
async function persistStatsCache(stats: Record<string, TemplateStats>): Promise<void> {
  try {
    const supabase = createServiceRoleSupabaseClient()
    const now = new Date().toISOString()
    const rows = Object.entries(stats).map(([templateId, s]) => ({
      template_id: templateId,
      sends: s.sends,
      delivered: s.delivered,
      opened: s.opened,
      clicked: s.clicked,
      bounced: s.bounced,
      cached_at: now,
    }))

    // Upsert all rows in one call
    await supabase
      .from('email_stats_cache' as any)
      .upsert(rows, { onConflict: 'template_id' })
  } catch (err) {
    console.error('[persistStatsCache] Failed:', err)
  }
}

export async function sendTestEmail(template: string, toEmail: string): Promise<{ success: boolean; error?: string }> {
  const { sendTransactionalEmail } = await import('@/lib/email-service')

  // Test vars need to mirror what real production senders pass, otherwise
  // the rendered preview is misleading (e.g. company card without a hero
  // image, professional-invite without the inviting-company badge). Real
  // values borrowed from Marco van Veldhuizen — a prospected company in
  // production with a real logo + published project photo so the test
  // send looks like an actual send.
  const testVars: Record<string, any> = {
    firstname: 'Test',
    project_title: 'Sample Villa Project',
    project_name: 'Sample Villa Project',
    project_owner: 'Arco Test',
    project_location: 'Amsterdam, Netherlands',
    project_link: 'https://arcolist.com',
    dashboard_link: 'https://arcolist.com/dashboard',
    confirmUrl: 'https://arcolist.com',
    rejection_reason: 'This is a test rejection reason.',
    company_name: 'Marco van Veldhuizen',
    code: '123456',
    businessname: 'Marco van Veldhuizen',
    // Visual fields used by the prospect series (intro/followup/final)
    company_page_url: 'https://www.arcolist.com/professionals/marco-van-veldhuizen',
    claim_url: 'https://www.arcolist.com/businesses/professionals',
    company_subtitle: 'Architect · Oisterwijk',
    logo_url: 'https://ogvobdcrectqsegqrquz.supabase.co/storage/v1/object/public/company-assets/0b3b44d9-92aa-40e2-94e4-972038f8be50/logo/1774966489783-mvv.jpeg',
    hero_image_url: 'https://marcovanveldhuizen.nl/cms/wp-content/uploads/2022/12/04-min.jpg',
    // Visual field used by professional-invite + team-invite
    company_logo_url: 'https://ogvobdcrectqsegqrquz.supabase.co/storage/v1/object/public/company-assets/0b3b44d9-92aa-40e2-94e4-972038f8be50/logo/1774966489783-mvv.jpeg',
    // Inviter fields used by professional-invite + new-professional-* so
    // the test send renders the inviter badge identically to the preview.
    // Distinct from the recipient (Marco) so the email visually shows
    // two parties: inviter "Arco Test" → recipient "Marco van Veldhuizen".
    inviter_company_name: 'Arco Test',
    inviter_logo_url: null,
    inviter_subtitle: 'Architect · Amsterdam',
    inviter_page_url: 'https://www.arcolist.com/professionals',
  }

  // For templates that render live featured projects/professionals, pull
  // the same data the cron will use for the real send so the preview
  // matches reality. Admin test sends previously fell back to the static
  // hardcoded arrays in lib/email-service.ts, which could diverge from
  // what an actual welcome email would show.
  if (template === 'welcome-homeowner' || template === 'discover-projects') {
    try {
      const { fetchFeaturedProjectsForEmail, fetchFeaturedProfessionalsForEmail } = await import(
        '@/lib/email-featured-data'
      )
      const projectLimit = template === 'welcome-homeowner' ? 4 : 3
      const [projects, professionals] = await Promise.all([
        fetchFeaturedProjectsForEmail(projectLimit),
        template === 'welcome-homeowner'
          ? fetchFeaturedProfessionalsForEmail()
          : Promise.resolve([] as Awaited<ReturnType<typeof fetchFeaturedProfessionalsForEmail>>),
      ])
      if (projects.length > 0) testVars.projects = projects
      if (template === 'welcome-homeowner' && professionals.length > 0) {
        testVars.professionals = professionals
      }
    } catch (err) {
      // Non-fatal: if the featured-data lookup fails, the renderer falls
      // back to the hardcoded sample arrays so the preview still renders.
      console.error('[sendTestEmail] Failed to load featured data:', err)
    }
  }

  const result = await sendTransactionalEmail(toEmail, template as any, testVars)
  return { success: result.success, error: result.message }
}
