"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, CreditCard, Landmark, Lock, Repeat, Wallet, X } from "lucide-react"

import { FormSelect } from "@/components/form-select"
import { HeaderLanguageSwitcher } from "@/components/header-language-switcher"
import { Link, useRouter } from "@/i18n/navigation"

import { useElementsCheckout } from "../checkout/use-elements-checkout"

/**
 * Change the payment method on a running subscription.
 *
 * The checkout page without the shop: same method cards, same Stripe
 * elements in the same boxes, same mandate — but no plan, no price and
 * no summary, because none of that is changing. What ends here is a
 * mandate pointed at a subscription that already exists.
 */

export function PaymentMethodClient({
  returnTo,
  currentLabel,
  collectionFailed = false,
  defaultEmail,
  resumeSetupIntent = null,
}: {
  returnTo: string
  /** What is on the subscription today, in words. */
  currentLabel: string | null
  /** True when the reader came here because a collection failed. The
   *  card then marks the method as the problem rather than as the one
   *  being politely replaced. */
  collectionFailed?: boolean
  defaultEmail: string
  resumeSetupIntent?: string | null
}) {
  const t = useTranslations("payment_method")
  const router = useRouter()
  const [method, setMethod] = useState<"ideal" | "sepa" | "card">("ideal")
  const [name, setName] = useState("")
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
      return { cardNumber: t("err_card"), cardExpiry: null, cardCvc: null }
    }
    return {
      cardNumber: done.cardNumber ? null : t("err_card_number"),
      cardExpiry: done.cardExpiry ? null : t("err_card_expiry"),
      cardCvc: done.cardCvc ? null : t("err_card_cvc"),
    }
  }

  const validate = () => {
    const next: Record<string, string | null> = {
      name: name.trim() ? null : t("err_name"),
      ...(method === "sepa" && !checkout.complete.iban ? { iban: t("err_iban") } : { iban: null }),
      ...(method === "card" ? cardErrors() : { cardNumber: null, cardExpiry: null, cardCvc: null }),
    }
    setFieldErrors(next)
    return !Object.values(next).some(Boolean)
  }

  // Same as the checkout: the news belongs on the page it is about,
  // and an iDEAL mandate returns through the bank on a fresh load, so
  // the outcome travels in the URL rather than in state.
  useEffect(() => {
    if (checkout.phase !== "done") return
    const sep = returnTo.includes("?") ? "&" : "?"
    // Three different pieces of news: the next charge moves, the one
    // already owed is on its way, or it has just been paid.
    router.replace(`${returnTo}${sep}payment_method=${checkout.status ?? "changed"}`)
  }, [checkout.phase, checkout.status, returnTo, router])

  // "done" counts as busy: the confirmation is on the subscription
  // page and the reader is on their way there, so nothing should be
  // drawn here that would flash past on the way out.
  const busy = checkout.phase === "confirming" || checkout.phase === "mounting" || checkout.phase === "done"

  return (
    <div className="checkout-page">
      <div className="checkout-strip">
        <div className="checkout-wrap checkout-strip-inner">
          <span>{t("test_mode")}</span>
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
            <Link href={returnTo} className="checkout-close" aria-label={t("close")}>
              <X size={18} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </header>

      <div className="checkout-wrap">
        <div className="discover-page-title">
          <h1 className="arco-section-title">
            {t(collectionFailed ? "title_repair" : "title_change")}
          </h1>
        </div>

        <div className="checkout-grid checkout-grid--single" style={{ paddingBottom: 96 }}>
          {(
            <div>
              {/* A value, not a caption. As grey running text under the
                  title this read as an explainer about the page and got
                  skipped; boxed like every other known value on the
                  platform it reads as a fact about your account. */}
              {/* The same card the checkout uses for a saved mandate, so
                  the two pages rhyme — but a div, not a button. Here it
                  is the thing being replaced, and there is nothing to
                  choose about it.

                  Red when it is also the thing that failed. Accent
                  marks a recommendation, and a mandate that just
                  bounced is the opposite of one. */}
              {currentLabel && (
                <div
                  className={`status-modal-option checkout-method-saved${collectionFailed ? " checkout-method-saved--failed" : ""}`}
                  style={{ cursor: "default", marginBottom: 6 }}
                >
                  {collectionFailed
                    ? <AlertTriangle size={18} strokeWidth={1.5} className="checkout-method-icon" />
                    : <Wallet size={18} strokeWidth={1.5} className="checkout-method-icon" />}
                  <div className="status-modal-option-text">
                    <span className="status-modal-option-label">
                      {t(collectionFailed ? "current_failed" : "current")}
                    </span>
                    <span className="status-modal-option-desc">
                      {t(collectionFailed ? "current_failed_desc" : "current_desc", { method: currentLabel })}
                    </span>
                  </div>
                </div>
              )}

              <section className="checkout-section" style={{ marginTop: 28 }}>
              <h2 className="checkout-legend">{t("pay_with")}</h2>
              {collectionFailed && (
                <p className="form-note" style={{ margin: "0 0 14px" }}>
                  {t("repair_note")}
                </p>
              )}

              <div className="checkout-methods">
                {([
                  { key: "ideal", label: t("method_ideal"), desc: t("method_ideal_desc"), Icon: Landmark },
                  { key: "sepa", label: t("method_sepa"), desc: t("method_sepa_desc"), Icon: Repeat },
                  { key: "card", label: t("method_card"), desc: t("method_card_desc"), Icon: CreditCard },
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

              {method === "sepa" && (
                <>
                  <label className="form-label">{t("label_iban")}</label>
                  <div id="el-iban" className={elCls("iban")} style={errOf("iban") ? { marginBottom: 0 } : undefined} />
                  {note(errOf("iban"))}
                </>
              )}

              {method === "card" && (
                <>
                  <label className="form-label">{t("label_card_number")}</label>
                  <div id="el-card-number" className={elCls("cardNumber")} style={errOf("cardNumber") ? { marginBottom: 0 } : undefined} />
                  {note(errOf("cardNumber"))}

                  <div className="form-row">
                    <div>
                      <label className="form-label">{t("label_card_expiry")}</label>
                      <div id="el-card-expiry" className={elCls("cardExpiry")} style={errOf("cardExpiry") ? { marginBottom: 0 } : undefined} />
                      {note(errOf("cardExpiry"))}
                    </div>
                    <div>
                      <label className="form-label">{t("label_card_cvc")}</label>
                      <div id="el-card-cvc" className={elCls("cardCvc")} style={errOf("cardCvc") ? { marginBottom: 0 } : undefined} />
                      {note(errOf("cardCvc"))}
                    </div>
                  </div>
                </>
              )}

              <label className="form-label" htmlFor="holder">{t("label_holder")}</label>
              <input
                id="holder"
                className={inputCls("name")}
                placeholder={t("holder_placeholder")}
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
                  checkout.confirm({ name, email: defaultEmail })
                }}
              >
                {busy ? t("working") : t(collectionFailed ? "submit_repair" : "submit_change")}
              </button>

              {checkout.phase === "error" && checkout.message && (
                <p className="form-note form-note--error" style={{ marginTop: 10 }}>
                  {t(`err_${checkout.message}` as never)}
                </p>
              )}

              <p className="checkout-secure" style={{ marginTop: 20 }}>
                <Lock size={12} strokeWidth={1.5} />
                {t("secure")}
              </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
