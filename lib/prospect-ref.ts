import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Status progression order for checking advancement.
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

/**
 * Generate a short unique ref code (8 alphanumeric characters).
 */
export function generateRefCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  const randomValues = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return code;
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
    .select("id, status, landing_visited_at")
    .eq("email", refCode.toLowerCase())
    .maybeSingle();

  if (!prospect) {
    const result = await supabase
      .from("prospects")
      .select("id, status, landing_visited_at")
      .eq("ref_code", refCode)
      .maybeSingle();
    prospect = result.data;
    error = result.error;
  }

  if (!prospect) {
    const result = await supabase
      .from("prospects")
      .select("id, status, landing_visited_at")
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

  if (canAdvanceTo(oldStatus, "landing_visited")) {
    updates.status = "landing_visited";
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
}
