"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Check, CreditCard, Landmark, Lock, Repeat, Wallet, X } from "lucide-react"

import { AddressLookup } from "@/components/address-lookup"
import { FormSelect } from "@/components/form-select"
import { HeaderLanguageSwitcher } from "@/components/header-language-switcher"
import { Link, useRouter } from "@/i18n/navigation"

import { PUBLISHABLE_KEY } from "@/lib/stripe/load-stripe"

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

const CYCLES = {
  month: { net: 4900, label: "Maandabonnement", renews: "maandelijks", per: "per maand" },
  year: { net: 46800, label: "Jaarabonnement", renews: "jaarlijks", per: "per jaar" },
} as const

const FEATURES = [
  "Vermelde bedrijfspagina met al je projecten",
  "Onbeperkt vermeldingen zichtbaar op je pagina",
  "Onbeperkt projecten publiceren",
  "Teambeheer",
  "Paginastatistieken",
]

/* Two that work and everything else that doesn't, so the drawing shows
   both the applied row and the error. FOUNDING is the one the launch
   plan actually needs: a full year of Pro at no charge, reached through
   the same checkout as a paying signup rather than a second, untested
   path. */
const CODES: Record<string, { label: string; percent: number; periods: string }> = {
  FOUNDING: { label: "Founding member", percent: 100, periods: `eerste ${FREE_MONTHS} maanden` },
  START20: { label: "Introductiekorting", percent: 20, periods: "eerste termijn" },
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
const MESSAGES: Record<string, string> = {
  not_configured: "Stripe is nog niet gekoppeld.",
  not_signed_in: "Je bent niet ingelogd.",
  no_company: "Je hebt nog geen bedrijf op Arco.",
  not_owner: "Alleen de eigenaar van het bedrijf kan het abonnement regelen.",
  not_ready: "De machtiging is nog niet rond. Probeer het zo nog eens.",
  already_subscribed: "Dit bedrijf heeft al een actief abonnement.",
  failed: "Dat lukte niet. Probeer het zo nog eens.",
}

const euro = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100)

export function CheckoutClient({
  interval,
  returnTo,
  freeUntil,
  resumeSetupIntent = null,
  defaultEmail,
  savedMethod,
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
  /** The address on the company's own page. A fixture used to stand in
   *  for it, so the checkout stated an address the buyer had never
   *  given — on the document they would later have to file. */
  companyAddress: { streetAddress: string; city: string; country?: string } | null
}) {
  // Opens on whatever the reader picked on the plan cards, so the price
  // they were looking at is the price they arrive at.
  const router = useRouter()
  const [cycle, setCycle] = useState<"month" | "year">(interval)
  // A known mandate leads: for anyone who has one, the rest of this
  // form is optional.
  const [method, setMethod] = useState<Method>(savedMethod ? "saved" : "ideal")
  const usingSaved = method === "saved"
  const [business, setBusiness] = useState(true)
  const [vatNumber, setVatNumber] = useState("")
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoInput, setPromoInput] = useState("")
  const [promo, setPromo] = useState<{ code: string; label: string; percent: number; periods: string } | null>(null)
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
      return { cardNumber: "Vul je kaartgegevens in.", cardExpiry: null, cardCvc: null }
    }
    return {
      cardNumber: done.cardNumber ? null : "Vul je kaartnummer in.",
      cardExpiry: done.cardExpiry ? null : "Vul de vervaldatum in.",
      cardCvc: done.cardCvc ? null : "Vul de CVC in.",
    }
  }

  const validate = () => {
    // A saved mandate asks nothing, so there is nothing to refuse over.
    if (usingSaved) {
      setFieldErrors({})
      return true
    }
    const next: Record<string, string | null> = {
      name: name.trim() ? null : "Vul de naam in zoals die op de rekening staat.",
      email: !email.trim()
        ? "Vul je e-mailadres in — daar sturen we de factuur naartoe."
        : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
          ? null
          : "Dit adres lijkt niet te kloppen.",
      bank: method === "ideal" && !bank ? "Kies je bank." : null,
      // Not Stripe's requirement but the tax office's: a Dutch invoice
      // must carry the buyer's name and address. Without one we cannot
      // issue a valid one.
      address: address ? null : "Kies je adres — het hoort op de factuur.",
      // Same reason as the address: a Dutch invoice must carry the
      // buyer's name, and only they know the registered one.
      companyName: business && !companyName.trim() ? "Vul de naam in zoals je bedrijf is ingeschreven." : null,
      // Stripe's own errors cover wrong; these cover empty. Without
      // them an untouched IBAN produced a refusal from the payment
      // processor instead of a sentence under the field.
      ...(method === "sepa" && !checkout.complete.iban
        ? { iban: "Vul je IBAN in." }
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
  const [country, setCountry] = useState(companyAddress?.country ?? "NL")
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
    ? { net: FREE_MONTHS * CYCLES.month.net, label: `${FREE_MONTHS} maanden Pro`, renews: "", per: "" }
    : CYCLES[cycle]

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

  const busy = checkout.phase === "confirming" || checkout.phase === "mounting"

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
        {busy ? "Bezig…" : freeActivation ? "Pro activeren" : "Abonneren"}
      </button>

      {/* Directly under the button, before any fine print. Only what no
          field could own ends up here — a declined card, a network that
          gave out. Everything the form can check itself is checked at
          the field it belongs to. */}
      {checkout.phase === "error" && checkout.message && (
        <p className="form-note form-note--error" style={{ margin: "10px 0 0" }}>
          {MESSAGES[checkout.message] ?? checkout.message}
        </p>
      )}

      {!freeActivation && (
        <p className="checkout-secure" style={{ marginTop: 12 }}>
          <Lock size={12} strokeWidth={1.5} />
          Je betaalgegevens gaan rechtstreeks naar Stripe, onze betaaldienstverlener. Arco slaat ze niet op.
        </p>
      )}

      <p className="checkout-legal">
        {/* A €0 total is the one case where "wordt verlengd" is not
            enough: the reader has to be told, before they agree, that
            a charge starts later and how big it is. A real page would
            name the date; this one is a drawing, so it counts. */}
        {freeActivation
          ? "Je geeft geen betaalgegevens op, dus er wordt nooit iets afgeschreven."
          : freeToday
            ? `Je betaalt vandaag niets. Na de ${promo?.periods ?? "proefperiode"} wordt ${euro(fullPrice)} ${plan.per} (incl. btw) afgeschreven, tot je opzegt.`
            : `Wordt ${plan.renews} verlengd tot je opzegt. Er wordt dan ${euro(fullPrice)} ${plan.per} (incl. btw) afgeschreven.`}{" "}
        Door op {freeActivation ? "Pro activeren" : "Abonneren"} te klikken ga je akkoord met onze{" "}
        <a href="#">algemene voorwaarden</a> en <a href="#">privacyverklaring</a>.
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
            <span>Testmodus — er gaat geen echt geld doorheen.</span>
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
            <Link href={returnTo} className="checkout-close" aria-label="Sluiten">
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
            {checkout.phase === "done" ? "Gelukt" : freeActivation ? "Pro activeren" : "Afrekenen"}
          </h1>
        </div>

        {/* Done: the form has nothing left to ask, so the reader should
            not be left looking at it. They go to the page the news is
            about — their subscription — and the confirmation meets them
            there. This branch is what shows while that navigation
            happens; a blank page after a payment reads as a failure. */}
        {checkout.phase === "done" ? (
          <div className="checkout-grid checkout-grid--single" style={{ paddingBottom: 96 }}>
            <aside className="checkout-summary">
              <p className="form-note" style={{ margin: 0 }}>Je abonnement wordt geladen…</p>
            </aside>
          </div>
        ) : (
        <div className={`checkout-grid${freeActivation ? " checkout-grid--single" : ""}`} style={{ paddingBottom: 96 }}>
          {/* ── Left: what the reader hands over. Absent entirely on a
                 free activation — there is nothing to hand over, and a
                 column kept open for one sentence is just a hole. ─── */}
          {!freeActivation && (
          <div>
            <section className="checkout-section">
              <h2 className="checkout-legend">Betalen met</h2>


              {/* Full width and above the row: not one of four options
                  but the shortcut past all of them. */}
              {savedMethod && (
                <button
                  type="button"
                  onClick={() => setMethod("saved")}
                  className={`status-modal-option checkout-method-saved${usingSaved ? " selected" : ""}`}
                >
                  <Wallet size={18} strokeWidth={1.5} className="checkout-method-icon" />
                  <div className="status-modal-option-text">
                    <span className="status-modal-option-label">Opgeslagen betaalmethode</span>
                    <span className="status-modal-option-desc">{savedMethod} — niets in te vullen</span>
                  </div>
                </button>
              )}

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

              {method === "sepa" && (
                <>
                  <label className="form-label">IBAN</label>
                  {/* Stripe mounts an iframe into this box. We own the
                      border, the radius and the padding; the text
                      inside is dressed through the element's style. */}
                  <div id="el-iban" className={elCls("iban")} style={errOf("iban") ? { marginBottom: 0 } : undefined} />
                  {note(errOf("iban"))}


                  <p className="checkout-mandate">
                    Door je IBAN op te geven en deze betaling te bevestigen, machtig je Arco en Stripe, onze
                    betaaldienstverlener, om je bank opdracht te geven het bedrag van je rekening af te
                    schrijven. Je hebt recht op terugbetaling door je bank volgens de voorwaarden van je
                    overeenkomst met je bank. Een verzoek tot terugbetaling dien je binnen acht weken in.
                  </p>
                </>
              )}

              {method === "ideal" && (
                <>
                  {/* Ours, not Stripe's: the bank travels to them as a
                      plain value, so the control can be an ordinary
                      Arco field with our own chevron and our own type. */}
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

                  <p className="checkout-mandate">
                    Je betaalt de eerste termijn bij je eigen bank. Daarmee machtig je ons meteen voor de
                    volgende termijnen via automatische incasso, zodat je dit niet elke keer opnieuw hoeft te
                    doen.
                  </p>
                </>
              )}

              {method === "card" && (
                <>
                  <label className="form-label">Kaartnummer</label>
                  {/* Stripe draws the accepted brands inside this one. */}
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

              {usingSaved && (
                <p className="form-note" style={{ margin: "0 0 4px" }}>
                  We gebruiken de machtiging die je eerder gaf.
                </p>
              )}

              {/* Ours, always — except when there is no mandate being
                  given: Stripe has no element for a name, and every
                  mandate needs one attached to it. */}
              {!usingSaved && (
              <>
              <label className="form-label" htmlFor="holder">Naam rekeninghouder</label>
              <input
                id="holder"
                className={inputCls("name")}
                placeholder="Volledige naam"
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
                  <label className="form-label" htmlFor="email">E-mailadres</label>
                  <input
                    id="email"
                    type="email"
                    className={inputCls("email")}
                    placeholder="naam@bedrijf.nl"
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
                    <p className="form-note">Hier bevestigen we de machtiging en sturen we je facturen naartoe.</p>
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
              <h2 className="checkout-legend">Factuuradres</h2>

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
                  <label className="form-label">Adres</label>
                  <div className="checkout-address">
                    <div style={{ minWidth: 0 }}>
                      <span className="checkout-address-line">{address.streetAddress}</span>
                      <span className="checkout-address-sub">{address.city}</span>
                    </div>
                    <button type="button" className="arco-text-link" onClick={() => setAddress(null)}>
                      Wijzigen
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="form-label" htmlFor="country">Land</label>
                  <FormSelect id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                    <option value="NL">Nederland</option>
                    <option value="BE">België</option>
                    <option value="DE">Duitsland</option>
                  </FormSelect>

                  <label className="form-label">Adres</label>
                  <AddressLookup
                    placeholder="Straat en huisnummer"
                    country={country}
                    inputClassName="form-input"
                    onResolved={(r) => {
                      // The resolver carries no postcode of its own; the
                      // formatted line does, and an invoice wants it.
                      const postalCode = r.formattedAddress.match(/\b\d{4}\s?[A-Z]{2}\b/)?.[0] ?? null
                      setAddress({ streetAddress: r.streetAddress, city: r.city ?? "", postalCode })
                      setFieldErrors((prev) => ({ ...prev, address: null }))
                    }}
                  />
                  {note(fieldErrors.address)}
                </>
              )}

              <label className="checkout-check">
                <input type="checkbox" checked={business} onChange={(e) => setBusiness(e.target.checked)} />
                Ik koop zakelijk
              </label>

              {business && (
                <div style={{ marginTop: 20 }}>
                  {/* Prefilled from the company page and editable from
                      there: the name on Arco is a brand, the name on an
                      invoice is a registration, and on this platform
                      they rarely match. */}
                  <label className="form-label" htmlFor="company">Bedrijfsnaam</label>
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
                    <p className="form-note">Zoals je bedrijf bij de KvK staat ingeschreven.</p>
                  )}

                  <label className="form-label" htmlFor="vat">
                    Btw-nummer <span style={{ color: "var(--arco-mid-grey)", fontWeight: 400 }}>(optioneel)</span>
                  </label>
                  <input
                    id="vat"
                    className="form-input"
                    placeholder="NL123456789B01"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                  />
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
                Pro staat vanaf nu aan, gratis tot {freeUntil}, en stopt daarna vanzelf.
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
                  {f}
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
                  {promo.label} ({promo.percent}%)
                  <button
                    type="button"
                    className="checkout-promo-remove"
                    onClick={() => setPromo(null)}
                    aria-label={`Code ${promo.code} verwijderen`}
                  >
                    <X size={13} strokeWidth={1.75} />
                  </button>
                  <span style={{ display: "block", fontSize: 12, color: "var(--arco-mid-grey)" }}>
                    {promo.code} · {promo.periods}
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
                Actiecode toevoegen
              </button>
            )}

            {!promo && promoOpen && (
              <>
                <div className="checkout-promo-form">
                  <input
                    className={`form-input${promoError ? " form-input--error" : ""}`}
                    placeholder="ACTIECODE"
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
                    Toepassen
                  </button>
                </div>
                {promoError && (
                  <p className="form-note form-note--error" style={{ marginBottom: 6 }}>
                    Deze code kennen we niet, of hij geldt niet voor dit abonnement.
                  </p>
                )}
              </>
            )}

            <div className="checkout-price-row">
              <span>Btw (21%)</span>
              <span>{euro(vat)}</span>
            </div>

            <div className="checkout-price-row checkout-price-row--total">
              <span>Vandaag te betalen</span>
              <span>{euro(total)}</span>
            </div>

            {/* A comparison between two list prices — with a discount
                applied it would be weighing the wrong two numbers. */}
            {cycle === "year" && !promo && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--primary)" }}>
                Je bespaart {euro(12 * 4900 - 46800)} ten opzichte van maandelijks betalen.
              </p>
            )}

            <div style={{ marginTop: 20 }}>{submitBlock}</div>
          </aside>
        </div>
        )}
      </div>
    </div>
  )
}
