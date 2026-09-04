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
 * Track when a prospect visits the landing page via their ref param.
 * Supports both ref_code and apollo_contact_id lookups.
 * Updates landing_visited_at (if not already set) and advances status
 * to 'landing_visited' if appropriate.
 */
export async function trackProspectLandingVisit(
  refCode: string
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  // Try email first (from Apollo {{email}} variable), then ref_code, then apollo_contact_id
  let { data: prospect, error } = await supabase
    .from("prospects")
    .select("id, status, landing_visited_at, apollo_contact_id, company_id")
    .eq("email", refCode.toLowerCase())
    .maybeSingle();

  if (!prospect) {
    const result = await supabase
      .from("prospects")
      .select("id, status, landing_visited_at, apollo_contact_id, company_id")
      .eq("ref_code", refCode)
      .maybeSingle();
    prospect = result.data;
    error = result.error;
  }

  if (!prospect) {
    const result = await supabase
      .from("prospects")
      .select("id, status, landing_visited_at, apollo_contact_id, company_id")
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

export async function advanceProspectStage(
  identifier: { email?: string | null; companyId?: string | null },
  stage: "verified" | "owned",
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const fields = "id, status, apollo_contact_id, company_id";
  type ProspectRow = { id: string; status: string | null; apollo_contact_id: string | null; company_id: string | null };
  let prospect: ProspectRow | null = null;
  if (identifier.companyId) {
    prospect = (await supabase.from("prospects").select(fields).eq("company_id", identifier.companyId).maybeSingle()).data as ProspectRow | null;
  }
  if (!prospect && identifier.email) {
    prospect = (await supabase.from("prospects").select(fields).eq("email", identifier.email.toLowerCase()).maybeSingle()).data as ProspectRow | null;
  }
  if (!prospect) return;
  if (!canAdvanceTo(prospect.status, stage)) return;

  await (supabase.from("prospects") as any).update({ status: stage }).eq("id", prospect.id);
  await supabase.from("prospect_events").insert({
    prospect_id: prospect.id,
    event_type: stage === "verified" ? "prospect.verified" : "prospect.owned",
    event_source: "app",
    old_status: prospect.status,
    new_status: stage,
  } as any);

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
}
