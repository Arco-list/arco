import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { sendTransactionalEmail, type EmailTemplate, type EmailVariables } from "@/lib/email-service"
import { logger } from "@/lib/logger"

/**
 * Drip queue cron — runs every 5 minutes via Vercel Cron.
 *
 * Pulls due rows from public.email_drip_queue and sends them via the
 * shared lib/email-service.ts. Same renderer as every other email path
 * (admin test send, manual prospect send, etc.) — single source of truth.
 *
 * ── History of this route ────────────────────────────────────────────────
 *
 * Originally this work lived in a Supabase Edge Function
 * (supabase/functions/process-drip-queue/index.ts) called by pg_cron via
 * `net.http_post()`. That setup never worked: pg_net was not installed on
 * the project, so every cron tick failed with `schema "net" does not
 * exist` for 11 days straight before anyone noticed (cron.job_run_details
 * showed 261 failed runs, 0 succeeded). When we discovered this we also
 * realised pg_net's fire-and-forget HTTP would have hidden Edge Function
 * errors from cron observability anyway.
 *
 * Replaced with Vercel Cron calling this route directly. Benefits over
 * the old design:
 *   - Failures show up in Vercel logs immediately, not in
 *     cron.job_run_details where nobody looks
 *   - Real HTTP responses with status codes, not fire-and-forget
 *   - 5-minute schedule (Pro tier) instead of pg_cron's effective hourly
 *   - Same observability story as the rest of the app
 *   - One source of truth: lib/email-service.ts called directly, not via
 *     an inter-route HTTP hop
 *
 * The Edge Function and the /api/internal/send-drip-email route it called
 * are both deleted in the same commit.
 *
 * ── Auth ────────────────────────────────────────────────────────────────
 *
 * Vercel Cron sends a header `Authorization: Bearer ${CRON_SECRET}`
 * matching the value in vercel.json's env. We compare against
 * process.env.CRON_SECRET. Anything else (including unauthenticated
 * external requests) gets a 401.
 *
 * ── Behaviour ───────────────────────────────────────────────────────────
 *
 * - Caps each tick at BATCH_LIMIT rows so a backlog doesn't burn the
 *   route's max-duration on a single invocation
 * - Sends CONCURRENCY rows in parallel via Promise.all
 * - Stops retrying a row once attempt_count >= MAX_ATTEMPTS — admin can
 *   reset it from /admin/emails (PR 5)
 * - Permanent failures (unknown template) cancel the row immediately with
 *   a clear cancelled_reason
 * - Transient failures (Resend rejection, network blip) increment
 *   attempt_count and store last_error; retried on the next tick
 * - Pre-fetches featured projects for `discover-projects` rows (the
 *   welcome series uses this pattern; the prospect series doesn't need it)
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60 // seconds; Vercel Pro allows up to 300

const BATCH_LIMIT = 50
const CONCURRENCY = 5
const MAX_ATTEMPTS = 3

type QueueRow = {
  id: string
  email: string
  template: string
  variables: Record<string, unknown> | null
  company_id: string | null
  // user_id: homeowner-series drips carry this; prospect-series drips
  // leave it null (no signed-up user yet). sendTransactionalEmail uses
  // whichever is present to resolve the recipient's preferred_language.
  user_id: string | null
  attempt_count: number
}

type SendOutcome = "sent" | "failed" | "cancelled"

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────
  const expected = process.env.CRON_SECRET
  if (!expected) {
    // NOTE: lib/logger.ts has signature (message, context?) — NOT
    // (component, message, context) like a lot of other call sites in
    // this repo. The "component" convention is sitewide tech debt; we
    // use the actual signature here so the structured data lands in
    // Vercel logs correctly. To filter for drip-queue logs in Vercel,
    // search for "cron-drip-queue" — it's in the message string.
    logger.error("cron-drip-queue: CRON_SECRET not set on the server")
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }
  const header = req.headers.get("authorization") ?? ""
  const provided = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()

  // ── Fetch due rows ─────────────────────────────────────────────────────
  const { data: dueEmails, error: fetchError } = await supabase
    .from("email_drip_queue")
    .select("id, email, template, variables, company_id, user_id, attempt_count")
    .lte("send_at", new Date().toISOString())
    .is("sent_at", null)
    .is("cancelled_at", null)
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("send_at", { ascending: true })
    .limit(BATCH_LIMIT)

  if (fetchError) {
    logger.error("cron-drip-queue: Failed to fetch queue", { supabaseError: fetchError })
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const rows = (dueEmails ?? []) as QueueRow[]
  if (rows.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0, cancelled: 0 })
  }

  // ── Pre-fetch data that some templates need ────────────────────────────
  // discover-projects + welcome-homeowner both expect vars.projects with a
  // featured-projects list. welcome-homeowner additionally needs
  // vars.professionals with featured companies.
  //
  // The fetch helpers live in lib/email-featured-data.ts so the admin test
  // send path (sendTestEmail) can reuse them — this guarantees the admin
  // preview renders with the same data the real send will.
  const { fetchFeaturedProjectsForEmail, fetchFeaturedProfessionalsForEmail } = await import(
    "@/lib/email-featured-data"
  )
  type FeaturedProjectRow = Awaited<ReturnType<typeof fetchFeaturedProjectsForEmail>>[number]
  type FeaturedProfessionalRow = Awaited<ReturnType<typeof fetchFeaturedProfessionalsForEmail>>[number]

  let featuredProjects: FeaturedProjectRow[] | undefined
  let featuredProfessionals: FeaturedProfessionalRow[] | undefined

  const needsFeaturedProjects = rows.some(
    (r) => r.template === "discover-projects" || r.template === "welcome-homeowner",
  )
  const needsFeaturedProfessionals = rows.some((r) => r.template === "welcome-homeowner")

  if (needsFeaturedProjects) {
    // welcome-homeowner shows 4 cards (2x2); discover-projects shows 3.
    const limit = rows.some((r) => r.template === "welcome-homeowner") ? 4 : 3
    featuredProjects = await fetchFeaturedProjectsForEmail(limit)
  }

  if (needsFeaturedProfessionals) {
    featuredProfessionals = await fetchFeaturedProfessionalsForEmail()
  }

  // ── Process in concurrent batches ──────────────────────────────────────
  let sent = 0
  let failed = 0
  let cancelled = 0

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map((row) => sendOne(row, supabase, featuredProjects, featuredProfessionals)),
    )
    for (const r of results) {
      if (r === "sent") sent++
      else if (r === "failed") failed++
      else if (r === "cancelled") cancelled++
    }
  }

  return NextResponse.json({ processed: rows.length, sent, failed, cancelled })
}

async function sendOne(
  row: QueueRow,
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  featuredProjects?: import("@/lib/email-featured-data").FeaturedProject[],
  featuredProfessionals?: import("@/lib/email-featured-data").FeaturedProfessional[],
): Promise<SendOutcome> {
  // Inject cron-side data into variables where the template expects it.
  const variables: EmailVariables = { ...((row.variables as EmailVariables | null) ?? {}) }
  if (row.template === "discover-projects" && featuredProjects) {
    variables.projects = featuredProjects
  }
  if (row.template === "welcome-homeowner") {
    if (featuredProjects) variables.projects = featuredProjects
    if (featuredProfessionals) variables.professionals = featuredProfessionals
  }
  // Founding-ending is enqueued six months before it sends, and its
  // argument is "you have N projects on your page, afterwards you have
  // one". A count frozen at enqueue time would be the number they had
  // on day one, which for a company that used the period properly is
  // the least persuasive number available — and wrong besides.
  if (row.template === "founding-ending" && row.company_id) {
    const { count } = await supabase
      .from("project_professionals")
      .select("id", { count: "exact", head: true })
      .eq("company_id", row.company_id)
      .eq("status", "live_on_page")
    if (typeof count === "number") variables.live_count = count
  }

  // Sequence drips that target a company (prospect-* and the new
  // new-professional-*): row.email is a snapshot from enqueue time. If the
  // prospect's email was later corrected (admin edit, Apollo sync), we want
  // the current address. Homeowner-series untouched — the user_id already
  // anchors the recipient there.
  // Templates whose post-send book-keeping flips prospect counters
  // (emails_sent / delivered / last_email_sent_at) and writes a
  // prospect_events row. Includes the cron-fired Outreach intro
  // (auto-enrolled Apollo contacts) plus the existing followup/final
  // steps for every series.
  // The three subscription mails that are scheduled rather than
  // triggered. Deliberately outside every gate below: those exist to
  // stop a sales sequence once a prospect has moved on, and these go to
  // customers, where the only thing that stops them is the event they
  // warn about — which the scheduler clears at source.
  const SUBSCRIPTION_TEMPLATES = new Set([
    "renewal-reminder",
    "founding-ending",
    "payment-method-expiring",
  ])
  const COMPANY_SEQUENCE_TEMPLATES = new Set([
    "prospect-followup",
    "prospect-final",
    "new-professional-followup",
    "new-professional-final",
    "outreach-intro",
    "outreach-followup",
    "outreach-final",
    // Queue rows carry the abstract 'visitor-nudge'; the concrete
    // variant (invite/showcase/platform) is resolved at send below.
    "visitor-nudge",
    "verified-reminder",
    // Abstract too — resolves to owned-publisher / owned-contributor.
    "owned-welcome",
    // The Listed series (migration 237) — abstract, variants resolved
    // at send via lib/listed-mails.ts.
    "company-live",
    "listed-professionals",
    "listed-backlink",
  ])
  // Subset that triggers a status='prospect' → 'contacted' flip.
  // Currently only the Outreach intro fires through this cron (the
  // other intros are sent live by their start actions), but we keep
  // the set extensible so e.g. a future enqueued prospect-intro
  // path naturally advances status too.
  const INTRO_TEMPLATES = new Set([
    "outreach-intro",
    "prospect-intro",
    "new-professional-invite",
  ])
  // Subset that flips sequence_status='active' → 'finished' once the
  // last email of the series goes out — manual Pause / Finish / Restart
  // continue to override this since they update sequence_status
  // themselves and cancel any pending rows in the queue (so a -final
  // template only fires when the sequence actually ran to completion).
  const FINAL_TEMPLATES = new Set([
    "prospect-final",
    "new-professional-final",
    "outreach-final",
  ])
  // Stop-at-promotion: each claim-family sequence belongs to a funnel
  // stage, and a prospect who advanced past that stage must not keep
  // receiving it — the next stage's sequence takes over. Checked at
  // send time (like the token mint), so rows enqueued days ago respect
  // today's stage. Intros are not gated: they CREATE the contacted
  // stage. Values are the highest ladder index the template may send at.
  // 'unlisted' (claimed, page hidden — the company→prospect mirror
  // writes it) sits above owned: every ceiling below still cancels.
  const STAGE_LADDER = ["prospect", "contacted", "visitor", "verified", "owned", "unlisted", "active"]
  const STAGE_CEILING: Record<string, number> = {
    "prospect-followup": 1,
    "prospect-final": 1,
    "new-professional-followup": 1,
    "new-professional-final": 1,
    "outreach-followup": 1,
    "outreach-final": 1,
    "visitor-nudge": 2,
    "verified-reminder": 3,
    "owned-welcome": 4,
  }

  let recipient = row.email

  // Subscription mail is enqueued six to eleven months ahead — long
  // enough for a company to change hands. The address on the row is a
  // snapshot from the day it was scheduled; the person who has to act
  // on a renewal or a founding period is whoever owns the company on
  // the day it sends.
  if (SUBSCRIPTION_TEMPLATES.has(row.template) && row.company_id) {
    const { getSubscriptionRecipient } = await import("@/lib/subscriptions/notify")
    const current = await getSubscriptionRecipient(row.company_id)
    if (current?.email) recipient = current.email
  }

  if (COMPANY_SEQUENCE_TEMPLATES.has(row.template)) {
    // Re-lookup current email on the prospect row in case the admin
    // edited it after the drip was enqueued. company_id resolves
    // arco/invites prospects; Apollo (Outreach) often has company_id=null
    // so we fall back to email match for those.
    let lookup = supabase
      .from("prospects")
      .select("email, status, company_id")
      .limit(1)
    lookup = row.company_id
      ? lookup.eq("company_id", row.company_id)
      : lookup.ilike("email", row.email)
    const { data: prospect } = await lookup.maybeSingle()
    if (prospect?.email) recipient = prospect.email

    // Company gate: from Verified on the COMPANY is the source of
    // truth, so a verified/claimed company silences the series for
    // every contact at the firm — including colleagues whose own row
    // (rightly) still shows their outreach stage. The effective stage
    // is whichever is further: the contact's own, or the company's.
    const gateCompanyId = (prospect as { company_id?: string | null } | null)?.company_id ?? row.company_id ?? null
    let companyIdx = -1
    if (gateCompanyId) {
      const { data: gateCompany } = await supabase
        .from("companies")
        .select("status")
        .eq("id", gateCompanyId)
        .maybeSingle()
      const s = (gateCompany as { status?: string } | null)?.status
      companyIdx =
        s === "verified" ? STAGE_LADDER.indexOf("verified")
        : s === "owned" ? STAGE_LADDER.indexOf("owned")
        : s === "unlisted" ? STAGE_LADDER.indexOf("unlisted")
        : s === "listed" ? STAGE_LADDER.indexOf("active")
        : -1
    }

    const ceiling = STAGE_CEILING[row.template]
    const stageIdx = Math.max(
      prospect?.status ? STAGE_LADDER.indexOf(prospect.status) : -1,
      companyIdx,
    )
    if (ceiling !== undefined && stageIdx > ceiling) {
      const { error } = await supabase
        .from("email_drip_queue")
        .update({
          cancelled_at: new Date().toISOString(),
          cancelled_reason: "status_change",
        } as never)
        .eq("id", row.id)
      if (error) {
        logger.error("cron-drip-queue: Failed to cancel stage-advanced row", { rowId: row.id, supabaseError: error })
      }
      return "cancelled"
    }
  }

  // Homeowner-drip ↔ professional gate (mirror of the enqueue guard in
  // migration 236): the welcome series is client onboarding, so a user
  // who became a professional between enqueue and send — claimed a
  // company, or gained the type — gets the pro onboarding instead.
  // Cancels the whole remaining series in one sweep.
  const HOMEOWNER_TEMPLATES = new Set(["welcome-homeowner", "discover-projects", "find-professionals"])
  if (HOMEOWNER_TEMPLATES.has(row.template) && row.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_types")
      .eq("id", row.user_id)
      .maybeSingle()
    let isProfessional = ((profile?.user_types as string[] | null) ?? []).includes("professional")
    if (!isProfessional) {
      const { data: owned } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", row.user_id)
        .limit(1)
        .maybeSingle()
      isProfessional = Boolean(owned)
    }
    if (isProfessional) {
      const { error } = await supabase
        .from("email_drip_queue")
        .update({
          cancelled_at: new Date().toISOString(),
          cancelled_reason: "status_change",
        } as never)
        .eq("user_id", row.user_id)
        .eq("sequence", "homeowner-welcome")
        .is("sent_at", null)
        .is("cancelled_at", null)
      if (error) {
        logger.error("cron-drip-queue: Failed to cancel homeowner series for professional", { rowId: row.id, supabaseError: error })
      }
      return "cancelled"
    }
  }

  // Visitor-nudge: the variant (invite / showcase / platform copy) and
  // the funnel link are resolved NOW, not at enqueue — a credit that
  // appeared overnight upgrades the mail to the invite experience.
  let sendTemplate = row.template
  let resolutionError: string | null = null
  if (row.template === "visitor-nudge") {
    try {
      const { buildVisitorNudge } = await import("@/lib/visitor-nudge")
      const nudge = await buildVisitorNudge(row.company_id, recipient)
      sendTemplate = nudge.template
      Object.assign(variables, nudge.variables)
    } catch (err) {
      // Falls through to the shared failure path below: counted as a
      // transient failure (attempt_count++) and retried next tick.
      resolutionError = err instanceof Error ? err.message : "visitor-nudge resolution failed"
      logger.error("cron-drip-queue: visitor-nudge resolution failed", { rowId: row.id, error: resolutionError })
    }
  }

  // Verified-reminder: enrich with the company block (logo + city) the
  // same way buildVisitorNudge does, so the mail shows at a glance
  // which company it is about. Never fatal — without these vars the
  // badge degrades to the initial-letter icon + stored name.
  if (row.template === "verified-reminder" && row.company_id) {
    try {
      const { data: company } = await supabase
        .from("companies")
        .select("name, logo_url, city, primary_service:categories!companies_primary_service_id_fkey(slug)")
        .eq("id", row.company_id)
        .maybeSingle()
      if (company) {
        variables.company_name = variables.company_name || company.name || undefined
        variables.logo_url = company.logo_url ?? undefined
        variables.company_subtitle = company.city ?? undefined
        const svc = company.primary_service as { slug: string | null } | { slug: string | null }[] | null
        variables.service_slug = (Array.isArray(svc) ? svc[0]?.slug : svc?.slug) ?? undefined
      }
    } catch (err) {
      console.error("[process-drip-queue] verified-reminder enrichment failed", err)
    }
  }

  // Owned-reminder: only for claims that did NOT convert to Listed.
  // The company check is the source of truth (the prospect stage gate
  // above only catches it once the prospect row advanced to Active);
  // already live → the reminder has nothing to remind.
  if (row.template === "owned-welcome" && row.company_id) {
    const { data: ownedCompany } = await supabase
      .from("companies")
      .select("status")
      .eq("id", row.company_id)
      .maybeSingle()
    if (ownedCompany?.status === "listed") {
      const { error } = await supabase
        .from("email_drip_queue")
        .update({
          cancelled_at: new Date().toISOString(),
          cancelled_reason: "status_change",
        } as never)
        .eq("id", row.id)
      if (error) {
        logger.error("cron-drip-queue: Failed to cancel owned reminder for listed company", { rowId: row.id, supabaseError: error })
      }
      return "cancelled"
    }
  }

  // Listed series: publisher/contributor resolved NOW — a company that
  // published its own project between listing and send gets the
  // publisher framing. No stage gate: Listed is the top of the ladder.
  if (row.template === "company-live" || row.template === "listed-professionals" || row.template === "listed-backlink") {
    try {
      const { buildCompanyLive, buildListedProfessionals, buildListedBacklink } = await import("@/lib/listed-mails")
      const resolved = row.template === "company-live"
        ? await buildCompanyLive(row.company_id)
        : row.template === "listed-professionals"
          ? await buildListedProfessionals(row.company_id)
          : await buildListedBacklink(row.company_id)
      sendTemplate = resolved.template
      Object.assign(variables, resolved.variables)
    } catch (err) {
      resolutionError = err instanceof Error ? err.message : "listed-series resolution failed"
      logger.error("cron-drip-queue: listed-series resolution failed", { rowId: row.id, error: resolutionError })
    }
  }

  // Owned-reminder: the variant (publisher / contributor / invited) is
  // resolved NOW — a credit that arrived between claim and send turns
  // the mail into "accept your waiting credit".
  if (row.template === "owned-welcome") {
    try {
      const { buildOwnedWelcome } = await import("@/lib/owned-welcome")
      const welcome = await buildOwnedWelcome(row.company_id, recipient)
      sendTemplate = welcome.template
      Object.assign(variables, welcome.variables)
    } catch (err) {
      resolutionError = err instanceof Error ? err.message : "owned-welcome resolution failed"
      logger.error("cron-drip-queue: owned-welcome resolution failed", { rowId: row.id, error: resolutionError })
    }
  }

  // Claim-family templates get their funnel link minted AT SEND TIME,
  // not at enqueue: queue rows can be days old (or predate the funnel
  // entirely) and a stored URL would be stale or legacy. Fresh mint =
  // always-valid single-use token, channel resolved from live data.
  // On failure the stored variables stand — a legacy link still works.
  if (/^(prospect|new-professional|outreach|verified)-/.test(row.template)) {
    try {
      if (row.company_id) {
        const { resolveClaimChannel } = await import("@/lib/claim/resolve-channel")
        const { issueClaimToken } = await import("@/lib/claim/claim-token")
        const resolved = await resolveClaimChannel(row.company_id)
        const issued = await issueClaimToken({
          companyId: row.company_id,
          creditId: resolved.channel === "invite" ? resolved.creditId : null,
          email: recipient.toLowerCase(),
          channel: resolved.channel,
        })
        variables.claim_url = issued.url
        variables.ref_url = issued.url
      } else {
        // Apollo prospects without a companies row: the tokenless
        // platform funnel (search → verify → claim) is the landing.
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.arcolist.com"
        variables.ref_url = `${siteUrl}/claim`
      }
    } catch (err) {
      console.error("[process-drip-queue] claim token mint failed, using stored link", err)
    }
  }

  let result: { success: boolean; messageId?: string; message?: string }
  if (resolutionError) {
    result = { success: false, message: resolutionError }
  } else try {
    result = await sendTransactionalEmail(
      recipient,
      sendTemplate as EmailTemplate,
      variables,
      // Resolver reads whichever identifier the drip row carries.
      // Homeowner-series has user_id; prospect-series has company_id.
      { userId: row.user_id, companyId: row.company_id },
    )
  } catch (err) {
    // Unhandled throw from the renderer or Resend client. Treat as transient.
    result = {
      success: false,
      message: err instanceof Error ? err.message : "Unknown send error",
    }
  }

  if (result.success) {
    const { error } = await supabase
      .from("email_drip_queue")
      .update({
        sent_at: new Date().toISOString(),
        last_error: null,
        // Persist the Resend message id so the webhook can fan opens /
        // clicks back to this row (mirrors company_outreach.resend_message_id).
        resend_message_id: result.messageId ?? null,
        last_event_cached: 'sent',
        last_event_cached_at: new Date().toISOString(),
      } as never)
      .eq("id", row.id)
    if (error) {
      logger.error("cron-drip-queue: Failed to mark row sent", { rowId: row.id, supabaseError: error })
    }

    // Increment emails_sent + emails_delivered on the prospect row for
    // any sequence template, and log a prospect_events row so the
    // Sales details popup shows the send in Event History. Resolve by
    // company_id when set (arco / invites) or by email (Apollo /
    // Outreach contacts whose domain didn't match a companies row).
    //
    // Intro templates also flip prospects.status from 'prospect' to
    // 'contacted' on first send — this is the moment the contact has
    // actually been reached (auto-enrolled Apollo contacts sit at
    // 'prospect' until the cron fires their intro).
    if (COMPANY_SEQUENCE_TEMPLATES.has(row.template)) {
      let prospectQuery = supabase
        .from("prospects")
        .select("id, status, emails_sent, emails_delivered, sequence_status")
        .limit(1)
      prospectQuery = row.company_id
        ? prospectQuery.eq("company_id", row.company_id)
        : prospectQuery.ilike("email", recipient)
      const { data: prospect } = await prospectQuery.maybeSingle()
      if (prospect) {
        const updates: Record<string, unknown> = {
          emails_sent: (prospect.emails_sent ?? 0) + 1,
          emails_delivered: (prospect.emails_delivered ?? 0) + 1,
          last_email_sent_at: new Date().toISOString(),
        }
        if (INTRO_TEMPLATES.has(row.template) && prospect.status === "prospect") {
          updates.status = "contacted"
        }
        // The last email of the series just went out — flip the
        // sequence to 'finished' so the row leaves the active filter
        // on /admin/sales without admin needing to click Finish.
        // Skip when the sequence is already paused/finished/cancelled
        // (manual override beats auto-finish).
        if (
          FINAL_TEMPLATES.has(row.template)
          && prospect.sequence_status === "active"
        ) {
          updates.sequence_status = "finished"
        }
        await supabase
          .from("prospects")
          .update(updates)
          .eq("id", prospect.id)
        await supabase.from("prospect_events").insert({
          prospect_id: prospect.id,
          event_type: "email_sent",
          metadata: { template: row.template, email: recipient },
        })
      }
    }

    logger.info("cron-drip-queue: Sent", { template: row.template, email: recipient, messageId: result.messageId })
    return "sent"
  }

  // Permanent failure: template doesn't exist. Cancel immediately.
  const errorMessage = result.message ?? "Unknown send failure"
  const isPermanent = /not configured|not found/i.test(errorMessage)
  if (isPermanent) {
    const { error } = await supabase
      .from("email_drip_queue")
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_reason: "unknown_template",
        last_error: errorMessage,
      })
      .eq("id", row.id)
    if (error) {
      logger.error("cron-drip-queue: Failed to mark row cancelled", { rowId: row.id, supabaseError: error })
    }
    logger.warn("cron-drip-queue: Cancelled (unknown template)", { template: row.template, email: recipient, error: errorMessage })
    return "cancelled"
  }

  // Transient failure: increment, retry next tick. Cancel after MAX_ATTEMPTS.
  const nextAttempt = row.attempt_count + 1
  const willCancel = nextAttempt >= MAX_ATTEMPTS
  const update: Record<string, unknown> = {
    attempt_count: nextAttempt,
    last_error: errorMessage,
  }
  if (willCancel) {
    update.cancelled_at = new Date().toISOString()
    update.cancelled_reason = "max_attempts"
  }
  const { error } = await supabase
    .from("email_drip_queue")
    .update(update)
    .eq("id", row.id)
  if (error) {
    logger.error("cron-drip-queue: Failed to increment attempt", { rowId: row.id, supabaseError: error })
  }
  logger.warn(
    `cron-drip-queue: ${willCancel ? "Cancelled (max attempts)" : "Failed (will retry)"}`,
    {
      template: row.template,
      email: recipient,
      attempt: nextAttempt,
      maxAttempts: MAX_ATTEMPTS,
      error: errorMessage,
    },
  )
  return willCancel ? "cancelled" : "failed"
}
