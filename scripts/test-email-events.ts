/**
 * Smoke test for email_events instrumentation.
 *
 * Bypasses lib/email-service.ts (which depends on `server-only` and won't
 * load outside Next.js). Replicates EXACTLY the row shape sendTransactional
 * Email writes after a successful Resend send, so a passing test means the
 * wrapper's insert payload is also valid.
 *
 * Run from project root:
 *   npx tsx --env-file=.env.local scripts/test-email-events.ts
 */
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

const TO = process.env.TEST_EMAIL_TO ?? "niek@arcolist.com"

async function main() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing")
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing")
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing")

  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  console.log(`→ Sending smoke-test email to ${TO}...`)
  const send = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Arco <automated@arcolist.com>",
    to: TO,
    subject: "[smoke test] email_events instrumentation",
    html: "<p>Smoke test for email_events. Safe to ignore.</p>",
    tags: [
      { name: "template", value: "smoke-test" },
      { name: "locale", value: "en" },
    ],
  })

  if (send.error || !send.data?.id) {
    console.error("✗ Resend rejected:", send.error)
    process.exit(1)
  }
  const messageId = send.data.id
  console.log(`✓ Resend accepted. message id: ${messageId}`)

  // Mirror exactly what sendTransactionalEmail's wrapper writes.
  const insertPayload = {
    provider: "resend",
    provider_event_id: messageId,
    event_type: "sent",
    recipient_email: TO,
    recipient_user_id: null,
    recipient_company_id: null,
    campaign_kind: "transactional",
    template: "smoke-test",
    subject: "[smoke test] email_events instrumentation",
    locale: "en",
    occurred_at: new Date().toISOString(),
    metadata: { resend_message_id: messageId },
  }

  console.log("→ Inserting email_events row...")
  const { error: insertErr } = await supabase
    .from("email_events" as never)
    .insert(insertPayload)
  if (insertErr) {
    console.error("✗ Insert failed:", insertErr)
    process.exit(1)
  }

  // Read it back.
  const { data, error: selectErr } = await supabase
    .from("email_events" as never)
    .select("*")
    .eq("provider_event_id", messageId)
    .single()

  if (selectErr) {
    console.error("✗ Read failed:", selectErr)
    process.exit(1)
  }

  console.log("✓ Row landed in email_events:")
  console.log(JSON.stringify(data, null, 2))
}

main().catch((err) => {
  console.error("Script error:", err)
  process.exit(1)
})
