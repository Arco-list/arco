"use client"

import { useState } from "react"
import { CreditCard, Landmark, Lock, Repeat, Wallet, X } from "lucide-react"

import { FormSelect } from "@/components/form-select"
import { HeaderLanguageSwitcher } from "@/components/header-language-switcher"
import { Link } from "@/i18n/navigation"

import { IDEAL_BANKS } from "../checkout/constants"
import { useElementsCheckout } from "../checkout/use-elements-checkout"

/**
 * Change the payment method on a running subscription.
 *
 * The checkout page without the shop: same method cards, same Stripe
 * elements in the same boxes, same mandate — but no plan, no price and
 * no summary, because none of that is changing. What ends here is a
 * mandate pointed at a subscription that already exists.
 */

const MESSAGES: Record<string, string> = {
  not_configured: "Stripe is nog niet gekoppeld.",
  not_signed_in: "Je bent niet ingelogd.",
  no_company: "Je hebt nog geen bedrijf op Arco.",
  not_owner: "Alleen de eigenaar van het bedrijf kan de betaalmethode wijzigen.",
  not_ready: "De machtiging is nog niet rond. Probeer het zo nog eens.",
  nothing_to_replace: "Er loopt geen abonnement om een betaalmethode voor te wijzigen.",
  failed: "Dat lukte niet. Probeer het zo nog eens.",
}

export function PaymentMethodClient({
  returnTo,
  currentLabel,
  defaultEmail,
  resumeSetupIntent = null,
}: {
  returnTo: string
  /** What is on the subscription today, in words. */
  currentLabel: string | null
  defaultEmail: string
  resumeSetupIntent?: string | null
}) {
  const [method, setMethod] = useState<"ideal" | "sepa" | "card">("ideal")
  const [name, setName] = useState("")
  const [bank, setBank] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({})

  const checkout = useElementsCheckout({
    method,
    interval: "year", // Unused when replacing; the plan is not changing.
    returnPath: returnTo,
    resumeSetupIntent,
    purpose: "replace",
  })

  const errOf = (key: string) => checkout.elementErrors[key] ?? fieldErrors[key] ?? null
  const inputCls = (key: string) => `form-input${errOf(key) ? " form-input--error" : ""}`
  const elCls = (key: string) => `checkout-element${errOf(key) ? " checkout-element--error" : ""}`
  const note = (msg: string | null) => (msg ? <p className="form-note form-note--error">{msg}</p> : null)

  const cardErrors = () => {
    const done = {
      cardNumber: Boolean(checkout.complete.cardNumber),
      cardExpiry: Boolean(checkout.complete.cardExpiry),
      cardCvc: Boolean(checkout.complete.cardCvc),
    }
    if (!done.cardNumber && !done.cardExpiry && !done.cardCvc) {
      return { cardNumber: "Vul je kaartgegevens in.", cardExpiry: null, cardCvc: null }
    }
    return {
      cardNumber: done.cardNumber ? null : "Vul je kaartnummer in.",
      cardExpiry: done.cardExpiry ? null : "Vul de vervaldatum in.",
      cardCvc: done.cardCvc ? null : "Vul de CVC in.",
    }
  }

  const validate = () => {
    const next: Record<string, string | null> = {
      name: name.trim() ? null : "Vul de naam in zoals die op de rekening staat.",
      bank: method === "ideal" && !bank ? "Kies je bank." : null,
      ...(method === "sepa" && !checkout.complete.iban ? { iban: "Vul je IBAN in." } : { iban: null }),
      ...(method === "card" ? cardErrors() : { cardNumber: null, cardExpiry: null, cardCvc: null }),
    }
    setFieldErrors(next)
    return !Object.values(next).some(Boolean)
  }

  const busy = checkout.phase === "confirming" || checkout.phase === "mounting"

  return (
    <div className="checkout-page">
      <div className="checkout-strip">
        <div className="checkout-wrap checkout-strip-inner">
          <span>Elements op de Stripe-sandbox. Er gaat geen echt geld doorheen.</span>
        </div>
      </div>

      <header className="checkout-bar">
        <div className="checkout-bar-inner">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
            alt="Arco"
            className="h-auto w-[48px]"
            style={{ filter: "brightness(0)" }}
          />
          <div className="checkout-bar-right">
            <HeaderLanguageSwitcher />
            <Link href={returnTo} className="checkout-close" aria-label="Sluiten">
              <X size={18} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </header>

      <div className="checkout-wrap">
        <div className="discover-page-title">
          <h1 className="arco-section-title">
            {checkout.phase === "done" ? "Gelukt" : "Betaalmethode wijzigen"}
          </h1>
        </div>

        <div className="checkout-grid checkout-grid--single" style={{ paddingBottom: 96 }}>
          {checkout.phase === "done" ? (
            <aside className="checkout-summary">
              <h2 className="arco-subsection-title" style={{ marginBottom: 12 }}>Betaalmethode gewijzigd</h2>
              <p className="form-note" style={{ margin: "0 0 20px" }}>
                De volgende afschrijving gaat van je nieuwe rekening. De oude machtiging is ingetrokken.
              </p>
              <Link
                href={returnTo}
                className="btn-primary"
                style={{ display: "inline-block", width: "100%", textAlign: "center", padding: "12px 20px", fontSize: 15, fontWeight: 500 }}
              >
                Naar je abonnement
              </Link>
            </aside>
          ) : (
            <div>
              {/* A value, not a caption. As grey running text under the
                  title this read as an explainer about the page and got
                  skipped; boxed like every other known value on the
                  platform it reads as a fact about your account. */}
              {/* The same card the checkout uses for a saved mandate, so
                  the two pages rhyme — but a div, not a button. Here it
                  is the thing being replaced, and there is nothing to
                  choose about it. */}
              {currentLabel && (
                <div className="status-modal-option checkout-method-saved" style={{ cursor: "default", marginBottom: 6 }}>
                  <Wallet size={18} strokeWidth={1.5} className="checkout-method-icon" />
                  <div className="status-modal-option-text">
                    <span className="status-modal-option-label">Huidige betaalmethode</span>
                    <span className="status-modal-option-desc">
                      {currentLabel} — wordt losgekoppeld zodra de nieuwe werkt
                    </span>
                  </div>
                </div>
              )}

              <section className="checkout-section" style={{ marginTop: 28 }}>
              <h2 className="checkout-legend">Betalen met</h2>

              <div className="checkout-methods">
                {([
                  { key: "ideal", label: "iDEAL | Wero", desc: "Betaal en machtig ons in één keer", Icon: Landmark },
                  { key: "sepa", label: "SEPA-incasso", desc: "Automatische incasso", Icon: Repeat },
                  { key: "card", label: "Kaart", desc: "Visa, Mastercard, Amex", Icon: CreditCard },
                ] as const).map(({ key, label, desc, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMethod(key)}
                    className={`status-modal-option${method === key ? " selected" : ""}`}
                  >
                    <Icon size={18} strokeWidth={1.5} className="checkout-method-icon" />
                    <div className="status-modal-option-text">
                      <span className="status-modal-option-label">{label}</span>
                      <span className="status-modal-option-desc">{desc}</span>
                    </div>
                  </button>
                ))}
              </div>

              {method === "ideal" && (
                <>
                  <label className="form-label" htmlFor="bank">Je bank</label>
                  <FormSelect
                    id="bank"
                    value={bank}
                    className={fieldErrors.bank ? "form-input--error" : undefined}
                    wrapStyle={fieldErrors.bank ? { marginBottom: 0 } : undefined}
                    onChange={(e) => {
                      setBank(e.target.value)
                      setFieldErrors((prev) => ({ ...prev, bank: null }))
                    }}
                  >
                    <option value="" disabled>Kies je bank</option>
                    {IDEAL_BANKS.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </FormSelect>
                  {note(fieldErrors.bank)}
                </>
              )}

              {method === "sepa" && (
                <>
                  <label className="form-label">IBAN</label>
                  <div id="el-iban" className={elCls("iban")} style={errOf("iban") ? { marginBottom: 0 } : undefined} />
                  {note(errOf("iban"))}
                </>
              )}

              {method === "card" && (
                <>
                  <label className="form-label">Kaartnummer</label>
                  <div id="el-card-number" className={elCls("cardNumber")} style={errOf("cardNumber") ? { marginBottom: 0 } : undefined} />
                  {note(errOf("cardNumber"))}

                  <div className="form-row">
                    <div>
                      <label className="form-label">Vervaldatum</label>
                      <div id="el-card-expiry" className={elCls("cardExpiry")} style={errOf("cardExpiry") ? { marginBottom: 0 } : undefined} />
                      {note(errOf("cardExpiry"))}
                    </div>
                    <div>
                      <label className="form-label">CVC</label>
                      <div id="el-card-cvc" className={elCls("cardCvc")} style={errOf("cardCvc") ? { marginBottom: 0 } : undefined} />
                      {note(errOf("cardCvc"))}
                    </div>
                  </div>
                </>
              )}

              <label className="form-label" htmlFor="holder">Naam rekeninghouder</label>
              <input
                id="holder"
                className={inputCls("name")}
                placeholder="Volledige naam"
                value={name}
                style={errOf("name") ? { marginBottom: 0 } : undefined}
                onChange={(e) => {
                  setName(e.target.value)
                  setFieldErrors((prev) => ({ ...prev, name: null }))
                }}
              />
              {note(errOf("name"))}

              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: 12, padding: "12px 20px", fontSize: 15, fontWeight: 500, opacity: busy ? 0.6 : 1 }}
                disabled={busy}
                onClick={() => {
                  if (!validate()) return
                  checkout.confirm({ name, email: defaultEmail, bank })
                }}
              >
                {busy ? "Bezig…" : "Betaalmethode wijzigen"}
              </button>

              {checkout.phase === "error" && checkout.message && (
                <p className="form-note form-note--error" style={{ marginTop: 10 }}>
                  {MESSAGES[checkout.message] ?? checkout.message}
                </p>
              )}

              <p className="checkout-secure" style={{ marginTop: 20 }}>
                <Lock size={12} strokeWidth={1.5} />
                Je betaalgegevens gaan rechtstreeks naar Stripe, onze betaaldienstverlener. Arco slaat ze niet op.
              </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
