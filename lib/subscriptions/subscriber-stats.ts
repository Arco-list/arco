import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isEntitledNow } from "@/lib/subscriptions/entitlement"
import { NET_CENTS } from "@/app/dashboard/subscription/checkout/constants"

/**
 * How many companies pay us, and how much.
 *
 * One counter for five screens — the Sales funnel, the Companies
 * funnel, the mail funnel on /emails, the growth dashboard and the
 * model. Three of those drew this stage as a hardcoded zero, which is
 * the specific kind of wrong that gets believed: a monetization stage
 * reading nought is read as "nobody buys", not as "nobody counts".
 *
 * Two facts about the shape of the answer, both easy to get wrong.
 *
 * FOUNDING MEMBERS ARE SUBSCRIBERS. They hold Pro, they occupy the
 * monetization stage, and leaving them out would undercount the funnel
 * by most of its current population. They pay nothing, so they
 * contribute zero to MRR and dilute the average — which is the honest
 * reading during a launch period, and the reason `paying` is reported
 * beside `total` rather than folded into it.
 *
 * ONE COMPANY IS ONE SUBSCRIBER. A founding company that later starts
 * paying is the same company, so both sources go into one set.
 *
 * LIVE ONLY, WHATEVER KEY THIS IS RUNNING WITH. Everything here feeds
 * admin reporting — the funnels, the model, the Subscribed pill on
 * /companies and /sales — and reporting answers "what is this business"
 * rather than "what can this environment do". A dev server showing a
 * different customer count than production is a dashboard nobody can
 * quote.
 *
 * That is the opposite of the rule in getCompanyBilling and
 * hasLiveSubscription, and deliberately so: those two decide who gets
 * Pro and who may buy, and there a test subscription must count on a
 * dev server and must NOT count in production. The mode gate protects
 * the product; it has no business in the reporting.
 *
 * The cost is that a test subscription never appears in these numbers.
 * That is the right way round — a test sale is not a sale.
 */

export type SubscriberStats = {
  /** Companies entitled to Pro right now — paying or founding. */
  total: number
  /** The subset actually being charged. */
  paying: number
  /** Companies that became subscribers inside the window. Equals
   *  `total` when no window is given. */
  newInPeriod: number
  /** Monthly recurring revenue in cents, net of VAT — MRR is a revenue
   *  figure, and the 21% is never ours. */
  mrrCents: number
  /** MRR per subscriber, founding members included at zero. Keeps
   *  `total × avg = mrr` true, which is how the dashboard reads it. */
  avgMrrCents: number
}

export const EMPTY_SUBSCRIBER_STATS: SubscriberStats = {
  total: 0, paying: 0, newInPeriod: 0, mrrCents: 0, avgMrrCents: 0,
}

/**
 * What one subscription is worth per month, before tax.
 *
 * Derived from the interval rather than read back from Stripe: the
 * mirror stores which plan, not what it cost, and a per-row API call
 * for a number that is one of two constants would be a lot of
 * latency to learn something we already know.
 */
function monthlyCents(interval: string | null | undefined): number {
  return interval === "year" ? Math.round(NET_CENTS.year / 12) : NET_CENTS.month
}

/**
 * One row per subscriber, with the dates that bound it.
 *
 * For the table on /model, which does not want a single number but the
 * same number at eight different moments. Handing it the facts rather
 * than eight pre-computed answers keeps the bucketing where the
 * bucketing already lives, and means the card and the table cannot
 * disagree about who counts.
 */
export type SubscriberFact = {
  companyId: string
  /** When they became a subscriber. */
  startedAt: string | null
  /** When they stopped. Null while it is still running. */
  endedAt: string | null
  /** What they are worth per month, net of VAT. Zero for founding. */
  monthlyCents: number
}

export async function getSubscriberFacts(): Promise<SubscriberFact[]> {
  const supabase = createServiceRoleSupabaseClient()

  const [{ data: subs }, { data: founding }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("company_id, status, collection_pending_until, billing_interval, created_at, canceled_at, livemode"),
    supabase
      .from("companies")
      .select("id, founding_claimed_at")
      .not("founding_claimed_at", "is", null),
  ])

  const byCompany = new Map<string, SubscriberFact>()

  for (const row of (subs ?? []) as {
    company_id?: string | null
    status?: string | null
    collection_pending_until?: string | null
    billing_interval?: string | null
    created_at?: string | null
    canceled_at?: string | null
    livemode?: boolean | null
  }[]) {
    if (!row.company_id) continue
    if ((row.livemode ?? true) !== true) continue
    const alive = isEntitledNow(row.status, row.collection_pending_until)
    byCompany.set(row.company_id, {
      companyId: row.company_id,
      startedAt: row.created_at ?? null,
      // A live subscription has no end even if canceled_at is stamped:
      // cancel_at_period_end sets that date while access continues.
      endedAt: alive ? null : row.canceled_at ?? null,
      monthlyCents: alive ? monthlyCents(row.billing_interval) : 0,
    })
  }

  for (const row of (founding ?? []) as { id?: string | null; founding_claimed_at?: string | null }[]) {
    if (!row.id) continue
    const existing = byCompany.get(row.id)
    if (existing) {
      existing.startedAt = row.founding_claimed_at ?? existing.startedAt
      continue
    }
    // No end date, deliberately: getCompanyBilling grants Pro on the
    // claim alone and never checks whether the period ran out. These
    // numbers report what the product actually gives. If founding
    // access is ever made to expire, that rule and this line change
    // together — otherwise the funnel and the paywall disagree.
    byCompany.set(row.id, {
      companyId: row.id,
      startedAt: row.founding_claimed_at ?? null,
      endedAt: null,
      monthlyCents: 0,
    })
  }

  return [...byCompany.values()]
}

/**
 * Which companies hold Pro right now.
 *
 * For the admin tables, where "Subscribed" is a row's state rather
 * than a number in a funnel. Derived from the same facts as everything
 * else here, so a company cannot read as subscribed on one screen and
 * not on another — the mistake this module exists to prevent.
 *
 * Paying and founding both count: the question the tables ask is what
 * a company has, not what it pays.
 */
export async function getSubscribedCompanyIds(): Promise<Set<string>> {
  const facts = await getSubscriberFacts()
  return new Set(facts.filter((f) => !f.endedAt).map((f) => f.companyId))
}

export async function getSubscriberStats(sinceIso?: string): Promise<SubscriberStats> {
  const supabase = createServiceRoleSupabaseClient()

  const [{ data: subs }, { data: founding }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("company_id, status, collection_pending_until, billing_interval, created_at, livemode"),
    supabase
      .from("companies")
      .select("id, founding_claimed_at")
      .not("founding_claimed_at", "is", null),
  ])

  const since = sinceIso ? new Date(sinceIso).getTime() : null
  const startedInWindow = (at: string | null | undefined): boolean => {
    if (since === null) return true
    if (!at) return false
    const t = new Date(at).getTime()
    return !Number.isNaN(t) && t >= since
  }

  // Keyed by company so the two sources cannot double-count, and so a
  // founding company that later subscribes keeps the earlier of its two
  // start dates — it became a subscriber when it got Pro, not when it
  // started paying for it.
  const seen = new Map<string, { paying: boolean; startedAt: string | null; mrr: number }>()

  for (const row of (subs ?? []) as {
    company_id?: string | null
    status?: string | null
    collection_pending_until?: string | null
    billing_interval?: string | null
    created_at?: string | null
    livemode?: boolean | null
  }[]) {
    if (!row.company_id) continue
    // A test subscription is not revenue. Same table, both modes.
    if ((row.livemode ?? true) !== true) continue
    if (!isEntitledNow(row.status, row.collection_pending_until)) continue
    seen.set(row.company_id, {
      paying: true,
      startedAt: row.created_at ?? null,
      mrr: monthlyCents(row.billing_interval),
    })
  }

  for (const row of (founding ?? []) as { id?: string | null; founding_claimed_at?: string | null }[]) {
    if (!row.id) continue
    const existing = seen.get(row.id)
    if (existing) {
      // Already paying. Keep the revenue, but date them from the claim:
      // that is when they entered the funnel's last stage.
      existing.startedAt = row.founding_claimed_at ?? existing.startedAt
      continue
    }
    seen.set(row.id, { paying: false, startedAt: row.founding_claimed_at ?? null, mrr: 0 })
  }

  let paying = 0
  let newInPeriod = 0
  let mrrCents = 0
  for (const entry of seen.values()) {
    if (entry.paying) paying++
    mrrCents += entry.mrr
    if (startedInWindow(entry.startedAt)) newInPeriod++
  }

  const total = seen.size
  return {
    total,
    paying,
    newInPeriod,
    mrrCents,
    avgMrrCents: total > 0 ? Math.round(mrrCents / total) : 0,
  }
}
