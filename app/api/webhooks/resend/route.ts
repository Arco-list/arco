import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Resend webhook endpoint — handles email tracking events.
 *
 * Configure in Resend dashboard: Settings → Webhooks → Add webhook
 * URL: https://arcolist.com/api/webhooks/resend
 * Events: email.delivered, email.opened, email.clicked, email.bounced
 */

type ResendWebhookEvent = {
  type: string
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    [key: string]: unknown
  }
}

export async function POST(request: NextRequest) {
  // Verify webhook signature if RESEND_WEBHOOK_SECRET is set
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (secret) {
    const signature = request.headers.get("svix-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }
    // Basic verification — for production, use the Svix library
  }

  let event: ResendWebhookEvent
  try {
    event = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { type, data } = event
  const messageId = data?.email_id
  const recipientEmail = data?.to?.[0]

  if (!messageId && !recipientEmail) {
    return NextResponse.json({ error: "No message ID or recipient" }, { status: 400 })
  }

  const supabase = createServiceRoleSupabaseClient()
  const now = new Date().toISOString()

  console.log(`[resend-webhook] ${type} for ${messageId} (${recipientEmail})`)

  // Whether this open is a machine prefetch (set below, used by both the
  // event metadata and the prospect-counter guard).
  let machineOpen = false

  // Mirror every engagement event into email_events as the unified source
  // of truth. Per-table cache writes below stay running unchanged — they
  // back the existing dashboards. New consumers (growth-table metrics,
  // /admin/emails refactor, prospect timelines) read from email_events.
  //
  // Idempotency: provider_event_id = `${messageId}:${type}:${event.created_at}`.
  // Webhook retries land the same composite key → upsert dedupes.
  // Distinct user opens/clicks have different timestamps → distinct rows.
  // Skip 'email.sent' here — sendTransactionalEmail already inserts that
  // row directly. Skip 'email.delivery_delayed' — not in our event_type
  // enum and not analytically interesting.
  if (messageId) {
    const eventTypeMap: Record<string, string> = {
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.failed": "failed",
    }
    const mappedType = eventTypeMap[type]
    if (mappedType) {
      try {
        const occurredAt = event.created_at ?? now
        const subject = data?.subject ?? null
        // Resend's email.clicked payload carries the clicked URL under
        // data.click.link (not in our typed shape — hence the cast).
        const clickLink = (data as unknown as { click?: { link?: string } } | null)?.click?.link ?? null
        // Machine detection, for opens AND clicks.
        //
        // Gateways and Apple-MPP prefetch the open pixel while scanning;
        // enterprise mail security (SafeLinks et al.) goes further and
        // detonates every link. Both land within seconds of the send.
        // The raw event is always stored — the flag only keeps it out of
        // the engagement counters and, for clicks, out of the promotion
        // to Visitor.
        //
        // TWO RULES, because the clock alone cannot separate them.
        // Measured over every click in the history, grouped by how long
        // after the send the first one arrived:
        //
        //     10–30s    61 mails,  25% clicked 2+ distinct links
        //     30–60s   233 mails,  39%          ← the biggest band
        //      1–2m    136 mails,  36%
        //     >5m      267 mails, 2.6%          ← where people live
        //
        // The 30–60s band is the largest of all, and still only two in
        // five carry the signature. Cutting there would throw away 141
        // single clicks that may well be human, and cutting at 30 would
        // wave through 92 proven scanners. So:
        //
        //   1. MULTIPLE DISTINCT LINKS IN THE SAME INSTANT is the
        //      certain tell and needs no clock. A scanner opens every
        //      link in the mail; marketing@wolterinck.com had two, SIX
        //      MILLISECONDS apart, on the company page and the claim
        //      link. No hand does that.
        //   2. A 30-SECOND FLOOR for everything else — half the old 60,
        //      which the data says was too generous.
        //
        // Being strict is cheap here: a real person who clicks is
        // promoted anyway when the claim page loads, which records
        // arrivals server-side behind its own country and user-agent
        // filter. This path only has to catch clicks the landing cannot
        // identify — forwarded mail, a client that strips parameters —
        // and for those a click after 30 seconds still counts.
        const MACHINE_WINDOW_MS = 30_000
        const MULTI_LINK_WINDOW_MS = 2_000
        if (type === "email.opened" || type === "email.clicked") {
          const { data: sentRow } = await (supabase as any)
            .from("email_events")
            .select("occurred_at")
            .eq("provider", "resend")
            .eq("provider_event_id", messageId)
            .eq("event_type", "sent")
            .maybeSingle()
          if (sentRow?.occurred_at) {
            const delta = new Date(occurredAt).getTime() - new Date(sentRow.occurred_at as string).getTime()
            machineOpen = delta >= 0 && delta < MACHINE_WINDOW_MS
          }

          // Rule 1. Any sibling click on a DIFFERENT url within two
          // seconds, in either direction — the events arrive in
          // whichever order the webhook delivers them.
          if (!machineOpen && type === "email.clicked" && clickLink) {
            const windowStart = new Date(new Date(occurredAt).getTime() - MULTI_LINK_WINDOW_MS).toISOString()
            const windowEnd = new Date(new Date(occurredAt).getTime() + MULTI_LINK_WINDOW_MS).toISOString()
            const { data: siblings } = await (supabase as any)
              .from("email_events")
              .select("metadata")
              .eq("event_type", "clicked")
              .eq("recipient_email", recipientEmail ?? "")
              .gte("occurred_at", windowStart)
              .lte("occurred_at", windowEnd)
            const otherLinks = ((siblings ?? []) as Array<{ metadata: Record<string, unknown> | null }>)
              .map((s) => (s.metadata?.click_link as string | undefined) ?? null)
              .filter((l): l is string => Boolean(l) && l !== clickLink)
            if (otherLinks.length > 0) machineOpen = true
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("email_events").upsert(
          {
            provider: "resend",
            provider_event_id: `${messageId}:${mappedType}:${occurredAt}`,
            event_type: mappedType,
            recipient_email: recipientEmail ?? "",
            subject,
            occurred_at: occurredAt,
            metadata: {
              resend_message_id: messageId,
              raw_type: type,
              ...(machineOpen ? { machine: true } : {}),
              // The clicked URL — lets read-side stats tell a real CTA
              // click from a click on the unsubscribe link (Resend
              // counts both as email.clicked).
              ...(type === "email.clicked" && clickLink ? { link: clickLink } : {}),
            },
          },
          { onConflict: "provider,provider_event_id" },
        )
      } catch (err) {
        console.error("[resend-webhook] Failed to log email_events row", { messageId, type, err })
      }
    }
  }

  // Update company_outreach table
  if (messageId) {
    const updateData: Record<string, string> = {}

    // Map Resend event names → Resend's `last_event` enum so the cached
    // value is identical to what `resend.emails.get()` would return for
    // the same message. The dashboard reads from this cache to avoid
    // re-fetching terminal-state rows on every page load.
    const lastEventMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.delivery_delayed": "delivery_delayed",
      "email.failed": "failed",
    }
    const cachedEvent = lastEventMap[type]
    if (cachedEvent) {
      updateData.last_event_cached = cachedEvent
      updateData.last_event_cached_at = now
    }

    switch (type) {
      case "email.delivered":
        // No specific field — delivery is implicit
        break
      case "email.opened":
        if (!machineOpen) updateData.opened_at = now
        break
      case "email.clicked":
        updateData.clicked_at = now
        break
      case "email.bounced":
      case "email.complained":
        // Could add a bounced_at field in the future
        break
    }

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from("company_outreach" as any)
        .update(updateData)
        .eq("resend_message_id", messageId)

      // Mirror the same write to email_drip_queue so followup / final rows
      // get per-message engagement tracking. Same column shape (added in
      // migration 144), so the updateData payload is reused as-is.
      await supabase
        .from("email_drip_queue")
        .update(updateData as never)
        .eq("resend_message_id", messageId)
    }
  }

  // Bounce / complaint auto-stop.
  //
  // Once an address bounces or complains it's terminal: every future
  // send to it (Showcase / Invite / Outreach / Welcome / transactional
  // alike) will fail or hurt sender reputation. Old logic only stopped
  // the prospect sequence for one company_id when a prospect-* template
  // bounced, which left other drips and the homeowner welcome series
  // happily retrying the same dead address.
  //
  // New logic, gated on recipientEmail (not template):
  //
  //   1. Stamp prospects.bounced_at / .complained_at on every prospect
  //      row sharing that email — feeds the isOptedOutOfMarketing gate
  //      so future sends short-circuit before hitting Resend.
  //   2. Cancel pending email_drip_queue rows by email (covers every
  //      company / template, not just one company's prospect sequence).
  //   3. Log prospect_events rows so the /admin/sales popup timeline
  //      surfaces the bounce/complaint alongside other funnel events.
  if ((type === "email.bounced" || type === "email.complained") && recipientEmail) {
    const isBounce = type === "email.bounced"
    const stampField = isBounce ? "bounced_at" : "complained_at"
    const cancelReason = isBounce ? "bounced" : "complained"

    try {
      const { data: affected } = await (supabase as any)
        .from("prospects")
        .update({ [stampField]: now })
        .ilike("email", recipientEmail)
        .is(stampField, null)
        .select("id")

      const affectedIds = ((affected ?? []) as Array<{ id: string }>).map((r) => r.id)
      if (affectedIds.length > 0) {
        await supabase.from("prospect_events").insert(
          affectedIds.map((id) => ({
            prospect_id: id,
            event_type: cancelReason,
            metadata: { email: recipientEmail, message_id: messageId ?? null },
          })),
        )
      }

      const { cancelPendingDripRows } = await import("@/lib/drip-queue")
      await cancelPendingDripRows(supabase, {
        email: recipientEmail,
        reason: cancelReason,
      })
    } catch (err) {
      console.error(
        "[resend-webhook] Failed to record bounce/complaint",
        { email: recipientEmail, type, err },
      )
    }
  }

  // Update prospects table based on recipient email
  if (recipientEmail) {
    const { data: prospect } = await supabase
      .from("prospects")
      .select("id, status, company_id, company_name, apollo_contact_id, landing_visited_at, emails_sent, emails_delivered, emails_opened, emails_clicked")
      .eq("email", recipientEmail)
      .maybeSingle()

    if (prospect) {
      const updates: Record<string, unknown> = {}
      // A click on an email link means the prospect landed on the site,
      // even when the ref-code tracking misses them (other device,
      // stripped params, forwarded mail). Promote Contacted -> Visitor
      // so the funnel doesn't undercount. Never downgrades: only fires
      // from 'contacted', so visitor/signup/company/active stay
      // untouched.
      //
      // The trade-off this used to name — scanner auto-clicks accepted
      // as the price of not losing real visitors — no longer holds.
      // Real visitors are caught by the claim page, which records
      // arrivals server-side with its own country and user-agent
      // filter, so the only thing a lenient rule here still bought was
      // the false visits. Flagged clicks are skipped above.
      let promotedToVisitor = false

      switch (type) {
        case "email.delivered":
          updates.emails_delivered = (prospect.emails_delivered ?? 0) + 1
          break
        case "email.opened":
          // Machine prefetch — recorded in email_events (flagged) but
          // kept out of the prospect's engagement counters.
          if (machineOpen) break
          updates.emails_opened = (prospect.emails_opened ?? 0) + 1
          updates.last_email_opened_at = now
          break
        case "email.clicked":
          // A flagged click is a scanner: it stays in email_events but
          // moves nothing. It used to count and promote, which is how
          // marketing@wolterinck.com became a Visitor thirty-three
          // seconds after her intro was sent, on two links six
          // milliseconds apart.
          if (machineOpen) break
          updates.emails_clicked = (prospect.emails_clicked ?? 0) + 1
          updates.last_email_clicked_at = now
          if ((prospect as { status?: string }).status === "contacted") {
            promotedToVisitor = true
            updates.status = "visitor"
            if (!(prospect as { landing_visited_at?: string | null }).landing_visited_at) {
              updates.landing_visited_at = now
            }
          }
          break
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("prospects").update(updates).eq("id", prospect.id)
      }

      if (promotedToVisitor) {
        await supabase.from("prospect_events").insert({
          prospect_id: prospect.id,
          event_type: "prospect.landing_visited",
          event_source: "resend_webhook",
          old_status: "contacted",
          new_status: "visitor",
          metadata: { via: "email_click", message_id: messageId ?? null },
        } as never)

        // Visitor status implies the visitor sequence: this promotion
        // path schedules the nudge exactly like the ref-code landing
        // visit does (shared helper, deduped per address).
        try {
          const { enqueueVisitorNudge } = await import("@/lib/prospect-ref")
          await enqueueVisitorNudge(supabase, {
            email: recipientEmail,
            company_id: (prospect as { company_id?: string | null }).company_id ?? null,
            company_name: (prospect as { company_name?: string | null }).company_name ?? null,
          })
        } catch (err) {
          console.error("[resend-webhook] Failed to enqueue visitor nudge on click-visit", err)
        }

        // Apollo: contact stage directly, account stage via the resolver
        // (single owner of that field). Both non-blocking.
        const apolloContactId = (prospect as { apollo_contact_id?: string | null }).apollo_contact_id
        if (apolloContactId) {
          try {
            const { updateContactStage } = await import("@/lib/apollo-client")
            await updateContactStage(apolloContactId, "Visitor")
          } catch (err) {
            console.error("[resend-webhook] Failed to sync Apollo contact stage on click-visit", err)
          }
        }
        const companyId = (prospect as { company_id?: string | null }).company_id
        if (companyId) {
          try {
            const { syncCompanyToApollo } = await import("@/lib/company-apollo-sync")
            await syncCompanyToApollo(companyId)
          } catch (err) {
            console.error("[resend-webhook] Failed to sync Apollo account stage on click-visit", err)
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
