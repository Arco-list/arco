import { NextResponse, type NextRequest } from "next/server";

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
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

function shouldAdvanceStatus(
  currentStatus: string | null,
  newStatus: ProspectStatus
): boolean {
  // Terminal statuses always apply
  if (newStatus === "unsubscribed" || newStatus === "bounced") return true;
  // Cannot overwrite terminal statuses
  if (currentStatus === "unsubscribed" || currentStatus === "bounced") return false;

  const currentIdx = currentStatus ? statusIndex(currentStatus) : -1;
  const newIdx = statusIndex(newStatus);
  return newIdx > currentIdx;
}

function validateWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.APOLLO_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("Missing APOLLO_WEBHOOK_SECRET environment variable");
    return false;
  }

  // Check header first, then query param
  const headerSignature = request.headers.get("x-apollo-signature");
  if (headerSignature === secret) return true;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (querySecret === secret) return true;

  return false;
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

export async function POST(request: NextRequest) {
  if (!validateWebhookSecret(request)) {
    logger.security("apollo-webhook", "Invalid webhook secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    logger.warn("Apollo webhook: invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType: string = payload?.event_type ?? payload?.type ?? "unknown";

  logger.info("Apollo webhook received", {
    eventType,
    hasData: !!payload?.data,
  });

  const supabase = createServiceRoleSupabaseClient();

  try {
    switch (eventType) {
      case "contact.created":
      case "contact.updated": {
        await handleContactUpsert(supabase, payload.data, eventType);
        break;
      }
      case "emailer_campaign.email_sent": {
        await handleEmailSent(supabase, payload.data, eventType);
        break;
      }
      case "emailer_campaign.email_opened": {
        await handleEmailOpened(supabase, payload.data, eventType);
        break;
      }
      case "emailer_campaign.email_clicked": {
        await handleEmailClicked(supabase, payload.data, eventType);
        break;
      }
      case "emailer_campaign.email_bounced": {
        await handleEmailBounced(supabase, payload.data, eventType);
        break;
      }
      case "contact.unsubscribed": {
        await handleUnsubscribed(supabase, payload.data, eventType);
        break;
      }
      default: {
        logger.info("Apollo webhook: unhandled event type", { eventType });
      }
    }
  } catch (error) {
    logger.error("Apollo webhook processing error", { eventType }, error as Error);
    // Return 200 anyway so Apollo doesn't retry endlessly
    return NextResponse.json({ received: true, error: "Processing error" });
  }

  return NextResponse.json({ received: true });
}

// ── Handlers ───────────────────────────────────────────────────────────

async function handleContactUpsert(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  data: any,
  eventType: string
) {
  if (!data?.email) {
    logger.warn("Apollo webhook: contact event missing email", { eventType });
    return;
  }

  const upsertData: Record<string, unknown> = {
    email: data.email,
    apollo_contact_id: data.id ?? null,
    contact_name: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
    company_name: data.organization_name ?? null,
    phone: data.phone_numbers?.[0]?.raw_number ?? null,
    city: data.city ?? null,
    country: data.country ?? null,
    website: data.website_url ?? null,
  };

  const { data: existing } = await supabase
    .from("prospects")
    .select("id, status")
    .eq("email", data.email)
    .single();

  if (existing) {
    const { error } = await (supabase.from("prospects") as any)
      .update(upsertData)
      .eq("id", existing.id);

    if (error) {
      logger.error("Failed to update prospect from Apollo contact", {
        email: data.email,
        error: error.message,
      });
      return;
    }

    await logProspectEvent(
      supabase,
      existing.id,
      eventType,
      "apollo_webhook",
      existing.status,
      existing.status,
      { apollo_contact_id: data.id }
    );
  } else {
    upsertData.status = "imported";
    upsertData.source = "apollo";

    const { data: inserted, error } = await (supabase.from("prospects") as any)
      .insert(upsertData)
      .select("id")
      .single();

    if (error) {
      logger.error("Failed to insert prospect from Apollo contact", {
        email: data.email,
        error: error.message,
      });
      return;
    }

    await logProspectEvent(
      supabase,
      inserted.id,
      eventType,
      "apollo_webhook",
      null,
      "imported",
      { apollo_contact_id: data.id }
    );
  }
}

async function findProspectByApolloData(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  data: any
): Promise<{ id: string; status: string } | null> {
  // Try by contact ID first
  if (data?.contact_id) {
    const { data: prospect } = await supabase
      .from("prospects")
      .select("id, status")
      .eq("apollo_contact_id", data.contact_id)
      .single();
    if (prospect) return prospect as any;
  }

  // Fallback to email
  if (data?.email || data?.contact?.email) {
    const email = data.email ?? data.contact?.email;
    const { data: prospect } = await supabase
      .from("prospects")
      .select("id, status")
      .eq("email", email)
      .single();
    if (prospect) return prospect as any;
  }

  return null;
}

async function handleEmailSent(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  data: any,
  eventType: string
) {
  const prospect = await findProspectByApolloData(supabase, data);
  if (!prospect) {
    logger.warn("Apollo webhook: prospect not found for email_sent", {
      contactId: data?.contact_id,
    });
    return;
  }

  const updates: Record<string, unknown> = {
    last_email_sent_at: new Date().toISOString(),
    apollo_sequence_id: data?.emailer_campaign_id ?? null,
  };

  if (shouldAdvanceStatus(prospect.status, "sequence_active")) {
    updates.status = "sequence_active";
  }

  // Increment emails_sent using raw SQL via RPC or just set it
  const { data: current } = await supabase
    .from("prospects")
    .select("emails_sent")
    .eq("id", prospect.id)
    .single();

  updates.emails_sent = ((current as any)?.emails_sent ?? 0) + 1;

  await (supabase.from("prospects") as any).update(updates).eq("id", prospect.id);

  await logProspectEvent(
    supabase,
    prospect.id,
    eventType,
    "apollo_webhook",
    prospect.status,
    (updates.status as string) ?? prospect.status,
    { emailer_campaign_id: data?.emailer_campaign_id }
  );
}

async function handleEmailOpened(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  data: any,
  eventType: string
) {
  const prospect = await findProspectByApolloData(supabase, data);
  if (!prospect) {
    logger.warn("Apollo webhook: prospect not found for email_opened", {
      contactId: data?.contact_id,
    });
    return;
  }

  const updates: Record<string, unknown> = {
    last_email_opened_at: new Date().toISOString(),
  };

  if (shouldAdvanceStatus(prospect.status, "email_opened")) {
    updates.status = "email_opened";
  }

  const { data: current } = await supabase
    .from("prospects")
    .select("emails_opened")
    .eq("id", prospect.id)
    .single();

  updates.emails_opened = ((current as any)?.emails_opened ?? 0) + 1;

  await (supabase.from("prospects") as any).update(updates).eq("id", prospect.id);

  await logProspectEvent(
    supabase,
    prospect.id,
    eventType,
    "apollo_webhook",
    prospect.status,
    (updates.status as string) ?? prospect.status,
    { emailer_campaign_id: data?.emailer_campaign_id }
  );
}

async function handleEmailClicked(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  data: any,
  eventType: string
) {
  const prospect = await findProspectByApolloData(supabase, data);
  if (!prospect) {
    logger.warn("Apollo webhook: prospect not found for email_clicked", {
      contactId: data?.contact_id,
    });
    return;
  }

  const updates: Record<string, unknown> = {
    last_email_clicked_at: new Date().toISOString(),
  };

  if (shouldAdvanceStatus(prospect.status, "email_clicked")) {
    updates.status = "email_clicked";
  }

  const { data: current } = await supabase
    .from("prospects")
    .select("emails_clicked")
    .eq("id", prospect.id)
    .single();

  updates.emails_clicked = ((current as any)?.emails_clicked ?? 0) + 1;

  await (supabase.from("prospects") as any).update(updates).eq("id", prospect.id);

  await logProspectEvent(
    supabase,
    prospect.id,
    eventType,
    "apollo_webhook",
    prospect.status,
    (updates.status as string) ?? prospect.status,
    { emailer_campaign_id: data?.emailer_campaign_id }
  );
}

async function handleEmailBounced(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  data: any,
  eventType: string
) {
  const prospect = await findProspectByApolloData(supabase, data);
  if (!prospect) {
    logger.warn("Apollo webhook: prospect not found for email_bounced", {
      contactId: data?.contact_id,
    });
    return;
  }

  await (supabase.from("prospects") as any)
    .update({ status: "bounced" })
    .eq("id", prospect.id);

  await logProspectEvent(
    supabase,
    prospect.id,
    eventType,
    "apollo_webhook",
    prospect.status,
    "bounced"
  );
}

async function handleUnsubscribed(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  data: any,
  eventType: string
) {
  const prospect = await findProspectByApolloData(supabase, data);
  if (!prospect) {
    logger.warn("Apollo webhook: prospect not found for unsubscribed", {
      contactId: data?.contact_id,
    });
    return;
  }

  await (supabase.from("prospects") as any)
    .update({
      status: "unsubscribed",
      unsubscribed_at: new Date().toISOString(),
    })
    .eq("id", prospect.id);

  await logProspectEvent(
    supabase,
    prospect.id,
    eventType,
    "apollo_webhook",
    prospect.status,
    "unsubscribed"
  );
}
