/**
 * Who may use Pro, decided from a subscription's own fields.
 *
 * Its own module, and deliberately free of imports. The rule used to
 * live inside get-company-subscription.ts, which opens with
 * `import "server-only"` and a database client — so the one piece of
 * this file that is pure arithmetic could not be run, or tested,
 * without a server and a Supabase connection behind it.
 *
 * ALIVE is exported alongside because the same question has a second
 * half: a subscription can exist at Stripe without entitling anyone,
 * and the page still has to render it.
 */

/**
 * Statuses that still carry entitlements.
 *
 * `past_due` is included and `unpaid` is not, and the line between them
 * is Stripe's own: past_due means the retries are still running, and
 * with SEPA a collection takes days — a company that just committed to
 * €468 must not lose its page while the bank moves. `unpaid` means
 * every retry has been spent. That is dunning finishing its work, not
 * a status flag being read too eagerly.
 *
 * An unpaid subscription is not gone, though: Stripe keeps it, and
 * paying the outstanding invoice brings it back to active. So the page
 * still renders it — see `plan` below, which drops to free while the
 * subscription itself stays on screen with its invoice and a way to
 * settle it.
 */
export const ENTITLED: ReadonlySet<string> = new Set(["trialing", "active", "past_due"])

/** Statuses where a subscription still exists at Stripe, entitled or not. */
export const ALIVE: ReadonlySet<string> = new Set([...ENTITLED, "unpaid"])

export function isEntitled(status: string | null | undefined): boolean {
  return Boolean(status && ENTITLED.has(status))
}

/**
 * Entitled, or paying to become entitled again.
 *
 * `past_due` is already in ENTITLED because Stripe puts a subscription
 * there for the days a SEPA debit spends in transit, and taking the
 * product away for those days would punish people for using the method
 * we steer them towards. The trip back from `unpaid` is the same
 * journey with a different label on it: a working mandate given, a
 * fresh debit travelling, two to five working days of waiting.
 *
 * So what decides is whether money is moving, not the label. The
 * deadline is written when a repair starts collecting and expires by
 * itself, so a debit that quietly fails costs a few days of access
 * rather than granting Pro forever.
 *
 * Deliberately blind to whether this company has failed to pay before.
 * It knew, briefly: a repeat offender got no credit on `past_due`
 * until their money had arrived once. The rule worked and was still
 * the wrong trade. Cancelling a first period the moment its payment
 * fails already cut the free ride from three weeks to the days a debit
 * spends in transit, and what remained asked a fraudster to re-enter a
 * mandate every few days, forever, to avoid €49 a month. Two more
 * parameters in the function that decides whether someone may use what
 * they paid for is a steep price for that, and being wrong here denies
 * a paying customer.
 *
 * `companies.nonpayment_cancellations` still counts. Keeping the
 * record costs a line and leaves the evidence if this ever stops being
 * hypothetical — at which point the gate is an hour's work, because
 * the column is already there.
 */
export function isEntitledNow(
  status: string | null | undefined,
  collectionPendingUntil: string | null | undefined,
): boolean {
  if (isEntitled(status)) return true
  if (status !== "unpaid" || !collectionPendingUntil) return false
  return new Date(collectionPendingUntil).getTime() > Date.now()
}
