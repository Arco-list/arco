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

  const json = (await res.json()) as T & { error?: { message?: string; type?: string } }
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Stripe ${path} failed with ${res.status}`)
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

/** True when the app has a key at all — lets the UI say something
 *  useful instead of throwing at a visitor. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

/** Price ids. Env first so test and live can differ without a deploy;
 *  the fallbacks are the sandbox objects created on 15 Sep 2026. */
export const PRICE_IDS = {
  yearly: process.env.STRIPE_PRICE_PRO_YEARLY?.trim() || "price_1UG2fkP09r3Qx4apBFJZHSFu",
  monthly: process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() || "price_1UG2idP09r3Qx4apiyFL0Uvr",
}

export const TAX_RATE_ID = process.env.STRIPE_TAX_RATE_NL?.trim() || "txr_1UG2g4P09r3Qx4ap3RqHHZvN"
