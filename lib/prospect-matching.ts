import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { removeContactFromSequence, updateContactStage, updateAccountStage } from "@/lib/apollo-client";
import { logger } from "@/lib/logger";

/**
 * Status progression order. A status should only advance forward.
 */
const STATUS_ORDER = [
  "prospect",
  "contacted",
  "visitor",
  "signup",
  "company",
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
  signup: "Signup",
  company: "Draft",
  active: "Listed",
};

/**
 * Sync Arco status to Apollo contact stage. Non-blocking — errors are logged but don't fail the caller.
 */
async function syncApolloStage(apolloContactId: string | null, arcoStatus: string) {
  if (!apolloContactId) return;
  const stageName = ARCO_TO_APOLLO_STAGE[arcoStatus];
  if (!stageName) return;
  try {
    await Promise.all([
      updateContactStage(apolloContactId, stageName),
      updateAccountStage(apolloContactId, stageName),
    ]);
  } catch (err) {
    logger.error("Failed to sync Apollo stages", { apolloContactId, arcoStatus }, err as Error);
  }
}

/**
 * When a user signs up, match to a prospect by:
 * 1. prospect_ref cookie (set when they clicked an Apollo email link)
 * 2. Exact email match (fallback)
 * This allows matching even when the user signs up with a personal email.
 */
export async function matchProspectOnSignup(
  email: string,
  userId: string,
  prospectRef?: string | null
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  let prospect: any = null;

  // Try matching by ref cookie first (email, ref_code, or apollo_contact_id)
  if (prospectRef) {
    const { data: byEmail } = await supabase
      .from("prospects")
      .select("id, status, apollo_contact_id, apollo_sequence_id")
      .eq("email", prospectRef.toLowerCase())
      .maybeSingle();
    prospect = byEmail;

    if (!prospect) {
      const { data: byRef } = await supabase
        .from("prospects")
        .select("id, status, apollo_contact_id, apollo_sequence_id")
        .eq("ref_code", prospectRef)
        .maybeSingle();
      prospect = byRef;
    }

    if (!prospect) {
      const { data: byApollo } = await supabase
        .from("prospects")
        .select("id, status, apollo_contact_id, apollo_sequence_id")
        .eq("apollo_contact_id", prospectRef)
        .maybeSingle();
      prospect = byApollo;
    }
  }

  // Fallback: match by signup email
  if (!prospect) {
    const { data: bySignupEmail } = await supabase
      .from("prospects")
      .select("id, status, apollo_contact_id, apollo_sequence_id")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    prospect = bySignupEmail;
  }

  if (!prospect) {
    logger.debug("No prospect found for signup", { email, prospectRef });
    return;
  }

  const oldStatus = (prospect as any).status;
  const updates: Record<string, unknown> = {
    user_id: userId,
    signed_up_at: new Date().toISOString(),
  };

  if (canAdvanceTo(oldStatus, "signup")) {
    updates.status = "signup";
    updates.sequence_status = "finished";
  }

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

  await syncApolloStage(apolloContactId, "signup");
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
 * Only advances to "company" if the company domain matches the prospect's email domain.
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

  // Get the company's domain (website or email)
  const { data: company } = await supabase
    .from("companies")
    .select("website, email")
    .eq("id", companyId)
    .single();

  // Check if the company domain matches the prospect's email domain
  const prospectDomain = emailDomain((prospect as any).email);
  const companyWebDomain = company?.website ? urlDomain(company.website) : "";
  const companyEmailDomain = company?.email ? emailDomain(company.email) : "";
  const domainMatch = prospectDomain && (
    prospectDomain === companyWebDomain ||
    prospectDomain === companyEmailDomain
  );

  const oldStatus = (prospect as any).status;
  const updates: Record<string, unknown> = {
    company_id: companyId,
    company_created_at: new Date().toISOString(),
  };

  if (domainMatch && canAdvanceTo(oldStatus, "company")) {
    updates.status = "company";
  } else if (!domainMatch) {
    logger.info("Company domain does not match prospect email domain, not advancing", {
      prospectDomain, companyWebDomain, companyEmailDomain, prospectId: (prospect as any).id,
    });
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
    { userId, companyId, domainMatch }
  );

  if (domainMatch) {
    await syncApolloStage((prospect as any).apollo_contact_id, "company");
  }
}

