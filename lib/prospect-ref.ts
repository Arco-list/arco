import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { updateContactStage } from "@/lib/apollo-client";
import { syncCompanyToApollo } from "@/lib/company-apollo-sync";
import { logger } from "@/lib/logger";

/**
 * Status progression order for checking advancement.
 */
// The claim funnel flipped the order: the company step (step 1,
// "Created") completes BEFORE the account commit (step 2, "Signup").
const STATUS_ORDER = [
  "prospect",
  "contacted",
  "visitor",
  "verified",
  "owned",
  // Mirror of companies.status 'unlisted': claimed, was (or could be)
  // live, page currently hidden. Written only by the company→prospect
  // mirror (syncPlatformProspects step 4), never by the claim paths.
  "unlisted",
  "active",
] as const;

type ProspectStatus = (typeof STATUS_ORDER)[number];

function statusIndex(status: string): number {
  return STATUS_ORDER.indexOf(status as (typeof STATUS_ORDER)[number]);
}

function canAdvanceTo(
  currentStatus: string | null,
  newStatus: ProspectStatus
): boolean {
  const currentIdx = currentStatus ? statusIndex(currentStatus) : -1;
  const newIdx = statusIndex(newStatus);
  return newIdx > currentIdx;
}

/**
 * Request context for a landing visit, used to filter out corporate
 * mail scanners (Microsoft SafeLinks etc.) that open every mailed link
 * from a datacenter before the recipient ever sees the e-mail. Same
 * rule as NOT_MAIL_SCANNER in lib/growth-metric-cache.ts: a token/ref
 * hit from outside NL/BE is a scanner, not a prospect. A missing
 * header (local dev, non-Vercel) never blocks.
 */
export interface ProspectVisitContext {
  country?: string | null; // x-vercel-ip-country
  userAgent?: string | null;
}

const SCANNER_UA = /bot|crawl|spider|preview|scan|headless|python|curl|wget/i;

export function isLikelyMailScannerVisit(ctx: ProspectVisitContext): boolean {
  if (ctx.country && !["NL", "BE"].includes(ctx.country.toUpperCase())) return true;
  if (ctx.userAgent && SCANNER_UA.test(ctx.userAgent)) return true;
  return false;
}

/**
 * Track when a prospect visits the landing page via their ref param.
 * Supports both ref_code and apollo_contact_id lookups.
 * Updates landing_visited_at (if not already set) and advances status
 * to 'landing_visited' if appropriate.
 */
export async function trackProspectLandingVisit(
  refCode: string,
  ctx?: ProspectVisitContext
): Promise<void> {
  if (ctx && isLikelyMailScannerVisit(ctx)) {
    logger.debug("Ignoring likely mail-scanner landing visit", {
      refCode,
      country: ctx.country,
      userAgent: ctx.userAgent?.slice(0, 120),
    });
    return;
  }

  const supabase = createServiceRoleSupabaseClient();

  // Try email first (from Apollo {{email}} variable), then ref_code, then apollo_contact_id
  let { data: prospect, error } = await supabase
    .from("prospects")
    .select("id, email, company_name, status, landing_visited_at, apollo_contact_id, company_id")
    .eq("email", refCode.toLowerCase())
    .maybeSingle();

  if (!prospect) {
    const result = await supabase
      .from("prospects")
      .select("id, email, company_name, status, landing_visited_at, apollo_contact_id, company_id")
      .eq("ref_code", refCode)
      .maybeSingle();
    prospect = result.data;
    error = result.error;
  }

  if (!prospect) {
    const result = await supabase
      .from("prospects")
      .select("id, email, company_name, status, landing_visited_at, apollo_contact_id, company_id")
      .eq("apollo_contact_id", refCode)
      .maybeSingle();
    prospect = result.data;
    error = result.error;
  }

  if (error || !prospect) {
    logger.debug("No prospect found for ref code", { refCode });
    return;
  }

  const oldStatus = (prospect as any).status;
  const updates: Record<string, unknown> = {};

  // Only set landing_visited_at on first visit
  if (!(prospect as any).landing_visited_at) {
    updates.landing_visited_at = new Date().toISOString();
  }

  if (canAdvanceTo(oldStatus, "visitor")) {
    updates.status = "visitor";
  }

  // Nothing to update
  if (Object.keys(updates).length === 0) {
    logger.debug("Prospect already visited landing page", {
      refCode,
      prospectId: (prospect as any).id,
    });
    return;
  }

  await (supabase.from("prospects") as any)
    .update(updates)
    .eq("id", (prospect as any).id);

  // Log event
  const { error: eventError } = await supabase.from("prospect_events").insert({
    prospect_id: (prospect as any).id,
    event_type: "prospect.landing_visited",
    event_source: "app",
    old_status: oldStatus,
    new_status: (updates.status as string) ?? oldStatus,
    metadata: { refCode },
  } as any);

  if (eventError) {
    logger.error("Failed to log landing visit event", {
      prospectId: (prospect as any).id,
      error: eventError.message,
    });
  }

  logger.info("Tracked prospect landing visit", {
    prospectId: (prospect as any).id,
    refCode,
    statusAdvanced: !!updates.status,
  });

  // Visitor-nudge: one drip step, +1 business day after the funnel was
  // opened without a claim. Enqueued ONCE, on the transition into
  // Visitor (the ladder is forward-only, so this fires at most once per
  // prospect); the dedupe check guards the edge where an admin reset
  // the status. The queue row carries the abstract 'visitor-nudge' —
  // the copy variant and the funnel link are resolved at send time by
  // the drip cron, and the stage gate there cancels it if the prospect
  // reaches Verified before it fires.
  if (updates.status === "visitor") {
    try {
      await enqueueVisitorNudge(supabase, {
        email: (prospect as any).email as string | null,
        company_id: (prospect as any).company_id ?? null,
        company_name: (prospect as any).company_name ?? null,
      })
    } catch (err) {
      logger.error("Failed to enqueue visitor nudge", { prospectId: (prospect as any).id }, err as Error)
    }
  }

  // Sync Apollo stages if status advanced — contact stage directly,
  // account stage via the resolver (single owner of that field).
  if (updates.status) {
    const apolloContactId = (prospect as any).apollo_contact_id;
    if (apolloContactId) {
      try {
        await updateContactStage(apolloContactId, "Visitor");
      } catch (err) {
        logger.error("Failed to sync Apollo contact stage on landing visit", { apolloContactId }, err as Error);
      }
    }
    const companyId = (prospect as any).company_id;
    if (companyId) {
      try {
        await syncCompanyToApollo(companyId);
      } catch (err) {
        logger.error("Failed to sync Apollo account stage on landing visit", { companyId }, err as Error);
      }
    }
  }
}

/**
 * Advance a prospect to a funnel stage, stamped from the claim funnel:
 * 'verified' when the company step completes (step 1 of 2), 'owned'
 * when the commit lands (step 2 — account + claim). Forward-only via
 * the ladder; silently a no-op when no prospect matches.
 */
const APOLLO_STAGE_FOR: Record<string, string> = {
  visitor: "Visitor",
  verified: "Verified",
  owned: "Owned",
  active: "Listed",
};

// The contacted-series drips — everything a promotion past Contacted
// makes obsolete.
const CONTACTED_SERIES_TEMPLATES = [
  "outreach-intro", "outreach-followup", "outreach-final",
  "prospect-intro", "prospect-followup", "prospect-final",
  "new-professional-invite", "new-professional-followup", "new-professional-final",
];

/**
 * Schedule the one-step visitor-nudge (+1 business day) for a prospect
 * that just became a Visitor, first retiring the contacted-series
 * mails the visit outran. Shared by BOTH promotion paths — the
 * ref-code landing visit here and the email-click promotion in the
 * Resend webhook — so Visitor status always implies the visitor
 * sequence. The dedupe on any existing visitor-nudge row (sent or
 * cancelled) keeps it to at most one per address; the drip cron's
 * stage gate cancels it if the prospect reaches Verified first.
 */
export async function enqueueVisitorNudge(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  prospect: { email: string | null; company_id?: string | null; company_name?: string | null },
): Promise<void> {
  const email = prospect.email
  if (!email) return
  await cancelOvertakenDripRows(supabase, email, "visitor")
  // A contact who already wrote back is in a human conversation — the
  // nudge would read as a tone-deaf robot butting in. Same policy as
  // the reply-cancel, which retires the visitor-nudge too.
  const { data: replied } = await supabase
    .from("prospects")
    .select("id")
    .ilike("email", email)
    .not("replied_at", "is", null)
    .limit(1)
    .maybeSingle()
  if (replied) return
  const { data: existing } = await supabase
    .from("email_drip_queue")
    .select("id")
    .ilike("email", email)
    .eq("template", "visitor-nudge")
    .limit(1)
    .maybeSingle()
  if (existing) return
  const { nextBusinessSlot } = await import("@/lib/date-utils")
  await (supabase.from("email_drip_queue") as any).insert({
    email,
    template: "visitor-nudge",
    sequence: "visitor-nudge",
    company_id: prospect.company_id ?? null,
    send_at: nextBusinessSlot(1).toISOString(),
    variables: { company_name: prospect.company_name ?? undefined },
  })
}

/**
 * Eagerly cancel queue rows the promotion just overtook — the same
 * verdict the drip cron's stage gate would reach at send time, applied
 * at the transition so the contact panel doesn't show doomed
 * "Scheduled" rows for weeks. The send-time gate stays as the safety
 * net for rows enqueued after this moment.
 */
async function cancelOvertakenDripRows(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  email: string,
  stage: "visitor" | "verified" | "owned",
): Promise<void> {
  const templates = [...CONTACTED_SERIES_TEMPLATES];
  if (stage !== "visitor") templates.push("visitor-nudge");
  if (stage === "owned") templates.push("verified-reminder");
  try {
    await (supabase.from("email_drip_queue") as any)
      .update({ cancelled_at: new Date().toISOString(), cancelled_reason: "status_change" })
      .ilike("email", email)
      .is("sent_at", null)
      .is("cancelled_at", null)
      .in("template", templates);
  } catch (err) {
    logger.error("Failed to cancel overtaken drip rows", { email, stage }, err as Error);
  }
}

export async function advanceProspectStage(
  identifier: { email?: string | null; companyId?: string | null },
  stage: "verified" | "owned",
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const fields = "id, email, company_name, status, apollo_contact_id, company_id";
  type ProspectRow = { id: string; status: string | null; apollo_contact_id: string | null; company_id: string | null };
  // Only the claimer's OWN rows advance: the stage is a fact about the
  // person who verified/claimed. Colleagues keep their own outreach
  // stage — the company-level truth reaches Sales via the company join
  // (companyRowStatus), never by promoting an uninvolved contact. The
  // email match is case-insensitive and takes every duplicate row
  // (.maybeSingle() previously returned null on >1 match and silently
  // skipped the advance).
  if (!identifier.email) return;
  const { data: matched } = await supabase.from("prospects").select(fields).ilike("email", identifier.email);
  const rows = (matched ?? []) as ProspectRow[];
  for (const prospect of rows) {
  if (prospect.status === "removed") continue; // soft-deleted stays removed
  if (!canAdvanceTo(prospect.status, stage)) continue;
  const isClaimer = true; // rows are email-matched — always the claimer

  // Owned = the claim landed: the machine's series is over for this
  // contact (the stage mails from here — owned-reminder, Listed serie —
  // are their own sequences). Without this the stored 'active' flag
  // outlived the conversion and the panel kept reading "Active".
  await (supabase.from("prospects") as any)
    .update({ status: stage, ...(stage === "owned" ? { sequence_status: "finished" } : {}) })
    .eq("id", prospect.id);
  await supabase.from("prospect_events").insert({
    prospect_id: prospect.id,
    event_type: stage === "verified" ? "prospect.verified" : "prospect.owned",
    event_source: "app",
    old_status: prospect.status,
    new_status: stage,
  } as any);

  // Retire everything this promotion overtook (verified also ends the
  // visitor-nudge; owned also ends the verified-reminder). Runs BEFORE
  // the verified-reminder enqueue below, so that row survives.
  {
    const overtakenEmail = ((prospect as any).email as string | null) ?? identifier.email ?? null;
    if (overtakenEmail) await cancelOvertakenDripRows(supabase, overtakenEmail, stage);
  }

  // Verified-reminder: cart-abandonment mail, +1 business day after the
  // company step was confirmed without a commit. One per address, ever;
  // the drip cron's stage gate cancels it if they reach Owned first,
  // and mint-at-send gives it a fresh funnel token. Claimer only —
  // domain-mates mirror the stage but never get the stage mail.
  if (stage === "verified" && isClaimer) {
    try {
      const email = ((prospect as any).email as string | null) ?? identifier.email ?? null;
      if (email) {
        const { data: existing } = await supabase
          .from("email_drip_queue")
          .select("id")
          .ilike("email", email)
          .eq("template", "verified-reminder")
          .limit(1)
          .maybeSingle();
        if (!existing) {
          const { nextBusinessSlot } = await import("@/lib/date-utils");
          await (supabase.from("email_drip_queue") as any).insert({
            email,
            template: "verified-reminder",
            sequence: "verified-reminder",
            company_id: (prospect as any).company_id ?? identifier.companyId ?? null,
            send_at: nextBusinessSlot(1).toISOString(),
            variables: { company_name: (prospect as any).company_name ?? undefined },
          });
        }
      }
    } catch (err) {
      logger.error("Failed to enqueue verified reminder", { prospectId: prospect.id }, err as Error);
    }
  }

  // Owned-welcome: pro onboarding, +1 business day after the claim.
  // One per address, ever; the abstract template resolves at send time
  // into the publisher or contributor variant (lib/owned-welcome.ts),
  // and the cron's stage gate cancels it if they reach Active first.
  // Claimer only, same as the verified-reminder above.
  if (stage === "owned" && isClaimer) {
    try {
      const email = ((prospect as any).email as string | null) ?? identifier.email ?? null;
      if (email) {
        const { data: existing } = await supabase
          .from("email_drip_queue")
          .select("id")
          .ilike("email", email)
          .eq("template", "owned-welcome")
          .limit(1)
          .maybeSingle();
        if (!existing) {
          const { nextBusinessSlot } = await import("@/lib/date-utils");
          await (supabase.from("email_drip_queue") as any).insert({
            email,
            template: "owned-welcome",
            sequence: "owned-welcome",
            company_id: (prospect as any).company_id ?? identifier.companyId ?? null,
            send_at: nextBusinessSlot(1).toISOString(),
            variables: { company_name: (prospect as any).company_name ?? undefined },
          });
        }
      }
    } catch (err) {
      logger.error("Failed to enqueue owned welcome", { prospectId: prospect.id }, err as Error);
    }
  }

  if (prospect.apollo_contact_id) {
    try {
      await updateContactStage(prospect.apollo_contact_id, APOLLO_STAGE_FOR[stage]);
    } catch (err) {
      logger.error("Failed to sync Apollo contact stage", { stage }, err as Error);
    }
  }
  if (prospect.company_id) {
    try {
      await syncCompanyToApollo(prospect.company_id);
    } catch (err) {
      logger.error("Failed to sync Apollo account stage", { stage }, err as Error);
    }
  }
  } // for (prospect of rows)
}
