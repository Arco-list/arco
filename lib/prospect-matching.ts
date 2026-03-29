import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { removeContactFromSequence } from "@/lib/apollo-client";
import { logger } from "@/lib/logger";

/**
 * Status progression order. A status should only advance forward.
 */
const STATUS_ORDER = [
  "imported",
  "sequence_active",
  "email_opened",
  "email_clicked",
  "landing_visited",
  "signed_up",
  "company_created",
  "project_started",
  "project_published",
  "converted",
] as const;

type ProspectStatus = (typeof STATUS_ORDER)[number] | "unsubscribed" | "bounced";

function statusIndex(status: string): number {
  return STATUS_ORDER.indexOf(status as (typeof STATUS_ORDER)[number]);
}

function canAdvanceTo(
  currentStatus: string | null,
  newStatus: ProspectStatus
): boolean {
  if (currentStatus === "unsubscribed" || currentStatus === "bounced") {
    return false;
  }
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
 * When a user signs up, check if their email exists in the prospects table.
 * If found, update status to 'signed_up', link user_id, and stop the Apollo sequence.
 */
export async function matchProspectOnSignup(
  email: string,
  userId: string
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  const { data: prospect, error } = await supabase
    .from("prospects")
    .select("id, status, apollo_contact_id, apollo_sequence_id")
    .eq("email", email.toLowerCase())
    .single();

  if (error || !prospect) {
    // No matching prospect -- this is normal for non-prospect signups
    logger.debug("No prospect found for signup email", { email });
    return;
  }

  const oldStatus = (prospect as any).status;
  const updates: Record<string, unknown> = {
    user_id: userId,
    signed_up_at: new Date().toISOString(),
  };

  if (canAdvanceTo(oldStatus, "signed_up")) {
    updates.status = "signed_up";
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

  // Stop the Apollo sequence if the prospect is in one
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
      // Don't fail the signup flow if Apollo API is unavailable
      logger.error(
        "Failed to remove contact from Apollo sequence",
        {
          prospectId: (prospect as any).id,
          apolloSequenceId,
          apolloContactId,
        },
        err as Error
      );
    }
  }
}

/**
 * When a company is created, find the prospect by user_id and update status.
 */
export async function matchProspectOnCompanyCreated(
  userId: string,
  companyId: string
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  const { data: prospect, error } = await supabase
    .from("prospects")
    .select("id, status")
    .eq("user_id", userId)
    .single();

  if (error || !prospect) {
    logger.debug("No prospect found for user on company creation", { userId });
    return;
  }

  const oldStatus = (prospect as any).status;
  const updates: Record<string, unknown> = {
    company_id: companyId,
    company_created_at: new Date().toISOString(),
  };

  if (canAdvanceTo(oldStatus, "company_created")) {
    updates.status = "company_created";
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
    { userId, companyId }
  );
}

/**
 * When a project is published, find the prospect by company_id and update status.
 */
export async function matchProspectOnProjectPublished(
  companyId: string,
  projectId: string
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  const { data: prospect, error } = await supabase
    .from("prospects")
    .select("id, status")
    .eq("company_id", companyId)
    .single();

  if (error || !prospect) {
    logger.debug("No prospect found for company on project published", {
      companyId,
    });
    return;
  }

  const oldStatus = (prospect as any).status;
  const updates: Record<string, unknown> = {
    project_id: projectId,
    project_published_at: new Date().toISOString(),
  };

  if (canAdvanceTo(oldStatus, "project_published")) {
    updates.status = "project_published";
  }

  await (supabase.from("prospects") as any)
    .update(updates)
    .eq("id", (prospect as any).id);

  await logProspectEvent(
    supabase,
    (prospect as any).id,
    "prospect.project_published",
    "app",
    oldStatus,
    (updates.status as string) ?? oldStatus,
    { companyId, projectId }
  );
}
