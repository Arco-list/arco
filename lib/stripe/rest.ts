import "server-only"

/**
 * A hand-rolled Stripe client, deliberately.
 *
 * We need exactly two calls — open a Checkout session, open a Customer
 * Portal session — and both are plain form-encoded POSTs. Pulling in the
 * SDK for that would add a dependency (and, right now, a fight with a
 * pnpm store mismatch) for no gain. If we ever verify webhook
 * signatures or touch the wider API surface, the SDK earns its place
 * then: this is the wrong place to re-implement cryptography.
 */

const API = "https://api.stripe.com/v1"

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY is not set")
    this.name = "StripeNotConfiguredError"
  }
}

/** A key is present, but something it needs alongside it is not. */
export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StripeConfigError"
  }
}

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new StripeNotConfiguredError()
  return key
}

/** Stripe takes nested params as bracketed keys: items[0][price]=… */
function encode(params: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = []
  for (const [rawKey, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const key = prefix ? `${prefix}[${rawKey}]` : rawKey
    if (Array.isArray(value)) {
      value.forEach((entry, i) => {
        if (entry && typeof entry === "object") out.push(...encode(entry as Record<string, unknown>, `${key}[${i}]`))
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(entry))}`)
      })
    } else if (typeof value === "object") {
      out.push(...encode(value as Record<string, unknown>, key))
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
  }
  return out
}

export async function stripePost<T = Record<string, unknown>>(
  path: string,
  params: Record<string, unknown>,
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Stripe replays a repeated key rather than charging twice — cheap
      // insurance against a double-clicked button.
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: encode(params).join("&"),
  })

  const json = (await res.json()) as T & { error?: { message?: string; type?: string; code?: string } }
  if (!res.ok) {
    // Stripe's own code travels with the error. Without it a caller can
    // only match on prose, and every failure collapses into one
    // indistinguishable "something went wrong".
    const err = new Error(json?.error?.message ?? `Stripe ${path} failed with ${res.status}`)
    ;(err as Error & { stripeCode?: string }).stripeCode = json?.error?.code
    throw err
  }
  return json
}

export async function stripeGet<T = Record<string, unknown>>(
  path: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T> {
  const search = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&")

  const res = await fetch(`${API}${path}${search ? `?${search}` : ""}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    // Billing data changes on Stripe's schedule, not ours: never serve
    // a cached invoice list.
    cache: "no-store",
  })
  const json = (await res.json()) as T & { error?: { message?: string } }
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe ${path} failed with ${res.status}`)
  return json
}

/**
 * Cancel an object, which for Stripe means DELETE on the object itself.
 *
 * There is no POST /subscriptions/:id/cancel, however naturally it
 * reads. Sending one returns "Unrecognized request URL" — an error the
 * caller catches and logs, which is how a subscription meant to be
 * cancelled on a declined first payment sat there as `incomplete` with
 * an open invoice on the customer's screen.
 */
export async function stripeDelete<T = Record<string, unknown>>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${secretKey()}` },
  })
  const json = (await res.json()) as T & { error?: { message?: string; code?: string } }
  if (!res.ok) {
    const err = new Error(json?.error?.message ?? `Stripe DELETE ${path} failed with ${res.status}`)
    ;(err as Error & { stripeCode?: string }).stripeCode = json?.error?.code
    throw err
  }
  return json
}

/** True when the app has a key at all — lets the UI say something
 *  useful instead of throwing at a visitor. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

/** True when the key in use is a live one. */
const isLiveKey = () => Boolean(process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live"))

/**
 * A Stripe object id from the environment, with a sandbox fallback.
 *
 * The fallbacks are the sandbox objects created on 15 Sep 2026, and in
 * the sandbox they save a step. Against a live key they are worse than
 * useless: those objects do not exist there, so a missing variable on
 * the deploy would surface as "No such price" in front of whoever was
 * trying to pay — a broken checkout with nothing pointing at the cause.
 *
 * Resolved on use rather than at import, so a build never fails for a
 * variable no page on it needs.
 */
function stripeObjectId(value: string | undefined, sandbox: string, name: string): string {
  const v = value?.trim()
  if (v) return v
  if (isLiveKey()) {
    throw new StripeConfigError(
      `${name} must be set: a live Stripe key cannot use the sandbox fallback.`,
    )
  }
  return sandbox
}

/** The price for a billing interval. */
export function priceId(interval: "month" | "year"): string {
  return interval === "month"
    ? stripeObjectId(process.env.STRIPE_PRICE_PRO_MONTHLY, "price_1UG2idP09r3Qx4apiyFL0Uvr", "STRIPE_PRICE_PRO_MONTHLY")
    : stripeObjectId(process.env.STRIPE_PRICE_PRO_YEARLY, "price_1UG2fkP09r3Qx4apBFJZHSFu", "STRIPE_PRICE_PRO_YEARLY")
}

/** Dutch VAT, as a Stripe tax rate. */
export function taxRateId(): string {
  return stripeObjectId(process.env.STRIPE_TAX_RATE_NL, "txr_1UG2g4P09r3Qx4ap3RqHHZvN", "STRIPE_TAX_RATE_NL")
}
