"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { PUBLISHABLE_KEY, loadStripeJs } from "@/lib/stripe/load-stripe"
import {
  completeSubscriptionAction,
  replacePaymentMethodAction,
  startSetupAction,
  subscribeWithSavedMethodAction,
  type ElementsMethod,
} from "@/lib/subscriptions/elements-actions"

/**
 * The Elements half of the checkout.
 *
 * Individual elements rather than the Payment Element: the method cards
 * on this page are ours, and the Payment Element draws its own tabs
 * inside its own iframe. That is the whole trade of this integration —
 * we own the chrome, so we own the wiring.
 *
 * Each method confirms through its own call, because that is how
 * Stripe.js exposes them without the Payment Element:
 *   card  → confirmCardSetup      (3DS handled in place)
 *   sepa  → confirmSepaDebitSetup (mandate accepted by submitting)
 *   ideal → confirmIdealSetup     (leaves the page, comes back)
 */

/** Styling handed into Stripe's iframes, so the text inside the box we
 *  drew matches the text in the fields we drew ourselves. */
const ELEMENT_STYLE = {
  base: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "15px",
    color: "#1c1c1a",
    "::placeholder": { color: "#a1a1a0" },
  },
  invalid: { color: "#991b1b", iconColor: "#991b1b" },
}

export type CheckoutPhase = "idle" | "mounting" | "ready" | "confirming" | "done" | "error"

export function useElementsCheckout({
  method,
  interval,
  returnPath,
  resumeSetupIntent = null,
  purpose = "subscribe",
  enabled = true,
}: {
  method: ElementsMethod
  interval: "month" | "year"
  returnPath: string
  /** Set when the browser comes back from a bank: the mandate already
   *  exists, so there is nothing to mount — only a subscription left
   *  to build on it. */
  resumeSetupIntent?: string | null
  /** What the mandate is for: a new subscription, or a new payment
   *  method on one that is already running. */
  purpose?: "subscribe" | "replace"
  /** False while a saved method is selected: there is no mandate to
   *  collect, so nothing to mount and no SetupIntent to open. */
  enabled?: boolean
}) {
  const [phase, setPhase] = useState<CheckoutPhase>("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  // Keyed by element type, so the page can put each one under the box
  // it belongs to instead of collecting them at the bottom.
  const [elementErrors, setElementErrors] = useState<Record<string, string | null>>({})
  // Stripe reports completeness as you type. Without it the page cannot
  // tell an untouched field from a finished one, and "what is missing?"
  // has no answer until Stripe refuses the whole thing.
  const [complete, setComplete] = useState<Record<string, boolean>>({})

  const stripeRef = useRef<any>(null)
  const elementsRef = useRef<any>(null)
  const fieldsRef = useRef<Record<string, any>>({})
  const secretRef = useRef<{ clientSecret: string; returnUrl: string } | null>(null)
  // Read at the moment of finishing, never depended on. The billing
  // cycle has nothing to do with collecting a mandate, but while it sat
  // in a callback's dependencies it changed that callback's identity,
  // which re-ran the effect, which tore the Stripe elements down and
  // built them again — emptying a typed IBAN on a switch from monthly
  // to yearly.
  const intervalRef = useRef(interval)
  intervalRef.current = interval
  // One SetupIntent per method, kept across remounts. React mounts an
  // effect twice in development — mount, clean up, mount — and without
  // this that second pass opened a second intent every time. The
  // elements still have to be rebuilt on the second pass, so only the
  // intent is cached, never the mounting.
  const secretByKey = useRef<Record<string, { clientSecret: string; returnUrl: string }>>({})

  /** Mount the fields this method needs into the boxes the page drew. */
  const mount = useCallback(async () => {
    if (!enabled) {
      // Nothing to collect, so the page is as ready as it will get.
      setPhase("ready")
      setMessage(null)
      return
    }

    if (!PUBLISHABLE_KEY) {
      setMessage("not_configured")
      setPhase("error")
      return
    }

    setPhase("mounting")
    setMessage(null)

    try {
      const Stripe = await loadStripeJs()
      const stripe = stripeRef.current ?? Stripe(PUBLISHABLE_KEY)
      stripeRef.current = stripe

      // One per method: the intent names the method it will accept, so
      // switching cards needs its own. Switching back reuses the one
      // already opened — an unconfirmed intent stays usable.
      const key = `${purpose}:${method}`
      let secret = secretByKey.current[key]
      if (!secret) {
        const started = await startSetupAction(method, returnPath, purpose)
        if (!("clientSecret" in started)) {
          setMessage(started.error)
          setPhase("error")
          return
        }
        secret = started
        secretByKey.current[key] = started
      }
      secretRef.current = secret

      // Tear down whatever the previous method left behind, or Stripe
      // refuses to mount a second element into the same node.
      Object.values(fieldsRef.current).forEach((el: any) => el?.destroy?.())
      fieldsRef.current = {}
      setElementErrors({})
      setComplete({})

      const elements = stripe.elements({ locale: "nl" })
      elementsRef.current = elements

      const create = (type: string, node: string, options: Record<string, unknown> = {}) => {
        const target = document.getElementById(node)
        if (!target) return
        const el = elements.create(type, { style: ELEMENT_STYLE, ...options })
        // Stripe validates as you type; the message is theirs and it
        // names the actual problem far better than we could.
        el.on("change", (event: any) => {
          setElementErrors((prev) => ({ ...prev, [type]: event?.error?.message ?? null }))
          setComplete((prev) => ({ ...prev, [type]: Boolean(event?.complete) }))
        })
        el.mount(target)
        fieldsRef.current[type] = el
      }

      if (method === "card") {
        create("cardNumber", "el-card-number", { showIcon: true })
        create("cardExpiry", "el-card-expiry")
        create("cardCvc", "el-card-cvc")
      } else if (method === "sepa") {
        create("iban", "el-iban", { supportedCountries: ["SEPA"], placeholderCountry: "NL" })
      }
      // iDEAL mounts nothing. Stripe's idealBank element is a select
      // inside an iframe — the browser's own arrow, Stripe's own type
      // size, unreachable by our CSS. The bank travels as a plain
      // value instead, so the list can be an ordinary Arco field.

      setPhase("ready")
    } catch {
      setMessage("failed")
      setPhase("error")
    }
  }, [enabled, method, purpose, returnPath])

  /** Subscribe on the mandate we already hold: one call, no elements. */
  const confirmSaved = useCallback(async (interval2: "month" | "year") => {
    setPhase("confirming")
    setMessage(null)
    const finished = await subscribeWithSavedMethodAction(interval2)
    if ("error" in finished) {
      setMessage(finished.error)
      setPhase("error")
      return
    }
    setStatus(finished.status)
    setPhase("done")
  }, [])

  /** The last step, which is the only part the two purposes differ on. */
  const finish = useCallback(async (setupIntentId: string) => {
    if (purpose === "replace") {
      const replaced = await replacePaymentMethodAction(setupIntentId)
      if ("error" in replaced) {
        setMessage(replaced.error)
        setPhase("error")
        return
      }
      setStatus("replaced")
      setPhase("done")
      return
    }

    const finished = await completeSubscriptionAction(setupIntentId, intervalRef.current)
    if ("error" in finished) {
      setMessage(finished.error)
      setPhase("error")
      return
    }
    setStatus(finished.status)
    setPhase("done")
  }, [purpose])

  /** Finish what a redirect started. */
  const resume = useCallback(async (setupIntentId: string) => {
    setPhase("confirming")
    await finish(setupIntentId)
  }, [finish])

  useEffect(() => {
    if (resumeSetupIntent) {
      void resume(resumeSetupIntent)
      return
    }
    void mount()
    return () => {
      Object.values(fieldsRef.current).forEach((el: any) => el?.destroy?.())
      fieldsRef.current = {}
    }
  }, [mount, resume, resumeSetupIntent])

  /**
   * Confirm the mandate, then build the subscription on it. For iDEAL
   * the page leaves here and the second half happens on the way back.
   */
  const confirm = useCallback(
    async ({ name, email, bank }: { name: string; email: string; bank?: string }) => {
      const stripe = stripeRef.current
      const secret = secretRef.current
      if (!stripe || !secret) {
        setMessage("failed")
        setPhase("error")
        return
      }

      setPhase("confirming")
      setMessage(null)

      const billing_details = { name, email }

      try {
        let result: any
        if (method === "card") {
          result = await stripe.confirmCardSetup(secret.clientSecret, {
            payment_method: { card: fieldsRef.current.cardNumber, billing_details },
          })
        } else if (method === "sepa") {
          result = await stripe.confirmSepaDebitSetup(secret.clientSecret, {
            payment_method: { sepa_debit: fieldsRef.current.iban, billing_details },
          })
        } else {
          // The bank comes from our own select rather than Stripe's
          // element, so it travels as a value. Built first, confirmed
          // by id — there is no element to hand over.
          const built = await stripe.createPaymentMethod({
            type: "ideal",
            ideal: bank ? { bank } : {},
            billing_details,
          })
          if (built?.error) {
            setMessage(built.error.message ?? "failed")
            setPhase("error")
            return
          }
          // Redirects to the bank and returns to returnUrl with the
          // intent in the query string; nothing below this runs.
          result = await stripe.confirmIdealSetup(secret.clientSecret, {
            payment_method: built.paymentMethod.id,
            return_url: secret.returnUrl,
          })
        }

        if (result?.error) {
          setMessage(result.error.message ?? "failed")
          setPhase("error")
          return
        }

        const setupIntentId = result?.setupIntent?.id
        if (!setupIntentId) {
          setMessage("failed")
          setPhase("error")
          return
        }

        await finish(setupIntentId)
      } catch {
        setMessage("failed")
        setPhase("error")
      }
    },
    [finish, method],
  )

  /** After a failure, start over with a fresh intent rather than the
   *  one that just did not work. */
  const retry = useCallback(() => {
    secretByKey.current = {}
    void mount()
  }, [mount])

  return { phase, message, status, elementErrors, complete, confirm, confirmSaved, retry }
}
