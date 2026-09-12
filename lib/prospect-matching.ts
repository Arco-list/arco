import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { removeContactFromSequence, updateContactStage } from "@/lib/apollo-client";
import { syncCompanyToApollo } from "@/lib/company-apollo-sync";
import { logger } from "@/lib/logger";

/**
 * Status progression order. A status should only advance forward.
 */
// The claim funnel flipped the order: the company step (step 1,
// "Created") completes BEFORE the account commit (step 2, "Signup").
const STATUS_ORDER = [
  "prospect",
  "contacted",
  "visitor",
  "verified",
  "owned",
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

async function logProspectEvent(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  prospectId: string,
  eventType: string,
  eventSource: string,
  oldStatus: string | null,
  newStatus: string | null,
  metadata?: Record<string, unknown>
) {
  const { error } = await supabase.from("prospect_events").insert({
    prospect_id: prospectId,
    event_type: eventType,
    event_source: eventSource,
    old_status: oldStatus,
    new_status: newStatus,
    metadata: metadata ?? {},
  } as any);

  if (error) {
    logger.error("Failed to log prospect event", {
      prospectId,
      eventType,
      error: error.message,
    });
  }
}

/**
 * Arco status → Apollo stage name mapping (1:1 match).
 */
const ARCO_TO_APOLLO_STAGE: Record<string, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  visitor: "Visitor",
  verified: "Verified",
  owned: "Owned",
  active: "Listed",
};

/**
 * Sync Arco status to the Apollo CONTACT stage (per person). The
 * ACCOUNT stage is owned by syncCompanyToApollo's resolver — callers
 * with a company_id trigger that separately. Non-blocking — errors are
 * logged but don't fail the caller.
 */
async function syncApolloStage(apolloContactId: string | null, arcoStatus: string) {
  if (!apolloContactId) return;
  const stageName = ARCO_TO_APOLLO_STAGE[arcoStatus];
  if (!stageName) return;
  try {
    await updateContactStage(apolloContactId, stageName);
  } catch (err) {
    logger.error("Failed to sync Apollo contact stage", { apolloContactId, arcoStatus }, err as Error);
  }
}

/** Fire-and-log account-stage recompute for the prospect's company. */
async function syncAccountStageForCompany(companyId: string | null | undefined) {
  if (!companyId) return;
  try {
    await syncCompanyToApollo(companyId);
  } catch (err) {
    logger.error("Failed to sync Apollo account stage", { companyId }, err as Error);
  }
}

/**
 * Shared prospect lookup for the signup paths: ref cookie (email,
 * ref_code or apollo_contact_id), then signup email, then the claim
 * cookie's company.
 */
async function findProspectForSignup(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  email: string,
  prospectRef?: string | null,
  claimCompanyId?: string | null,
): Promise<any | null> {
  let prospect: any = null;

  // Try matching by ref cookie first (email, ref_code, or apollo_contact_id)
  if (prospectRef) {
    const { data: byEmail } = await supabase
      .from("prospects")
      .select("id, status, signed_up_at, apollo_contact_id, apollo_sequence_id, company_id")
      .eq("email", prospectRef.toLowerCase())
      .maybeSingle();
    prospect = byEmail;

    if (!prospect) {
      const { data: byRef } = await supabase
        .from("prospects")
        .select("id, status, signed_up_at, apollo_contact_id, apollo_sequence_id, company_id")
        .eq("ref_code", prospectRef)
        .maybeSingle();
      prospect = byRef;
    }

    if (!prospect) {
      const { data: byApollo } = await supabase
        .from("prospects")
        .select("id, status, signed_up_at, apollo_contact_id, apollo_sequence_id, company_id")
        .eq("apollo_contact_id", prospectRef)
        .maybeSingle();
      prospect = byApollo;
    }
  }

  // Fallback: match by signup email
  if (!prospect) {
    const { data: bySignupEmail } = await supabase
      .from("prospects")
      .select("id, status, signed_up_at, apollo_contact_id, apollo_sequence_id, company_id")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    prospect = bySignupEmail;
  }

  // Fallback: match by company_id from claim URL cookie
  if (!prospect && claimCompanyId) {
    const { data: byCompany } = await supabase
      .from("prospects")
      .select("id, status, signed_up_at, apollo_contact_id, apollo_sequence_id, company_id")
      .eq("company_id", claimCompanyId)
      .maybeSingle();
    prospect = byCompany;
  }

  return prospect;
}

/**
 * Signup STARTED — the code-send moment. The account is pre-created
 * (admin.createUser in signUpWithOtpAction) but nothing is proven yet,
 * so this only links the account to the prospect and logs
 * 'prospect.signup_started'. No signed_up_at stamp, no sequence
 * retirement, no Apollo stop: an abandoned signup keeps being chased
 * by the funnel mails. The real "Signed up" fires at the first
 * verified session (DB trigger, migration 238) or via
 * matchProspectOnSignup on the OAuth callback.
 */
export async function matchProspectOnSignupStarted(
  email: string,
  userId: string,
  prospectRef?: string | null,
  claimCompanyId?: string | null
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const prospect = await findProspectForSignup(supabase, email, prospectRef, claimCompanyId);
  if (!prospect) {
    logger.debug("No prospect found for signup start", { email, prospectRef, claimCompanyId });
    return;
  }

  await (supabase.from("prospects") as any)
    .update({ user_id: userId })
    .eq("id", prospect.id);

  await logProspectEvent(
    supabase,
    prospect.id,
    "prospect.signup_started",
    "app",
    prospect.status,
    prospect.status,
    { userId }
  );
}

/**
 * When a user signs up, match to a prospect by:
 * 1. prospect_ref cookie (set when they clicked an Apollo email link)
 * 2. Exact email match (fallback)
 * This allows matching even when the user signs up with a personal email.
 *
 * This is the VERIFIED signup: only call it from paths where a real
 * session exists (OAuth callback). The OTP path logs signup_started at
 * code-send and gets the real stamp from the first-sign-in trigger
 * (migration 238) — the signed_up_at guard below keeps the two paths
 * from double-stamping each other.
 */
export async function matchProspectOnSignup(
  email: string,
  userId: string,
  prospectRef?: string | null,
  claimCompanyId?: string | null
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const prospect = await findProspectForSignup(supabase, email, prospectRef, claimCompanyId);
  if (!prospect) {
    logger.debug("No prospect found for signup", { email, prospectRef, claimCompanyId });
    return;
  }

  // Already stamped (e.g. the first-sign-in trigger beat this call):
  // just make sure the account link exists and stop.
  if (prospect.signed_up_at) {
    await (supabase.from("prospects") as any)
      .update({ user_id: userId })
      .eq("id", prospect.id);
    return;
  }

  const oldStatus = (prospect as any).status;
  const updates: Record<string, unknown> = {
    user_id: userId,
    signed_up_at: new Date().toISOString(),
  };

  // Don't set contact_name on signup — only set when company is actually claimed
  // (matchProspectOnCompanyCreated handles that)

  // Signup is an EVENT under the remodeled ladder, not a stage: it
  // stamps the account facts and retires the sequence (someone in the
  // product should not keep receiving claim drips), while the stage
  // itself only moves at claim time (matchProspectOnCompanyCreated /
  // the funnel commit → 'owned').
  updates.sequence_status = "finished";

  await (supabase.from("prospects") as any)
    .update(updates)
    .eq("id", (prospect as any).id);

  await logProspectEvent(
    supabase,
    (prospect as any).id,
    "prospect.signed_up",
    "app",
    oldStatus,
    (updates.status as string) ?? oldStatus,
    { userId }
  );

  // Stop the Apollo sequence and sync stage
  const apolloContactId = (prospect as any).apollo_contact_id;
  const apolloSequenceId = (prospect as any).apollo_sequence_id;

  if (apolloContactId && apolloSequenceId) {
    try {
      await removeContactFromSequence(apolloSequenceId, apolloContactId);
      logger.info("Stopped Apollo sequence for signed-up prospect", {
        prospectId: (prospect as any).id,
        apolloSequenceId,
        apolloContactId,
      });
    } catch (err) {
      logger.error(
        "Failed to remove contact from Apollo sequence",
        { prospectId: (prospect as any).id, apolloSequenceId, apolloContactId },
        err as Error
      );
    }
  }

  await syncAccountStageForCompany((prospect as any).company_id);
}

/**
 * Extract domain from an email address (e.g. "bob@example.com" → "example.com").
 */
function emailDomain(email: string): string {
  return email.toLowerCase().split("@")[1] ?? "";
}

/**
 * Extract domain from a URL (e.g. "https://www.example.com/about" → "example.com").
 */
function urlDomain(url: string): string {
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

/**
 * When a company is created, find the prospect by user_id and update status.
 * Only advances to "owned" if the company domain matches the prospect's email domain.
 */
export async function matchProspectOnCompanyCreated(
  userId: string,
  companyId: string
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  // Try matching by user_id first, then by company_id
  let prospect: any = null;
  const { data: byUser } = await supabase
    .from("prospects")
    .select("id, status, email, apollo_contact_id")
    .eq("user_id", userId)
    .maybeSingle();
  prospect = byUser;

  if (!prospect) {
    const { data: byCompany } = await supabase
      .from("prospects")
      .select("id, status, email, apollo_contact_id")
      .eq("company_id", companyId)
      .maybeSingle();
    prospect = byCompany;
  }

  if (!prospect) {
    logger.debug("No prospect found for user on company creation", { userId, companyId });
    return;
  }

  // Get owner profile name
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  const ownerName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || null;

  const oldStatus = (prospect as any).status;
  const updates: Record<string, unknown> = {
    company_id: companyId,
    user_id: userId,
    company_created_at: new Date().toISOString(),
  };

  if (ownerName) {
    updates.contact_name = ownerName;
  }

  if (canAdvanceTo(oldStatus, "owned")) {
    updates.status = "owned";
  }

  await (supabase.from("prospects") as any)
    .update(updates)
    .eq("id", (prospect as any).id);

  await logProspectEvent(
    supabase,
    (prospect as any).id,
    "prospect.company_created",
    "app",
    oldStatus,
    (updates.status as string) ?? oldStatus,
    { userId, companyId, ownerName }
  );

  if (updates.status === "owned") {
    await syncApolloStage((prospect as any).apollo_contact_id, "owned");
  }
  await syncAccountStageForCompany(companyId);
}

