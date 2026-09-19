"use client"

/**
 * Stripe.js, loaded by hand.
 *
 * It has to come from Stripe's own domain — bundling a copy is against
 * their terms and would drag the page into a PCI scope the iframes
 * exist to avoid. The @stripe/stripe-js package is only this loader,
 * and it cannot be installed in this checkout anyway (the pnpm store is
 * a version ahead of the lockfile), so this is the package.
 *
 * Shared by the embedded Checkout page and the Elements checkout: one
 * script tag for the document, however many pages ask for it.
 */

const STRIPE_JS = "https://js.stripe.com/v3/"

const stripeGlobal = () => (window as unknown as { Stripe?: (key: string) => any }).Stripe

let loading: Promise<(key: string) => any> | null = null

export function loadStripeJs(): Promise<(key: string) => any> {
  const ready = stripeGlobal()
  if (ready) return Promise.resolve(ready)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${STRIPE_JS}"]`)
    const script = existing ?? document.createElement("script")

    script.addEventListener("load", () => {
      const loaded = stripeGlobal()
      if (loaded) resolve(loaded)
      else reject(new Error("Stripe.js loaded without defining window.Stripe"))
    })
    script.addEventListener("error", () => {
      // A failed load must not be cached as the answer: the next caller
      // should get a fresh attempt rather than the same rejection.
      loading = null
      reject(new Error("Stripe.js failed to load"))
    })

    if (!existing) {
      script.src = STRIPE_JS
      script.async = true
      document.head.appendChild(script)
    }
  })

  return loading
}

export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
