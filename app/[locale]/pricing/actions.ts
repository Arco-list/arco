"use server"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { restoreHeldBackCredits } from "@/lib/subscriptions/enforce-credit-allowance"
import { notifySubscriber } from "@/lib/subscriptions/notify"
import { scheduleFoundingEnding } from "@/lib/subscriptions/schedule-mail"
import { foundingEndsAt, NET_CENTS } from "@/app/dashboard/subscription/checkout/constants"

/** Resolve the calling user's company id — owner first, then team
 *  membership via the legacy professionals table. */
async function resolveCompanyId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceRoleSupabaseClient()
  const { data: owned } = await service
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle()
  if (owned?.id) return owned.id

  const { data: membership } = await service
    .from("professionals")
    .select("company_id")
    .eq("user_id", user.id)
    .not("company_id", "is", null)
    .limit(1)
    .maybeSingle()
  return membership?.company_id ?? null
}

/** Whether the current user's company has claimed founding access. */
export async function getFoundingClaimStatus(): Promise<{ claimed: boolean }> {
  const companyId = await resolveCompanyId()
  if (!companyId) return { claimed: false }
  const service = createServiceRoleSupabaseClient()
  const { data } = await service
    .from("companies")
    .select("founding_claimed_at")
    .eq("id", companyId)
    .maybeSingle()
  return { claimed: Boolean((data as any)?.founding_claimed_at) }
}

/** Stamp the founding claim (idempotent — first click wins). The
 *  durable counterpart of the PostHog upgrade_intent event, and the
 *  counter behind the "first 100 companies" promise. */
export async function claimFoundingAccess(): Promise<{ claimed: boolean }> {
  const companyId = await resolveCompanyId()
  if (!companyId) return { claimed: false }
  const service = createServiceRoleSupabaseClient()
  const { data: stamped } = await service
    .from("companies")
    .update({ founding_claimed_at: new Date().toISOString() } as any)
    .eq("id", companyId)
    .is("founding_claimed_at", null)
    .select("id")

  // Founding access is Pro, so it owes the reader the same page a paid
  // Pro gets. The Stripe webhook restores held-back credits on an
  // upgrade; this path has no Stripe object and no webhook, so nothing
  // was restoring them — a founding member was given the unlimited
  // page and left with their projects still parked at the free limit.
  //
  // Only on the click that actually stamped. Running it again would
  // undo a later, deliberate "not this one" every time somebody
  // revisited the button.
  if ((stamped ?? []).length > 0) {
    await restoreHeldBackCredits(companyId)

    // And tell them, because nothing else will.
    //
    // Every other way onto Pro produces an invoice, and the invoice is
    // the confirmation — that is why there is no separate "welcome to
    // Pro" mail. Founding access has no invoice, so a company that
    // claimed it would get a page that quietly changed and not one
    // word about it, including the part that matters most: that it
    // ends, on a date, and renews into nothing.
    //
    // Both non-fatal. The claim itself has already succeeded.
    const claimedAt = new Date().toISOString()
    await notifySubscriber(companyId, "founding-active", {
      until_at: foundingEndsAt(claimedAt)?.toISOString() ?? null,
    })
    await scheduleFoundingEnding(companyId, claimedAt, NET_CENTS.month)
  }

  // Unchanged for the caller: a second click by somebody who already
  // has access is a success, not a failure.
  return { claimed: true }
}
