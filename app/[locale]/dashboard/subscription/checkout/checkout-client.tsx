"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { AlertCircle, Check, CreditCard, Landmark, Lock, Repeat, Wallet, X } from "lucide-react"

import { AddressLookup } from "@/components/address-lookup"
import { FormSelect } from "@/components/form-select"
import { HeaderLanguageSwitcher } from "@/components/header-language-switcher"
import { Link, useRouter } from "@/i18n/navigation"

import { PUBLISHABLE_KEY } from "@/lib/stripe/load-stripe"

import { isValidVatNumber } from "@/lib/subscriptions/vat-number"

import { FREE_MONTHS, IDEAL_BANKS } from "./constants"
import { useElementsCheckout } from "./use-elements-checkout"

/**
 * Design study: the subscribe page as it would look built on Stripe
 * Elements rather than Checkout.
 *
 * Nothing here talks to Stripe — it is a worked-out drawing, meant to
 * be argued with before anyone commits to the integration behind it.
 * Copy is hardcoded Dutch for the same reason: translating a sketch
 * fixes it in place before it has earned that.
 *
 * Three decisions the drawing makes, all of them arguable:
 *
 *  1. The billing cycle lives in the summary, beside the price it
 *     changes — not in the form, where it would read as a payment
 *     setting rather than as part of what is being bought.
 *  2. iDEAL | Wero leads, and is what the page opens on. The double
 *     name is not ours: Wero acquired iDEAL, and Stripe required
 *     integrations to carry the combined brand from Q1 2026, with a
 *     full move to Wero over 2026–2027. It looks like the
 *     expensive choice next to a direct debit and is not: for a
 *     subscription, iDEAL sets up a SEPA mandate, so it costs one
 *     iDEAL fee at signup and then every renewal is a €0,35 direct
 *     debit anyway. What it buys for that is recognition — picking
 *     your bank instead of typing an IBAN from memory.
 *  3. "Ik koop zakelijk" starts checked, because every buyer of Pro is
 *     a company. It stays a checkbox rather than an assumption so a
 *     sole trader without a VAT number can still get through.
 */

type Method = "saved" | "sepa" | "ideal" | "card"

/* Prices are data; the words around them are translated at render.
   The three prose fields used to live here as Dutch literals, which is
   what kept this screen monolingual while the rest of the dashboard
   switched languages. */
const CYCLES = {
  month: { net: 4900 },
  year: { net: 46800 },
} as const

const FEATURES = [
  "feature_page",
  "feature_credits",
  "feature_publish",
  "feature_team",
  "feature_analytics",
] as const

/* Two that work and everything else that doesn't, so the drawing shows
   both the applied row and the error. FOUNDING is the one the launch
   plan actually needs: a full year of Pro at no charge, reached through
   the same checkout as a paying signup rather than a second, untested
   path. */
const CODES: Record<string, { labelKey: string; percent: number; periodsKey: string }> = {
  FOUNDING: { labelKey: "promo_founding", percent: 100, periodsKey: "promo_founding_periods" },
  START20: { labelKey: "promo_intro", percent: 20, periodsKey: "promo_intro_periods" },
}

/* Already on the company page, resolved through Places when it was
   entered there. Asking for it again is asking someone to retype what
   we are about to print on their invoice. */

/* A starting point, not an answer. companies.name is the marketplace
   name — kap.studio, PHNX Group, Green Eye Design — and none of those
   is how the company is entered in the KvK register. An invoice needs
   the registered name, so this is prefilled and then editable. */
const COMPANY_NAME = "Arco Testbedrijf"

/* Our own failure codes, in words. Anything not listed is Stripe's own
   message and is shown verbatim — they name a declined card or an
   expired one far better than we could. This replaces a guess based on
   string length, which quietly turned every short code of ours into
   "Dat lukte niet". */
const OUR_CODES = [
  "not_configured",
  "not_signed_in",
  "no_company",
  "not_owner",
  "not_ready",
  "already_subscribed",
  "failed",
  "payment_declined",
]

const euro = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100)

export function CheckoutClient({
  interval,
  returnTo,
  freeUntil,
  resumeSetupIntent = null,
  defaultEmail,
  savedMethod,
  savedMethodFailed = false,
  companyAddress,
}: {
  interval: "month" | "year"
  /** Where the cross goes: the page the reader came from. */
  returnTo: string
  /** The day a free year would run to, formatted on the server. */
  freeUntil: string
  /** Present only on the way back from an iDEAL redirect. */
  resumeSetupIntent?: string | null
  /** The signed-in account's address — where the mandate lands. */
  defaultEmail: string
  /** A mandate this company already gave us, if any. Cancelling a
   *  subscription does not revoke one, so a returning customer is
   *  still authorised and should not be asked twice. */
  savedMethod: string | null
  /** The last subscription ended because this mandate stopped
   *  collecting. Still offered, because the account may simply have
   *  been short for a day and only its owner knows — but marked, and
   *  never the default. */
  savedMethodFailed?: boolean
  /** The address on the company's own page. A fixture used to stand in
   *  for it, so the checkout stated an address the buyer had never
   *  given — on the document they would later have to file. */
  companyAddress: { streetAddress: string; postalCode?: string | null; city: string; country?: string } | null
}) {
  // Opens on whatever the reader picked on the plan cards, so the price
  // they were looking at is the price they arrive at.
  const t = useTranslations("checkout")
  const router = useRouter()
  const [cycle, setCycle] = useState<"month" | "year">(interval)
  // A known mandate leads: for anyone who has one, the rest of this
  // form is optional.
  const [method, setMethod] = useState<Method>(savedMethod && !savedMethodFailed ? "saved" : "ideal")
  const usingSaved = method === "saved"
  const [business, setBusiness] = useState(true)
  const [vatNumber, setVatNumber] = useState("")
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoInput, setPromoInput] = useState("")
  const [promo, setPromo] = useState<{ code: string; labelKey: string; percent: number; periodsKey: string } | null>(null)
  const [promoError, setPromoError] = useState(false)
  // Billing details Stripe requires with every mandate.
  const [name, setName] = useState("")
  const [email, setEmail] = useState(defaultEmail)
  const [bank, setBank] = useState("")
  const [companyName, setCompanyName] = useState(COMPANY_NAME)
  // The address is known, so it is stated rather than asked. The field
  // only appears for the rare reader who wants it somewhere else —
  // a shared finance inbox, most likely.
  const [editingEmail, setEditingEmail] = useState(false)
  // One message per field, shown at the field. Stripe will not accept a
  // mandate without a name and an email either — catching it here means
  // the reader is told by the form rather than by a payment processor.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({})

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
    // A saved mandate asks nothing, so there is nothing to refuse over.
    if (usingSaved) {
      setFieldErrors({})
      return true
    }
    const next: Record<string, string | null> = {
      name: name.trim() ? null : t("err_name"),
      email: !email.trim()
        ? t("err_email")
        : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
          ? null
          : t("err_email_invalid"),
      bank: method === "ideal" && !bank ? t("err_bank") : null,
      // Not Stripe's requirement but the tax office's: a Dutch invoice
      // must carry the buyer's name and address. Without one we cannot
      // issue a valid one.
      address: address ? null : t("err_address"),
      // Same reason as the address: a Dutch invoice must carry the
      // buyer's name, and only they know the registered one.
      companyName: business && !companyName.trim() ? t("err_company") : null,
      // Optional, so an empty field is fine — but a filled one has to
      // be right. Stripe refuses a malformed number when the tax ID is
      // written, and that write is best-effort on purpose, so without
      // this the number simply never reaches the invoice and nobody is
      // told.
      vatNumber: business && vatNumber.trim() && !isValidVatNumber(vatNumber) ? t("err_vat") : null,
      // Stripe's own errors cover wrong; these cover empty. Without
      // them an untouched IBAN produced a refusal from the payment
      // processor instead of a sentence under the field.
      ...(method === "sepa" && !checkout.complete.iban
        ? { iban: t("err_iban") }
        : { iban: null }),
      // A card is one thing to a reader, not three. While none of the
      // parts is finished — the ordinary case of pressing the button on
      // an empty form — it gets one sentence under the number. Only
      // once something is filled does it become worth naming which
      // piece is still missing.
      ...(method === "card" ? cardErrors() : { cardNumber: null, cardExpiry: null, cardCvc: null }),
    }
    setFieldErrors(next)
    return !Object.values(next).some(Boolean)
  }

  const checkout = useElementsCheckout({
    // The hook only speaks the three Stripe methods; "saved" collects
    // nothing, so it is disabled rather than translated.
    method: usingSaved ? "ideal" : method,
    enabled: !usingSaved,
    interval: cycle,
    returnPath: returnTo,
    resumeSetupIntent,
  })
  // Fixed until reverse charge exists. The selector offered Belgium
  // and Germany while the checkout charged 21% Dutch VAT to everyone,
  // which is the wrong tax on a cross-border B2B invoice — a buyer
  // with a valid EU VAT number is entitled to have it shifted to them.
  // Offering the country was the promise; the tax was the product.
  const country = "NL"
  const [address, setAddress] = useState<
    { streetAddress: string; city: string; postalCode?: string | null } | null
  >(companyAddress)

  // A code that covers the whole period leaves nothing to pay, and a
  // page with nothing to pay has no business asking how. Everything
  // below follows from this one flag.
  const freeActivation = promo?.percent === 100

  // Six months has no list price of its own — the only way to buy it
  // is monthly — so that is what the give-away is measured against.
  // Valuing it at the yearly rate would be quoting a price nobody
  // could have paid.
  const plan = freeActivation
    ? {
        net: FREE_MONTHS * CYCLES.month.net,
        label: t("free_months_plan", { months: FREE_MONTHS }),
        renews: "",
        per: "",
      }
    : {
        net: CYCLES[cycle].net,
        label: t(cycle === "month" ? "cycle_month" : "cycle_year"),
        renews: t(cycle === "month" ? "renews_month" : "renews_year"),
        per: t(cycle === "month" ? "per_month" : "per_year"),
      }

  // What the line under the label says, when it says anything.
  const perMonth = freeActivation ? CYCLES.month.net : cycle === "year" ? 3900 : null
  const discount = promo ? Math.round((plan.net * promo.percent) / 100) : 0
  const net = plan.net - discount
  // 21% on what is actually charged, not on the list price: a Dutch
  // company buying from a Dutch company. A drawing that quietly showed
  // 0% would be promising a reverse charge we have not built.
  const vat = Math.round(net * 0.21)
  const total = net + vat
  const freeToday = total === 0
  const fullPrice = plan.net + Math.round(plan.net * 0.21)

  const promoLabel = (key: string) =>
    key === "promo_founding" ? t("promo_founding") : t("promo_intro")
  const promoPeriod = (key: string) =>
    key === "promo_founding_periods"
      ? t("promo_founding_periods", { months: FREE_MONTHS })
      : t("promo_intro_periods")

  const applyPromo = () => {
    const found = CODES[promoInput.trim().toUpperCase()]
    if (!found) {
      setPromoError(true)
      return
    }
    setPromo({ code: promoInput.trim().toUpperCase(), ...found })
    setPromoOpen(false)
    setPromoInput("")
    setPromoError(false)
  }

  const errOf = (key: string) => checkout.elementErrors[key] ?? fieldErrors[key] ?? null
  const inputCls = (key: string) => `form-input${errOf(key) ? " form-input--error" : ""}`
  const elCls = (key: string) => `checkout-element${errOf(key) ? " checkout-element--error" : ""}`
  const note = (msg: string | null | undefined) =>
    msg ? <p className="form-note form-note--error">{msg}</p> : null

  // Carried in the URL rather than in state: an iDEAL payment comes
  // back through a bank and a fresh page load, so there is no state
  // left to carry it in.
  useEffect(() => {
    if (checkout.phase !== "done") return
    const sep = returnTo.includes("?") ? "&" : "?"
    router.replace(`${returnTo}${sep}subscribed=${checkout.status === "active" ? "active" : "processing"}`)
  }, [checkout.phase, checkout.status, returnTo, router])

  const busy = checkout.phase === "confirming" || checkout.phase === "mounting" || checkout.phase === "done"

  const submitBlock = (
    <>
      <button
        type="button"
        className="btn-primary"
        style={{ width: "100%", padding: "12px 20px", fontSize: 15, fontWeight: 500, opacity: busy ? 0.6 : 1 }}
        // Only while something is actually happening. Disabling it on
        // an error left the reader with a dead button and no way back.
        disabled={busy}
        onClick={() => {
          if (freeActivation) return
          if (!validate()) return
          if (usingSaved) {
            checkout.confirmSaved(cycle)
            return
          }
          checkout.confirm({
            name,
            email,
            bank,
            billing: {
              companyName: business ? companyName : null,
              vatNumber: business ? vatNumber : null,
              address: address
                ? { line1: address.streetAddress, city: address.city, postalCode: address.postalCode, country }
                : null,
            },
          })
        }}
      >
        {busy ? t("working") : t(freeActivation ? "submit_activate" : "submit_subscribe")}
      </button>

      {/* Directly under the button, before any fine print. Only what no
          field could own ends up here — a declined card, a network that
          gave out. Everything the form can check itself is checked at
          the field it belongs to. */}
      {checkout.phase === "error" && checkout.message && (
        <p className="form-note form-note--error" style={{ margin: "10px 0 0" }}>
          {OUR_CODES.includes(checkout.message) ? t(`err_${checkout.message}` as never) : checkout.message}
        </p>
      )}

      {!freeActivation && (
        <p className="checkout-secure" style={{ marginTop: 12 }}>
          <Lock size={12} strokeWidth={1.5} />
          {t("secure")}
        </p>
      )}

      <p className="checkout-legal">
        {/* A €0 total is the one case where "wordt verlengd" is not
            enough: the reader has to be told, before they agree, that
            a charge starts later and how big it is. A real page would
            name the date; this one is a drawing, so it counts. */}
        {freeActivation
          ? t("legal_free")
          : freeToday
            ? t("legal_trial", {
                period: promo ? promoPeriod(promo.periodsKey) : t("trial_period"),
                amount: euro(fullPrice),
                per: plan.per,
              })
            : t("legal_renews", { renews: plan.renews, amount: euro(fullPrice), per: plan.per })}{" "}
        {t("legal_agree", { action: t(freeActivation ? "submit_activate" : "submit_subscribe") })}{" "}
        <a href="#">{t("legal_terms")}</a> {t("legal_and")} <a href="#">{t("legal_privacy")}</a>.
      </p>
    </>
  )

  return (
    <div className="checkout-page">
      {/* Read off the key the page is actually using, not asserted: a
          form this convincing must say out loud when it takes no money,
          and must not claim so when it does. Live mode has nothing to
          warn about, so the strip is simply absent. */}
      {PUBLISHABLE_KEY?.startsWith("pk_test") && (
        <div className="checkout-strip">
          <div className="checkout-wrap checkout-strip-inner">
            <span>{t("test_mode")}</span>
          </div>
        </div>
      )}

      {/* The /claim funnel's chrome: wordmark, language, and the way
          out. No site nav — this is a step, not a place you browsed
          to, and every extra link is a way to abandon a payment. */}
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
        {/* "Arco Pro" is the card's job — it is the thing being bought,
            with its features and its price. Repeating it here left the
            page saying the product's name twice and the reader's task
            not at all. Spaced by .discover-page-title, the same wrapper
            every dashboard page uses, so a title is a title wherever
            you meet one. */}
        <div className="discover-page-title">
          <h1 className="arco-section-title">
            {t(freeActivation ? "title_activate" : "title_checkout")}
          </h1>
        </div>

        {/* No screen for "done". The confirmation lives on the
            subscription page and the reader is already on their way
            there; an effect navigates after paint, so any state drawn
            here would flash past on the way out. The form simply stays
            busy until the page changes. */}
        <div className={`checkout-grid${freeActivation ? " checkout-grid--single" : ""}`} style={{ paddingBottom: 96 }}>
          {/* ── Left: what the reader hands over. Absent entirely on a
                 free activation — there is nothing to hand over, and a
                 column kept open for one sentence is just a hole. ─── */}
          {!freeActivation && (
          <div>
            <section className="checkout-section">
              <h2 className="checkout-legend">{t("pay_with")}</h2>


              {/* Full width and above the row: not one of four options
                  but the shortcut past all of them. */}
              {savedMethod && (
                <button
                  type="button"
                  onClick={() => setMethod("saved")}
                  className={`status-modal-option checkout-method-saved${usingSaved ? " selected" : ""}${
                    savedMethodFailed ? " checkout-method-saved--failed" : ""
                  }`}
                >
                  {savedMethodFailed
                    ? <AlertCircle size={18} strokeWidth={1.5} className="checkout-method-icon" />
                    : <Wallet size={18} strokeWidth={1.5} className="checkout-method-icon" />}
                  <div className="status-modal-option-text">
                    <span className="status-modal-option-label">
                      {t(savedMethodFailed ? "saved_method_failed" : "saved_method")}
                    </span>
                    <span className="status-modal-option-desc">
                      {t(savedMethodFailed ? "saved_method_failed_desc" : "saved_method_desc", { method: savedMethod })}
                    </span>
                  </div>
                </button>
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
                  {/* Stripe mounts an iframe into this box. We own the
                      border, the radius and the padding; the text
                      inside is dressed through the element's style. */}
                  <div id="el-iban" className={elCls("iban")} style={errOf("iban") ? { marginBottom: 0 } : undefined} />
                  {note(errOf("iban"))}


                  <p className="checkout-mandate">
                    {t("mandate")}
                  </p>
                </>
              )}

              {method === "ideal" && (
                <>
                  {/* Ours, not Stripe's: the bank travels to them as a
                      plain value, so the control can be an ordinary
                      Arco field with our own chevron and our own type. */}
                  <label className="form-label" htmlFor="bank">{t("label_bank")}</label>
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
                    <option value="" disabled>{t("bank_placeholder")}</option>
                    {IDEAL_BANKS.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </FormSelect>
                  {note(fieldErrors.bank)}

                  <p className="checkout-mandate">
                    Je betaalt de eerste termijn bij je eigen bank. Daarmee machtig je ons meteen voor de
                    volgende termijnen via automatische incasso, zodat je dit niet elke keer opnieuw hoeft te
                    doen.
                  </p>
                </>
              )}

              {method === "card" && (
                <>
                  <label className="form-label">{t("label_card_number")}</label>
                  {/* Stripe draws the accepted brands inside this one. */}
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

              {usingSaved && (
                // Chosen deliberately now that it is not the default,
                // so the note says what that choice means rather than
                // reassuring them about a mandate that just failed.
                <p className="form-note" style={{ margin: "0 0 4px" }}>
                  {t(savedMethodFailed ? "saved_note_failed" : "saved_note")}
                </p>
              )}

              {/* Ours, always — except when there is no mandate being
                  given: Stripe has no element for a name, and every
                  mandate needs one attached to it. */}
              {!usingSaved && (
              <>
              <label className="form-label" htmlFor="holder">{t("label_holder")}</label>
              <input
                id="holder"
                className={inputCls("name")}
                placeholder={t("holder_placeholder")}
                value={name}
                style={fieldErrors.name ? { marginBottom: 0 } : undefined}
                onChange={(e) => {
                  setName(e.target.value)
                  setFieldErrors((prev) => ({ ...prev, name: null }))
                }}
              />
              {note(fieldErrors.name)}

              {editingEmail ? (
                <>
                  <label className="form-label" htmlFor="email">{t("label_email")}</label>
                  <input
                    id="email"
                    type="email"
                    className={inputCls("email")}
                    placeholder={t("email_placeholder")}
                    value={email}
                    autoFocus
                    style={{ marginBottom: 0 }}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setFieldErrors((prev) => ({ ...prev, email: null }))
                    }}
                  />
                  {note(fieldErrors.email)}
                  {!fieldErrors.email && (
                    <p className="form-note">{t("email_note")}</p>
                  )}
                </>
              ) : (
                <p className="form-note" style={{ margin: "0 0 4px" }}>
                  Je factuur en de bevestiging van je machtiging gaan naar <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{email}</strong>.{" "}
                  <button type="button" className="arco-text-link arco-text-link--inline" onClick={() => setEditingEmail(true)}>
                    Ander adres
                  </button>
                </p>
              )}
              </>
              )}

            </section>

            <section className="checkout-section">
              <h2 className="checkout-legend">{t("billing_address")}</h2>

              {/* Land is a question about the address, so it only shows
                  while the address is being answered. Once one is
                  picked it says the country itself, and a field that
                  repeats what is already on screen is just another
                  thing to read. It comes back with Wijzigen — and it
                  earns its place there by narrowing the search to one
                  country, the difference between five Kerkstraten and
                  fifty. */}
              {address ? (
                <>
                  <label className="form-label">{t("label_address")}</label>
                  <div className="checkout-address">
                    <div style={{ minWidth: 0 }}>
                      <span className="checkout-address-line">{address.streetAddress}</span>
                      <span className="checkout-address-sub">{address.city}</span>
                    </div>
                    <button type="button" className="arco-text-link" onClick={() => setAddress(null)}>
                      {t("change")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="form-label">{t("label_address")}</label>
                  <AddressLookup
                    placeholder={t("address_placeholder")}
                    country={country}
                    inputClassName="form-input"
                    onResolved={(r) => {
                      // The resolver does carry one — it reads the
                      // postal_code component straight off the place.
                      // This used to dig it out of the formatted line
                      // with a regex shaped like a Dutch postcode,
                      // which found nothing anywhere else and could
                      // match the wrong run of characters at home.
                      setAddress({ streetAddress: r.streetAddress, city: r.city ?? "", postalCode: r.postalCode })
                      setFieldErrors((prev) => ({ ...prev, address: null }))
                    }}
                  />
                  {note(fieldErrors.address)}
                </>
              )}

              <label className="checkout-check">
                <input type="checkbox" checked={business} onChange={(e) => setBusiness(e.target.checked)} />
                {t("business_checkbox")}
              </label>

              {business && (
                <div style={{ marginTop: 20 }}>
                  {/* Prefilled from the company page and editable from
                      there: the name on Arco is a brand, the name on an
                      invoice is a registration, and on this platform
                      they rarely match. */}
                  <label className="form-label" htmlFor="company">{t("label_company")}</label>
                  <input
                    id="company"
                    className={inputCls("companyName")}
                    value={companyName}
                    style={{ marginBottom: 0 }}
                    onChange={(e) => {
                      setCompanyName(e.target.value)
                      setFieldErrors((prev) => ({ ...prev, companyName: null }))
                    }}
                  />
                  {note(errOf("companyName"))}
                  {!errOf("companyName") && (
                    <p className="form-note">{t("company_note")}</p>
                  )}

                  <label className="form-label" htmlFor="vat">
                    {t("label_vat")} <span style={{ color: "var(--arco-mid-grey)", fontWeight: 400 }}>{t("optional")}</span>
                  </label>
                  <input
                    id="vat"
                    className={inputCls("vatNumber")}
                    placeholder={t("vat_placeholder")}
                    value={vatNumber}
                    style={{ marginBottom: 0 }}
                    onChange={(e) => {
                      setVatNumber(e.target.value)
                      setFieldErrors((prev) => ({ ...prev, vatNumber: null }))
                    }}
                  />
                  {note(errOf("vatNumber"))}
                </div>
              )}
            </section>
          </div>
          )}

          {/* ── Right: what the reader gets ──────────────────────── */}
          <aside className="checkout-summary">
            <h2 className="arco-subsection-title" style={{ marginBottom: 16 }}>Arco Pro</h2>

            {/* The cycle sits here rather than in the form: it changes
                the price two lines below it, and that is the only
                thing it changes. */}
            {freeActivation ? (
              <p className="form-note" style={{ margin: "0 0 20px" }}>
                {t("free_activation_note", { until: freeUntil })}
              </p>
            ) : (
            <div className="audience-toggle" style={{ marginBottom: 20, display: "flex" }}>
              <button
                type="button"
                onClick={() => setCycle("month")}
                className={`toggle-seg${cycle === "month" ? " active" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Maandelijks
              </button>
              <button
                type="button"
                onClick={() => setCycle("year")}
                className={`toggle-seg${cycle === "year" ? " active" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Jaarlijks
                <span style={{ marginLeft: 5, fontSize: 11, color: "var(--primary)", fontWeight: 500 }}>−20%</span>
              </button>
            </div>
            )}

            <div style={{ marginBottom: 20 }}>
              {FEATURES.map((f) => (
                <div key={f} className="pricing-feature">
                  <Check size={15} strokeWidth={1.75} style={{ color: "var(--primary)", flexShrink: 0 }} />
                  {t(f)}
                </div>
              ))}
            </div>

            <div className="checkout-price-row">
              <span>
                {plan.label}
                {perMonth !== null && (
                  <span style={{ display: "block", fontSize: 12, color: "var(--arco-mid-grey)" }}>
                    {euro(perMonth)} per maand
                  </span>
                )}
              </span>
              <span>{euro(plan.net)}</span>
            </div>

            {promo && (
              <div className="checkout-price-row checkout-price-row--discount">
                <span>
                  {promoLabel(promo.labelKey)} ({promo.percent}%)
                  <button
                    type="button"
                    className="checkout-promo-remove"
                    onClick={() => setPromo(null)}
                    aria-label={t("promo_remove", { code: promo.code })}
                  >
                    <X size={13} strokeWidth={1.75} />
                  </button>
                  <span style={{ display: "block", fontSize: 12, color: "var(--arco-mid-grey)" }}>
                    {promo.code} · {promoPeriod(promo.periodsKey)}
                  </span>
                </span>
                <span>−{euro(discount)}</span>
              </div>
            )}

            {/* No underline: it stands alone on its own line, so the row
                does the bounding that running text cannot. With one it
                read heavier than "Wijzigen" at the same 14px, which is
                the whole reason to keep this link quiet. */}
            {!promo && !promoOpen && (
              <button type="button" className="arco-text-link" style={{ padding: "6px 0" }} onClick={() => setPromoOpen(true)}>
                {t("promo_add")}
              </button>
            )}

            {!promo && promoOpen && (
              <>
                <div className="checkout-promo-form">
                  <input
                    className={`form-input${promoError ? " form-input--error" : ""}`}
                    placeholder={t("promo_placeholder")}
                    value={promoInput}
                    autoFocus
                    onChange={(e) => { setPromoInput(e.target.value); setPromoError(false) }}
                    onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                  />
                  <button
                    type="button"
                    className="btn-tertiary"
                    style={{ flexShrink: 0, fontSize: 13, padding: "8px 16px" }}
                    onClick={applyPromo}
                  >
                    {t("promo_apply")}
                  </button>
                </div>
                {promoError && (
                  <p className="form-note form-note--error" style={{ marginBottom: 6 }}>
                    {t("promo_unknown")}
                  </p>
                )}
              </>
            )}

            <div className="checkout-price-row">
              <span>{t("vat_line")}</span>
              <span>{euro(vat)}</span>
            </div>

            <div className="checkout-price-row checkout-price-row--total">
              <span>{t("due_today")}</span>
              <span>{euro(total)}</span>
            </div>

            {/* A comparison between two list prices — with a discount
                applied it would be weighing the wrong two numbers. */}
            {cycle === "year" && !promo && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--primary)" }}>
                {t("yearly_saving", { amount: euro(12 * 4900 - 46800) })}
              </p>
            )}

            <div style={{ marginTop: 20 }}>{submitBlock}</div>
          </aside>
        </div>
      </div>
    </div>
  )
}
