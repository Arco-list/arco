import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * process-drip-queue — Supabase Edge Function, cron-triggered.
 *
 * Pulls due rows from public.email_drip_queue and sends them. Runs every
 * ~5 minutes via pg_cron (see the Supabase dashboard cron config).
 *
 * ── Architecture (PR 2 of the drip pipeline) ────────────────────────────
 *
 * This function USED to inline its own copies of the email templates
 * (baseLayout, heading, body, button, three renderers). That made every
 * change to lib/email-service.ts invisible to the cron — when we shipped
 * the company card, the logo fallback, the Supabase image transforms, and
 * the new prospect templates, none of it reached the drip pipeline.
 *
 * Now the function is a pure SCHEDULER. For each due row it POSTs to
 * `${SITE_URL}/api/internal/send-drip-email` which imports the full
 * lib/email-service.ts and does the actual rendering + sending. One
 * source of truth for templates, forever.
 *
 * The inline templates + direct Resend calls are gone. If anything goes
 * wrong with the callback path — Vercel down, secret rotated, etc. — due
 * rows pile up harmlessly and get processed once the callback is back.
 * The alternative (keeping the inline templates as a fallback) would
 * have meant running two renderers indefinitely, which was the original
 * problem in the first place.
 *
 * ── Retry + failure handling (PR 1 schema support) ──────────────────────
 *
 * Each row now tracks attempt_count and last_error. We stop retrying a
 * row after MAX_ATTEMPTS permanent-looking failures. Admin can surface
 * failed rows and reset them from the /admin/emails page (PR 5).
 *
 * Failure classification:
 *   - HTTP 422 from the callback   → permanent. Mark cancelled with reason.
 *   - HTTP 502/500/network error   → transient. Increment attempt_count,
 *                                    store last_error; retry next tick.
 *   - HTTP 401                     → permanent config error. Cancel + log.
 *   - HTTP 200                     → success. Mark sent_at, clear error.
 *
 * ── Batching ────────────────────────────────────────────────────────────
 *
 * We cap each cron tick at BATCH_LIMIT rows and send CONCURRENCY at a
 * time with Promise.all so the Edge Function doesn't burn its 60s
 * wall-clock on sequential HTTP hops to Vercel. At 500ms/send and
 * concurrency 5, 50 rows take ~5s instead of ~25s.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BATCH_LIMIT = 50;
const CONCURRENCY = 5;
const MAX_ATTEMPTS = 3;

type QueueRow = {
  id: string;
  email: string;
  template: string;
  variables: Record<string, unknown> | null;
  company_id: string | null;
  attempt_count: number;
};

type CallbackResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string; message: string; status: number };

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://www.arcolist.com";
  const dripSecret = Deno.env.get("DRIP_QUEUE_SECRET");

  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: "Missing Supabase configuration" }, 500);
  }
  if (!dripSecret) {
    return json(
      { error: "DRIP_QUEUE_SECRET not set on the Edge Function" },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── Fetch due rows ────────────────────────────────────────────────────
  const { data: dueEmails, error: fetchError } = await supabase
    .from("email_drip_queue")
    .select("id, email, template, variables, company_id, attempt_count")
    .lte("send_at", new Date().toISOString())
    .is("sent_at", null)
    .is("cancelled_at", null)
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("send_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchError) {
    console.error("process-drip-queue: fetch failed", fetchError);
    return json({ error: fetchError.message }, 500);
  }

  const rows = (dueEmails ?? []) as QueueRow[];
  if (rows.length === 0) {
    return json({ processed: 0, sent: 0, failed: 0, cancelled: 0 });
  }

  // ── Pre-fetch data that some templates need ────────────────────────────
  // The old function fetched featured projects here for discover-projects;
  // we still do that, but now pass them via the `variables.projects` key
  // which the template reader picks up in lib/email-service.ts. Same
  // contract as welcome-homeowner (which reads vars.projects + vars.
  // professionals).
  //
  // Keeping this fetch in the cron rather than in the API route because
  // it's a cron-specific concern — the route should be dumb: render what
  // you're told.
  const needsProjects = rows.some((r) => r.template === "discover-projects");
  let featuredProjects:
    | Array<{ title: string; image: string; slug: string; location?: string }>
    | undefined;
  if (needsProjects) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, slug, location, address_city")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(3);

    const collected: typeof featuredProjects = [];
    for (const p of projects ?? []) {
      const { data: photo } = await supabase
        .from("project_photos")
        .select("url")
        .eq("project_id", (p as { id: string }).id)
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (photo?.url) {
        collected!.push({
          title: p.title ?? "Project",
          image: photo.url,
          slug: p.slug ?? "",
          location:
            (p as { address_city?: string | null; location?: string | null }).address_city ??
            (p as { location?: string | null }).location ??
            undefined,
        });
      }
    }
    featuredProjects = collected;
  }

  // ── Process in concurrent batches ─────────────────────────────────────
  let sent = 0;
  let failed = 0;
  let cancelled = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((row) => sendOne(row, {
        supabase,
        siteUrl,
        dripSecret,
        featuredProjects,
      })),
    );
    for (const r of results) {
      if (r === "sent") sent++;
      else if (r === "failed") failed++;
      else if (r === "cancelled") cancelled++;
    }
  }

  return json({ processed: rows.length, sent, failed, cancelled });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendOne(
  row: QueueRow,
  ctx: {
    // deno-lint-ignore no-explicit-any
    supabase: any;
    siteUrl: string;
    dripSecret: string;
    featuredProjects?: Array<{ title: string; image: string; slug: string; location?: string }>;
  },
): Promise<"sent" | "failed" | "cancelled"> {
  const { supabase, siteUrl, dripSecret, featuredProjects } = ctx;

  // Inject cron-side data into variables where the template expects it.
  const variables: Record<string, unknown> = { ...(row.variables ?? {}) };
  if (row.template === "discover-projects" && featuredProjects) {
    variables.projects = featuredProjects;
  }

  const result = await callSendDripEmail(siteUrl, dripSecret, {
    id: row.id,
    template: row.template,
    email: row.email,
    variables,
  });

  // Success → mark sent, clear any prior error.
  if (result.ok) {
    const { error } = await supabase
      .from("email_drip_queue")
      .update({
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", row.id);
    if (error) {
      console.error("process-drip-queue: failed to mark sent", row.id, error);
    }
    console.log(`Sent ${row.template} to ${row.email} (id: ${result.messageId ?? "?"})`);
    return "sent";
  }

  // Permanent failure — cancel the row so we stop trying.
  if (result.status === 401 || result.status === 422) {
    const reason =
      result.status === 401
        ? "config_error"
        : result.error === "unknown_template"
          ? "unknown_template"
          : "permanent_error";
    const { error } = await supabase
      .from("email_drip_queue")
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason,
        last_error: `${result.status}: ${result.message}`,
      })
      .eq("id", row.id);
    if (error) {
      console.error("process-drip-queue: failed to mark cancelled", row.id, error);
    }
    console.warn(`Cancelled ${row.template} for ${row.email}: ${reason} — ${result.message}`);
    return "cancelled";
  }

  // Transient failure — increment attempt_count, store error, retry later.
  const nextAttempt = row.attempt_count + 1;
  const willCancel = nextAttempt >= MAX_ATTEMPTS;
  const update: Record<string, unknown> = {
    attempt_count: nextAttempt,
    last_error: `${result.status}: ${result.message}`,
  };
  if (willCancel) {
    update.cancelled_at = new Date().toISOString();
    update.cancelled_reason = "max_attempts";
  }
  const { error } = await supabase
    .from("email_drip_queue")
    .update(update)
    .eq("id", row.id);
  if (error) {
    console.error("process-drip-queue: failed to increment attempt", row.id, error);
  }
  console.warn(
    `${willCancel ? "Cancelled" : "Failed"} ${row.template} for ${row.email} (attempt ${nextAttempt}/${MAX_ATTEMPTS}): ${result.message}`,
  );
  return willCancel ? "cancelled" : "failed";
}

async function callSendDripEmail(
  siteUrl: string,
  dripSecret: string,
  payload: { id: string; template: string; email: string; variables: Record<string, unknown> },
): Promise<CallbackResult> {
  const url = `${siteUrl.replace(/\/$/, "")}/api/internal/send-drip-email`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dripSecret}`,
      },
      body: JSON.stringify(payload),
    });

    let parsed: {
      ok?: boolean;
      messageId?: string | null;
      error?: string;
      message?: string;
    } | null = null;
    try {
      parsed = (await response.json()) as typeof parsed;
    } catch {
      // Non-JSON response (e.g. HTML error page from Vercel). Treat as
      // transient with the raw status as the error.
      return {
        ok: false,
        error: "bad_response",
        message: `HTTP ${response.status} non-JSON response`,
        status: response.status,
      };
    }

    if (response.ok && parsed?.ok) {
      return { ok: true, messageId: parsed.messageId ?? null };
    }

    return {
      ok: false,
      error: parsed?.error ?? "unknown",
      message: parsed?.message ?? `HTTP ${response.status}`,
      status: response.status,
    };
  } catch (err) {
    // Network error, DNS failure, fetch throw, etc. Always transient.
    return {
      ok: false,
      error: "network",
      message: err instanceof Error ? err.message : String(err),
      status: 0,
    };
  }
}
