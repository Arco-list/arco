"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { CalendarClock, CreditCard, FileText, Landmark, Repeat } from "lucide-react"

import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"

import type { CompanyBilling } from "@/lib/subscriptions/get-company-subscription"
import { FREE_CONTRIBUTOR_LIMIT, type ProjectUsage } from "@/lib/subscriptions/usage-types"
import type { BillingDetails } from "@/lib/subscriptions/billing-details-types"
import { PREVIEW_LABELS, PREVIEW_STATES } from "@/lib/subscriptions/preview-states"
import { collectionState, hasUnpaidInvoice } from "@/lib/subscriptions/collection-state"
import { isValidVatNumber } from "@/lib/subscriptions/vat-number"
import { foundingEndsAt } from "@/app/dashboard/subscription/checkout/constants"
import { AddressLookup } from "@/components/address-lookup"
import { AdminTabs } from "@/components/admin/admin-tabs"
import { PricingSection } from "@/components/pricing-section"
import { UsageBar } from "@/components/usage-bar"
import { setCancelAtPeriodEndAction } from "@/lib/subscriptions/actions"
import { saveBillingIdentityAction } from "@/lib/subscriptions/elements-actions"
import {
  previewIntervalSwitchAction,
  cancelScheduledSwitchAction,
  switchIntervalAction,
  type SwitchPreview,
} from "@/lib/subscriptions/elements-actions"

/**
 * The subscription screen for one company: which plan, what it shows,
 * what it costs, what was paid.
 *
 * Everything that changes state stays here: upgrading, changing the
 * payment method and settling a failed collection all go to our own
 * pages, and cancelling and resuming are one field on the subscription,
 * flipped from this screen. The card fields themselves are Stripe's
 * iframes, so no card number touches Arco. Invoices link to Stripe's
 * hosted copy, which is the customer's legal document.
 */
export function SubscriptionScreen({
  companyName,
  isOwner,
  billing,
  usage,
  details,
  previewState = null,
  previewMode = false,
  scheduledSwitch = null,
  isAdmin = false,
  hasCompany = true,
  chrome = "dashboard",
}: {
  companyName: string
  isOwner: boolean
  billing: CompanyBilling
  usage: ProjectUsage
  details: BillingDetails
  /** Set only for an admin viewing a synthetic state. */
  previewState?: string | null
  previewMode?: boolean
  scheduledSwitch?: { interval: "month" | "year"; startsAt: number } | null
  /** Admins get the preview switcher on their own page too. */
  isAdmin?: boolean
  /** False when the whole page is fixtures: there is no real
   *  subscription to switch back to. */
  hasCompany?: boolean
  /**
   * Which shell the page is mounted in. "admin" drops the dashboard
   * header and footer because the admin layout supplies its own — the
   * page itself is identical either way, which is what makes reviewing
   * it in admin worth anything.
   */
  chrome?: "dashboard" | "admin"
}) {
  const t = useTranslations("dashboard")
  const tb = useTranslations("dashboard.billing")
  const locale = useLocale()
  const router = useRouter()
  // Unprefixed: the i18n router puts the locale back on. Checkout
  // carries it so the reader lands where they started — the admin
  // preview page and the dashboard both send people here.
  const pathname = usePathname()

  const euro = (cents: number) =>
    new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", {
      style: "currency", currency: "EUR",
    }).format(cents / 100)

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
          day: "numeric", month: "long", year: "numeric",
        })
      : null

  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<"primary" | "cancel" | "resume" | "switch" | "identity" | "keep" | null>(null)

  /**
   * The confirmation for a subscription that just started.
   *
   * It meets the reader on the page the news is about rather than on a
   * checkout with nothing left to ask. Read from the URL and then taken
   * out of it: an iDEAL payment returns through the bank on a fresh
   * load, so there is no state to carry it in — and a reload should not
   * congratulate someone twice.
   */
  const searchParams = useSearchParams()
  const [notice, setNotice] = useState<"active" | "processing" | "changed" | "collecting" | "settled" | "still_open" | null>(null)
  useEffect(() => {
    const subscribed = searchParams.get("subscribed")
    const changed = searchParams.get("payment_method")
    const which = subscribed === "active" || subscribed === "processing" ? subscribed
      : changed === "changed" || changed === "collecting" || changed === "settled" || changed === "still_open" ? changed
      : null
    if (!which) return
    setNotice(which)
    const next = new URLSearchParams(searchParams.toString())
    next.delete("subscribed")
    next.delete("payment_method")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [searchParams, pathname, router])

  /**
   * Who the invoice is made out to.
   *
   * Collected once at checkout and then unreachable: a company that
   * moved, was renamed, or finally registered for VAT had no way to
   * correct the document it receives every month. It lives beside the
   * payment method rather than on it — those change for different
   * reasons, and nobody should walk a mandate flow through their bank
   * to fix an address.
   */
  const [editIdentity, setEditIdentity] = useState(false)
  // Under the field it belongs to, not in a toast over the dialog. The
  // toast named the VAT number as the likely cause of any failure —
  // a guess dressed as a fact, and it appeared above a form the reader
  // then had to search for the offending field.
  const [identityVatError, setIdentityVatError] = useState<string | null>(null)
  const [identityEmailError, setIdentityEmailError] = useState<string | null>(null)
  const [editingAddress, setEditingAddress] = useState(false)
  const [identity, setIdentity] = useState({
    companyName: details.identity?.companyName ?? "",
    line1: details.identity?.line1 ?? "",
    postalCode: details.identity?.postalCode ?? "",
    city: details.identity?.city ?? "",
    vatNumber: details.identity?.vatNumber ?? "",
    email: details.identity?.email ?? "",
  })

  const [confirmCancel, setConfirmCancel] = useState(false)
  // The cycle being offered, and what Stripe says it costs today. The
  // amount is fetched before the dialog can be confirmed, because a
  // button that moves a few hundred euro should say how many.
  const [switchTo, setSwitchTo] = useState<"month" | "year" | null>(null)
  // null while the sum is still being fetched, false when it could not
  // be. Three states, because "we are working it out" and "we could not
  // work it out" are different things to say to someone about to spend
  // money.
  const [switchPreview, setSwitchPreview] = useState<SwitchPreview | null | false>(null)

  // Undone in place: no dialog, because there is nothing to weigh.
  // Cancelling a switch restores what they already have and costs
  // nothing, unlike making one.
  const keepCurrentCycle = () => {
    if (isPreview && refusePreview()) return
    setBusy("keep")
    startTransition(async () => {
      const result = await cancelScheduledSwitchAction()
      setBusy(null)
      if ("error" in result) {
        toast.error(tb("cycle_keep_failed"))
        return
      }
      toast.success(tb("cycle_kept"))
      router.refresh()
    })
  }

  const openSwitch = (interval: "month" | "year") => {
    if (isPreview && refusePreview()) return
    setSwitchTo(interval)
    setSwitchPreview(null)
    startTransition(async () => {
      const preview = await previewIntervalSwitchAction(interval)
      setSwitchPreview("amountDue" in preview ? preview : false)
    })
  }

  const confirmSwitch = () => {
    if (!switchTo || pending) return
    setBusy("switch")
    startTransition(async () => {
      const result = await switchIntervalAction(switchTo)
      setBusy(null)
      setSwitchTo(null)
      setSwitchPreview(null)
      if ("status" in result) {
        toast.success(tb("switch_done"))
        router.refresh()
        return
      }
      toast.error(tb(`error_${result.error}` as never))
    })
  }

  const toggleCancel = (cancel: boolean) => {
    if (pending || (isPreview && refusePreview())) return
    setBusy(cancel ? "cancel" : "resume")
    startTransition(async () => {
      const result = await setCancelAtPeriodEndAction(cancel)
      setBusy(null)
      setConfirmCancel(false)
      if ("ok" in result) {
        toast.success(tb(cancel ? "cancel_done" : "resume_done"))
        router.refresh()
        return
      }
      toast.error(tb(`error_${result.error}` as never))
    })
  }

  const renewal = formatDate(billing.currentPeriodEnd)
  const isPro = billing.plan === "pro"

  // The heading says what you have; the cycle moved into the line
  // below, where it can be a sentence instead of a parenthesis. Saying
  // "monthly" in the title, again in the body and again on the pill is
  // how a banner ends up repeating itself three times and informing
  // once.
  const planTitle = isPro ? "Pro" : tb("plan_free")

  // Days until the next charge. A countdown beats a date while the date
  // is close enough to plan around, and is absurd when it is not —
  // nobody needs to hear that something renews in 364 days.
  const daysToRenewal = billing.currentPeriodEnd
    ? Math.ceil((new Date(billing.currentPeriodEnd).getTime() - Date.now()) / 86400000)
    : null
  const renewalIsNear = daysToRenewal !== null && daysToRenewal > 0 && daysToRenewal <= 45

  // The plan as a thing you can be "in", without the billing cycle the
  // heading carries: "inbegrepen in Pro (per jaar)" reads as a parenthesis
  // about the wrong noun.
  const planName = isPro ? "Pro" : tb("plan_free")

  // On Pro the two kinds collapse into one number: everything the
  // company has on Arco, none of it held back.
  const totalProjects = usage.publishedCount + usage.contributorTotal

  // Two bars above each other get read against one another, so they
  // share a scale: the larger count takes the full open fill and the
  // other takes its share of it. Without this a 6 and a 2 drew the same
  // length and said the company had as many credits as projects.
  const barScale = Math.max(usage.publishedCount, usage.contributorTotal, 1)

  // The plan chooser. Where it belongs on the page depends on who is
  // reading: on Free the upgrade IS what this page is about, so it
  // comes before the money; on a paid plan it is a catalogue the reader
  // has already chosen from, and payment and invoices are the facts
  // they came for.
  const plansBlock = (
    <PricingSection
      embedded
      showHeader={false}
      sectionHeading={tb("plans_heading")}
      currentPlan={isPro ? "pro" : "free"}
      // The cycle comes from the toggle in the cards, so the price the
      // reader just looked at is the one they get billed — and it rides
      // in the URL, so a half-finished checkout can be reloaded.
      // The plan cards always go to the real checkout, in admin too:
      // the banner button already opens the design study, and with both
      // pointing there the working Stripe flow had no way in from this
      // page at all.
      onUpgrade={isOwner ? (interval) => router.push(
        `/dashboard/subscription/checkout?interval=${interval}&return=${encodeURIComponent(pathname)}`,
      ) : null}
      actionsBusy={pending}
    />
  )

  // The cycle the reader is in now. A scheduled switch names the one
  // that comes next, so the current one is its opposite.
  const currentInterval = scheduledSwitch
    ? (scheduledSwitch.interval === "month" ? "year" : "month")
    : billing.interval

  // What the reader owes is a fact about the page, not about one field
  // on the subscription. Both live in collection-state.ts, so this page
  // and the payment-method page it sends people to cannot disagree.
  const unpaidInvoice = hasUnpaidInvoice(details.invoices)
  // The same three states the invoice table renders per row. The banner
  // used to derive its own answer and contradict the table above which
  // it sits: "Betaling openstaand" over a row reading "In behandeling".
  const collection = collectionState(billing.status, details.invoices, billing.collectionPendingUntil)
  // A warning about collection only belongs to a subscription there is
  // something to collect FOR. An invoice can sit open with no live
  // subscription behind it — a first payment declined, or one cancelled
  // at the end of dunning before its invoice was withdrawn — and there
  // the banner offered "Betaalgegevens bijwerken", which led to a page
  // that refuses outright: there is no subscription to move a mandate
  // onto. A button that cannot do what it says is worse than no button,
  // so this state falls through to the ordinary upgrade path, which is
  // what the reader actually needs to do.
  // The day founding access runs to, worked out from the claim rather
  // than stored: one constant decides how long the give-away lasts, and
  // the checkout quotes the same date from the same place.
  //
  // Stated because the banner is where a subscriber reads when they
  // renew, and a founding member was told only that it was free "during
  // the launch period" — a promise with no end, on the one screen whose
  // job is to say what happens next and when.
  const foundingUntil = (() => {
    const end = foundingEndsAt(billing.foundingClaimedAt)
    if (!end) return null
    return end.toLocaleDateString(locale === "en" ? "en-GB" : "nl-NL", {
      day: "numeric", month: "long", year: "numeric",
    })
  })()

  const hasLiveSubscription = billing.source === "subscription"
  // Gated once, here, rather than at each of the four places that read
  // it — the pill, the sentence, the button and the destination. Those
  // four have to agree, and asking the same question four times is how
  // they stop agreeing.
  const collectionShown = hasLiveSubscription ? collection : "settled"
  const collectionFailed = collectionShown === "failing"

  // One line describing where they stand. Deliberately concrete: a date
  // beats the word "active".
  const statusLine =
    billing.source === "founding"
      ? (foundingUntil
          ? tb("founding_body", { date: foundingUntil })
          : tb("founding_body_undated", { company: companyName }))
    // Their own situation beats a description of the pricing model. The
    // general line explains what Pro unlocks; this one says what is
    // being withheld right now, which is the only version of that
    // sentence someone can act on.
    : billing.source === "none" && usage.contributorHidden > 0
      // The gap, not the absence: "you are on 3, one shows" states the
      // loss without needing the word hidden, and the numbers do the
      // arguing. Anything withheld means the total is at least two, so
      // "ze" never has to agree with a singular.
      ? tb("free_body_hidden", { total: usage.contributorTotal, visible: usage.contributorVisible })
    : billing.source === "none" ? tb("free_body")
    // The date is on the pill beside this line, so the line itself says
    // what the date means. Still gated on having one: without a date
    // there is no pill either, and "tot die datum" would point at
    // nothing.
    : billing.cancelAtPeriodEnd && renewal ? tb("ends_on")
    // Which cycle is ending, not which one is coming. With a switch
    // scheduled these are opposites, and the banner reads the mirrored
    // interval while the payment row reads the schedule — so the two
    // could disagree about the same subscription. The schedule wins:
    // it is what Stripe will actually do.
    //
    // And when a switch is pending, the date is not simply a renewal:
    // the plan renews as the other one. Saying only "wordt verlengd"
    // is true of the date and silent about the change.
    // A debit in flight outranks the renewal date: the reader is
    // waiting on this week, not on next year.
    : collectionShown === "processing" ? tb("processing_body")
    // Unpaid is not a renewal date. Saying "wordt verlengd op" about a
    // subscription whose access has just been withdrawn describes a
    // future that is not going to happen unless something is done.
    : billing.status === "unpaid" ? tb("unpaid_body")
    // Still entitled, but something is owed. The renewal date is true
    // and beside the point.
    : unpaidInvoice && hasLiveSubscription ? tb("open_invoice_body")
    : renewal && scheduledSwitch
      ? tb(scheduledSwitch.interval === "month" ? "renews_body_switching_month" : "renews_body_switching_year", { date: renewal })
    : renewal ? tb(currentInterval === "month" ? "renews_body_month" : "renews_body_year", { date: renewal })
    : ""

  const inAdmin = chrome === "admin"


  // Exactly one primary action, chosen by what the company should do
  // next — not a row of equally-weighted buttons.
  const primaryAction =
    collectionFailed ? tb("action_fix_payment")
    : billing.cancelAtPeriodEnd ? tb("action_reactivate")
    : !isPro ? tb("action_upgrade")
    : null

  // Fixed by giving us a working mandate, which is what the
  // payment-method page is for. Resuming is one field on the
  // subscription and happens here, same as cancelling.
  const primaryGoesToPortal = collectionFailed

  // Every upgrade shortcut goes to the checkout, not to the cards.
  //
  // They used to scroll, because choosing Pro is also choosing a billing
  // cycle and picking yearly silently on the reader's behalf would have
  // been self-serving. The checkout now asks that question itself, with
  // both prices in view — so the scroll had stopped protecting anything
  // and only added a step between wanting Pro and buying it.
  const goUpgrade = () => goReal(
    `/dashboard/subscription/checkout?interval=year&return=${encodeURIComponent(pathname)}`,
  )


  // On a preview tab everything on screen is a fixture, but the actions
  // were not: they resolved the admin's own company and operated on its
  // real subscription. Cancelling from the PRO · MONTHLY preview would
  // have cancelled an actual one. The buttons stay visible — they are
  // part of what is being previewed — and say so when pressed.
  const isPreview = Boolean(previewState)

  /**
   * Leaving this page for one that acts.
   *
   * A preview tab draws an imagined company; the checkout and the
   * payment-method page resolve the reader's real one. Pressing a
   * button on the UNPAID fixture took an admin to a page that looked
   * for their own subscription — which is either absent, and says so
   * confusingly, or present, in which case they would have been one
   * form away from replacing a mandate that has nothing to do with
   * what is on screen.
   *
   * The state-changing actions were already guarded; navigation was
   * not, because it does not change anything here. It changes things
   * there.
   */
  const goReal = (path: string) => {
    if (isPreview && refusePreview()) return
    router.push(path)
  }

  const saveIdentity = () => {
    if (isPreview && refusePreview()) return
    // Optional, so empty is fine; a filled one has to be right. Without
    // this the number is quietly dropped before it reaches the invoice.
    if (identity.vatNumber.trim() && !isValidVatNumber(identity.vatNumber)) {
      setIdentityVatError(tb("identity_vat_invalid"))
      return
    }
    // Same shape the checkout accepts. An unreachable address here is
    // worse than a blank one: invoices would go nowhere and nothing
    // would say so.
    if (identity.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identity.email.trim())) {
      setIdentityEmailError(tb("identity_email_invalid"))
      return
    }
    setBusy("identity")
    startTransition(async () => {
      const result = await saveBillingIdentityAction({
        companyName: identity.companyName,
        vatNumber: identity.vatNumber,
        email: identity.email,
        address: identity.line1
          // Fixed, like the checkout's: we charge 21% Dutch VAT to
          // everyone, which is the wrong tax on a cross-border B2B
          // invoice. Until reverse charge exists, NL is the only
          // country we can bill correctly.
          ? { line1: identity.line1, city: identity.city, postalCode: identity.postalCode, country: "NL" }
          : null,
      })
      setBusy(null)
      if ("error" in result) {
        toast.error(tb("identity_failed"))
        return
      }
      setEditIdentity(false)
      toast.success(tb("identity_saved"))
      router.refresh()
    })
  }

  const refusePreview = () => {
    toast.error(tb("preview_readonly"))
    return true
  }

  // A mark that says what kind of instrument this is: a direct debit
  // and a card behave differently — one is pulled, the other pushed —
  // and that is worth knowing at a glance. Decoration would be a logo;
  // this is the distinction itself.
  const MethodIcon =
    details.paymentMethod?.type === "sepa_debit" ? Repeat
    : details.paymentMethod?.type === "ideal" ? Landmark
    : CreditCard

  return (
    <div
      className={`bg-white flex flex-col${inAdmin ? "" : " min-h-screen"}`}
      style={inAdmin ? undefined : { paddingTop: 60 }}
    >
      {!inAdmin && (
        <Header navLinks={[
          { href: "/dashboard/listings", label: t("listings") },
          { href: "/dashboard/company", label: t("company") },
          { href: "/dashboard/team", label: t("team") },
          { href: "/dashboard/inbox", label: t("inbox") },
          { href: "/dashboard/subscription", label: t("subscription") },
        ]} />
      )}

      {/* The switcher belongs to the admin page, where walking every
          state is the job — and to any page currently showing one.
          It used to key on being an admin, which put it above an
          admin's own subscription on the very page they came to manage
          it. On /dashboard/subscription it therefore rides ?preview=, and
          "Sluiten" is the way back to the real thing.

          "Live" is the admin's own subscription: a tab worth having
          inside admin, but on the dashboard it would clear the param
          and take the bar with it — which is what Sluiten says plainly. */}
      {(inAdmin || previewMode) && (
        <AdminTabs
          param="preview"
          title="Preview"
          tabs={[
            // No company of their own: nothing to return to, so the tab
            // that clears the preview would land on a redirect.
            ...(inAdmin && hasCompany ? [{ key: "live", label: "Live" }] : []),
            ...PREVIEW_STATES.map((s) => ({ key: s, label: PREVIEW_LABELS[s] })),
          ]}
          active={previewState ?? (inAdmin ? "live" : PREVIEW_STATES[0])}
          actions={
            !inAdmin ? (
              <Link href="/dashboard/subscription" className="arco-text-link arco-text-link--inline">
                Sluiten
              </Link>
            ) : undefined
          }
        />
      )}

      <div className="discover-page-title">
        <div className="wrap">
          <h2 className="arco-section-title">{tb("title")}</h2>
        </div>
      </div>

      <main style={{ flex: 1 }}>
        {/* .discover-results carries 80px of tail padding for grid
            pages that end here. This page continues, so that padding
            becomes a hole above the next section's title. */}
        <div className="discover-results" style={{ paddingBottom: 0 }}>
          {/* Full wrap width, like the rest of the dashboard: the
              banner and the included table share one edge, and the
              price column lands where the eye already expects a
              right-hand value. */}
          <div className="wrap">

            {/* ── Plan header: name, state, and the one action that
                   matters right now. The quiet banner (.arco-banner) is
                   the system's "here is where you stand" surface —
                   exactly what a plan summary is. ─────────────────── */}
            {/* No alignItems override: .arco-banner centres its children,
                which is what keeps the buttons on the optical middle of a
                two- or three-line body instead of hanging from the top. */}
            <div className="arco-banner" style={{ marginBottom: 32 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 5 }}>
                  <h3 className="arco-banner-title" style={{ margin: 0 }}>{planTitle}</h3>
                  {/* Tinted, like the one in the cancellation section:
                      beside a 28px plan name these carry a state in a
                      sentence, not a legend on a table row. */}
                  {/* Healthy and renewing soon: the one state that used
                      to carry no pill at all, even though "in 23 days"
                      is exactly the kind of thing a pill is for. */}
                  {billing.source === "subscription" && !billing.cancelAtPeriodEnd
                    && billing.status === "active" && renewalIsNear && (
                    <span className="status-pill status-pill--tinted status-pill--info shrink-0">
                      {daysToRenewal === 1
                        ? tb("pill_renews_tomorrow")
                        : tb("pill_renews_days", { days: daysToRenewal })}
                    </span>
                  )}

                  {billing.source === "founding" && (
                    <span className="status-pill status-pill--tinted status-pill--info shrink-0">
                      {tb("founding_badge")}
                    </span>
                  )}
                  {billing.cancelAtPeriodEnd && renewal && (
                    <span className="status-pill status-pill--tinted status-pill--ending shrink-0">
                      {tb("pill_ends", { date: renewal })}
                    </span>
                  )}
                  {collectionShown === "failing" && (
                    <span className="status-pill status-pill--tinted status-pill--ending shrink-0">
                      {tb(billing.status === "unpaid" ? "status_unpaid" : "status_past_due")}
                    </span>
                  )}
                  {collectionShown === "processing" && (
                    <span className="status-pill status-pill--tinted status-pill--neutral shrink-0">
                      {tb("status_processing")}
                    </span>
                  )}
                </div>
                <p className="arco-banner-body">{statusLine}</p>
              </div>

              {/* One action, or none, and all three stay on Arco. */}
              {isOwner && primaryAction && (
                <div className="arco-banner-actions">
                  {primaryAction && (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ fontSize: 14, padding: "10px 20px", opacity: busy ? 0.6 : 1 }}
                      onClick={
                        // A failed collection needs a working mandate
                        // and the open invoice settled. Our own page
                        // does both — it replaces the mandate and then
                        // retries the invoice rather than waiting out
                        // Stripe's own schedule — so dunning no longer
                        // ends at a hosted page either.
                        primaryGoesToPortal
                          ? () => goReal("/dashboard/subscription/payment-method?return=/dashboard/subscription")
                        : billing.cancelAtPeriodEnd ? () => toggleCancel(false)
                        : goUpgrade
                      }
                      disabled={pending}
                    >
                      {busy === "primary" ? tb("opening")
                        : busy === "resume" ? tb("working")
                        : primaryAction}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── What is actually on Arco ───────────────────────
                   On Free the two kinds of project are two meters,
                   because the pricing model draws a line between them:
                   publishing is unlimited, credits are what Pro unlocks.
                   On Pro that line is gone, so drawing it anyway would
                   invite the reader to look for a difference that no
                   longer exists — one bar, all their work. */}
            {/* gap 4, not 24: every bar already carries a 28px row of
                under-labels beneath its track, and that row reads as
                white space rather than as content. 28 + 4 matches the
                32px the banner leaves above the first bar, so the two
                bars sit at the same distance from what precedes them. */}
            <div style={{ marginBottom: 36, display: "flex", flexDirection: "column", gap: 4 }}>
              {isPro ? (
                <UsageBar
                  label={tb("projects_noun", { count: totalProjects })}
                  count={totalProjects}
                  fillPct={totalProjects > 0 ? 100 : 0}
                  endLabel={tb("unlimited_included", { plan: planName })}
                  unbounded
                />
              ) : (
                <>
                  {/* A company that cannot publish (a photographer, say)
                      gets only the credit meter — an empty publisher bar
                      would imply a limit that does not apply to them. */}
                  {usage.canPublish && (
                    <UsageBar
                      label={tb("published_noun", { count: usage.publishedCount })}
                      count={usage.publishedCount}
                      fillPct={usage.publishedCount > 0 ? 100 : 0}
                      fillShare={usage.publishedCount / barScale}
                      endLabel={tb("unlimited_included", { plan: planName })}
                      unbounded
                    />
                  )}

                  {/* Nothing credited yet, and publishing is what this
                      company does: an empty credit meter here is a pitch
                      for something they have not run into. It appears
                      the moment someone credits them — and a company
                      that cannot publish keeps it either way, since
                      credits are its whole relationship with Arco. */}
                  {(usage.contributorTotal > 0 || !usage.canPublish) && (
                  <UsageBar
                    label={tb("contributor_noun", { count: usage.contributorTotal })}
                    count={usage.contributorTotal}
                    fillPct={usage.contributorTotal > 0 ? 100 : 0}
                    fillShare={usage.contributorTotal / barScale}
                    unbounded
                    // The dimmed stretch past this point is what the
                    // company has but the public cannot see.
                    lockedFromPct={
                      usage.contributorTotal === 0
                        ? null
                        : (62 * usage.contributorVisible) / usage.contributorTotal
                    }
                    lockedLabel={usage.contributorHidden > 0 ? tb("hidden_in_bar", { count: usage.contributorHidden }) : null}
                    // The allowance, stated whether or not it has been
                    // used: an empty bar is exactly where it matters.
                    markerLabel={tb("free_count", { count: FREE_CONTRIBUTOR_LIMIT })}
                    endLabel={tb("upgrade_for_unlimited")}
                    // The same route as the banner's upgrade button. Only
                    // the owner can take it, so for anyone else the words
                    // stay words.
                    onEndLabelClick={isOwner ? goUpgrade : null}
                  />
                  )}
                </>
              )}
            </div>

            {!isOwner && (
              <p className="arco-small-text" style={{ marginBottom: 24 }}>{tb("owner_only")}</p>
            )}

          </div>
        </div>

        {/* Payment and invoices — the facts. On Free they follow the
            plans; on a paid plan they lead, and the chooser comes after
            them. */}
        <div className="wrap" style={{ paddingBottom: 80 }}>
          {/* ── Payment ──────────────────────────────────────────── */}
          {/* Only once Stripe knows this company. Before the first
              subscription there is nothing to show and nothing to add
              from here — an empty row would be a section about
              nothing. */}
          {/* Only while there is something to pay for.
              A customer, a mandate and a billing address all outlive a
              checkout that failed, so a declined card sat under
              "Betaling" on a free account — a payment relationship
              announced where none exists. The mandate is not lost by
              hiding it: the checkout still offers it back as the saved
              method, which is the moment it is worth mentioning. */}
          {isOwner && hasLiveSubscription && (billing.stripeCustomerId || details.paymentMethod) && (
            <div style={{ marginBottom: 36 }}>
              <h4 className="arco-subsection-title" style={{ marginBottom: 14 }}>{tb("payment_heading")}</h4>
              <div className="billing-row" style={{ borderTop: "1px solid var(--arco-light-grey)" }}>
                <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  {details.paymentMethod ? (
                    <>
                      <MethodIcon size={16} strokeWidth={1.5} style={{ color: "var(--arco-mid)", flexShrink: 0 }} />
                      {details.paymentMethod.label}
                      {details.paymentMethod.last4 && (
                        <span style={{ color: "var(--text-secondary)" }}>{` ···· ${details.paymentMethod.last4}`}</span>
                      )}
                      {details.paymentMethod.expiry && (
                        <span style={{ color: "var(--text-secondary)" }}>{` · ${details.paymentMethod.expiry}`}</span>
                      )}
                    </>
                  ) : (
                    <span style={{ color: "var(--text-secondary)" }}>{tb("no_payment_method")}</span>
                  )}
                </span>
                {/* Nothing to replace until Stripe knows this company. */}
                {billing.stripeCustomerId && (
                  <button
                    type="button"
                    className="btn-tertiary"
                    style={{ fontSize: 13, padding: "8px 16px" }}
                    // Our own page, for everyone. It was the portal
                    // outside admin while the Elements checkout was
                    // still a study — sending real customers to one
                    // Arco page and one hosted page for two halves of
                    // the same job would have been worse than sending
                    // them to neither. Both halves are ours now.
                    onClick={() => goReal("/dashboard/subscription/payment-method?return=/dashboard/subscription")}
                    disabled={pending}
                  >
                    {tb("update")}
                  </button>
                )}
              </div>


              {/* Beside the method rather than after the cycle: both
                  are standing facts about the payer that get corrected
                  now and then, while the cycle is a decision with money
                  behind it. Facts first, choice last. Only once Stripe
                  knows this company — before that there is no document
                  to be wrong about. */}
              {isOwner && billing.stripeCustomerId && (
                <div className="billing-row billing-row--single-line">
                  <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <FileText size={16} strokeWidth={1.5} style={{ color: "var(--arco-mid)", flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {details.identity?.companyName || tb("identity_empty")}
                      {details.identity?.line1 && (
                        <span style={{ color: "var(--text-secondary)" }}>
                          {" · "}{[details.identity.line1, details.identity.postalCode, details.identity.city]
                            .filter(Boolean).join(", ")}
                        </span>
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn-tertiary"
                    style={{ fontSize: 13, padding: "8px 16px", whiteSpace: "nowrap" }}
                    onClick={() => setEditIdentity(true)}
                    disabled={pending}
                  >
                    {tb("update")}
                  </button>
                </div>
              )}
              {/* Last, because it is the only row here that changes
                  what gets charged. It is also where the annual upsell
                  belongs: a
                  factual row for someone already looking at their
                  billing, rather than a button bolted onto the toggle
                  they were using to compare two prices. */}
              {isOwner && billing.source === "subscription" && billing.interval && (
                <>
                  <div className="billing-row">
                    <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      {/* Not decoration either: the row above is about
                          the instrument, this one about the schedule,
                          and the two marks say which is which before
                          the words do. */}
                      <CalendarClock size={16} strokeWidth={1.5} style={{ color: "var(--arco-mid)", flexShrink: 0 }} />
                      {/* A switch to a cheaper cycle is scheduled, not
                          applied: the subscription stays yearly until
                          the year it was paid for runs out. Saying only
                          "Jaarlijks" and offering the switch again was
                          true of the subscription and false of what the
                          reader had just done. */}
                      {scheduledSwitch
                        ? tb(scheduledSwitch.interval === "month" ? "cycle_row_switching_to_month" : "cycle_row_switching_to_year", {
                            date: new Date(scheduledSwitch.startsAt * 1000).toLocaleDateString(locale === "en" ? "en-GB" : "nl-NL", { day: "numeric", month: "long", year: "numeric" }),
                          })
                        : tb(billing.interval === "month" ? "cycle_row_month" : "cycle_row_year")}
                    </span>
                    {/* Two buttons, never both: one offers the
                        switch, the other takes it back. Offering the
                        same switch again once it is scheduled would
                        deny what the reader just did — but leaving the
                        row bare held them to the decision for up to a
                        year with nothing on the page to undo it. */}
                    {scheduledSwitch ? (
                      <button
                        type="button"
                        className="btn-tertiary"
                        style={{ fontSize: 13, padding: "8px 16px" }}
                        onClick={keepCurrentCycle}
                        disabled={pending}
                      >
                        {busy === "keep"
                          ? tb("working")
                          : tb(billing.interval === "month" ? "cycle_keep_month" : "cycle_keep_year")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-tertiary"
                        style={{ fontSize: 13, padding: "8px 16px" }}
                        onClick={() => openSwitch(billing.interval === "month" ? "year" : "month")}
                        disabled={pending}
                      >
                        {tb(billing.interval === "month" ? "cycle_switch_up" : "cycle_switch_down")}
                      </button>
                    )}
                  </div>
                  {/* Accent, like the same sentence on the checkout
                      page. The persuasion lives in the number, not in
                      the button beside it — that one stays as quiet as
                      the row above it, because changing your cycle and
                      changing your payment method are the same kind of
                      act and should not look ranked. */}
                  {/* Whoever ends up on monthly, whether they are there
                      now or on their way. A scheduled switch used to
                      silence this, which withheld the argument at the
                      one moment it is most worth making: beside the
                      button that undoes the switch, for a reader who
                      has decided to leave the yearly price and can
                      still change their mind. */}
                  {(scheduledSwitch?.interval ?? billing.interval) === "month" && (
                    <p className="arco-small-text" style={{ margin: "10px 0 0", color: "var(--primary)" }}>
                      {tb("cycle_saving")}
                    </p>
                  )}
                </>
              )}

            </div>
          )}

          {/* ── Invoices ─────────────────────────────────────────── */}
          {/* No bottom margin of its own: the notes below belong to this
              table and sit 10px under it, and what follows them is the
              plan chooser, which brings 64px or more of its own. A 36px
              gap here only pushed a footnote away from its subject. */}
          {isOwner && details.invoices.length > 0 && (
            <div>
              <h4 className="arco-subsection-title" style={{ marginBottom: 14 }}>{tb("invoices_heading")}</h4>
              <div className="invoice-grid invoice-head" style={{
                paddingBottom: 10, borderBottom: "1px solid var(--arco-light-grey)",
              }}>
                <span className="arco-eyebrow">{tb("col_date")}</span>
                <span className="arco-eyebrow">{tb("col_total")}</span>
                <span className="arco-eyebrow">{tb("col_status")}</span>
                <span className="arco-eyebrow">{tb("col_actions")}</span>
              </div>
              {details.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="invoice-grid"
                  style={{
                    padding: "14px 0",
                    borderBottom: "1px solid var(--arco-light-grey)", fontSize: 14,
                  }}
                >
                  <span>{formatDate(inv.created)}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{inv.total}</span>
                  {/* An open invoice with a debit already travelling is
                      not the same as one nobody is paying, and they used
                      to read identically — the same amber "Openstaand"
                      beside the same "Betalen", which made a payment in
                      progress look like a payment that had failed.
                      Money on the way is a quiet, grey fact. */}
                  <span style={{
                    // The same red as "Loopt af op …": an invoice nobody
                    // is paying costs access, so it belongs with the
                    // other facts that do. Amber was a warning about
                    // something that might go wrong; this one already
                    // has.
                    //
                    // `void` is not one of those, though it used to be
                    // drawn as one. A voided invoice was withdrawn
                    // before payment — nothing is owed on it and
                    // nothing ever was — and Stripe issues them on its
                    // own whenever a subscription is cancelled with an
                    // unpaid invoice, so a real customer meets one. In
                    // red, directly under an invoice that genuinely is
                    // owed, it read as a second debt. It stays in the
                    // list because it may already have been emailed and
                    // its cancellation is the news; it just isn't a
                    // demand. `uncollectible` keeps the red: there the
                    // money was owed and never came.
                    color: inv.status === "paid" || inv.status === "void" || inv.processing
                      ? "var(--text-secondary)"
                      : "var(--destructive)",
                  }}>
                    {inv.processing
                      ? tb("invoice_status_processing")
                      : ["open", "paid", "uncollectible", "void", "draft"].includes(inv.status)
                        ? tb(`invoice_status_${inv.status}` as never)
                        : inv.status}
                  </span>
                  <span style={{ display: "inline-flex", gap: 14, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {/* An open invoice is settled on our own page, not
                        Stripe's: updating the mandate collects this one
                        AND fixes every one after it, which is what the
                        reader needs. Two doors to the same room, one of
                        them leaving Arco, only made them wonder which
                        was right. */}
                    {inv.status === "open" && !inv.processing && (
                      <button
                        type="button"
                        onClick={() => goReal(`/dashboard/subscription/payment-method?return=${encodeURIComponent(pathname)}`)}
                        style={{
                          background: "none", border: "none", padding: 0, cursor: "pointer",
                          font: "inherit", color: "var(--primary, #016D75)",
                        }}
                      >
                        {tb("pay_invoice")}
                      </button>
                    )}
                    {/* The document itself, straight to the file. It
                        used to be a link to Stripe's payment page with
                        the download hidden on it — three steps to read
                        an invoice you have already paid. Offered while
                        it is still open too: an unpaid invoice is just
                        as much a document you may need to forward. */}
                    {inv.pdfUrl ? (
                      <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary, #016D75)" }}>
                        {tb("download_invoice")}
                      </a>
                    ) : inv.url ? (
                      <a href={inv.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary, #016D75)" }}>
                        {tb("view_invoice")}
                      </a>
                    ) : inv.status === "open" && !inv.processing ? null : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}


          {/* Both sit at 10px, the same gap the saving line keeps under
              the cycle row: a note explains the thing directly above it,
              so it belongs to that block rather than floating between
              two of them. */}
          {/* Only while retries are running. Once they have stopped the
              banner says it, and saying it twice on one page turns one
              problem into two. */}
          {billing.status === "past_due" && (
            <p className="arco-small-text" style={{ margin: "10px 0 0" }}>
              {tb("past_due_help")}
            </p>
          )}

          {/* The chooser, always after the facts and before the way
              out. On Free there are no facts yet — payment and invoices
              hide themselves — so it simply follows the meters. */}
          {/* More air on Free, where this follows the meters directly:
              after an invoice table the same gap reads as a break, but
              under a bar it reads as the bar's own bottom padding. */}
          <div id="plans" style={{ marginTop: isPro ? 64 : 88, scrollMarginTop: 80 }}>
            {plansBlock}
          </div>

          {/* ── Cancellation ────────────────────────────────────────
                 Last on the page, and only for a company that has
                 something to cancel: on Free there is no subscription,
                 and on founding access there is no Stripe object behind
                 it. Ending a plan is a decision, not a setting, so it
                 gets its own heading rather than hiding in Manage. */}
          {isOwner && billing.source === "subscription" && billing.stripeCustomerId && (
            /* The section's own top margin, not the previous block's
               bottom one: the notes above (a founding explainer, a
               dunning line) render conditionally, so the gap cannot
               depend on them being there. */
            <div style={{ marginTop: 64, marginBottom: 36 }}>
              <h4 className="arco-subsection-title" style={{ marginBottom: 14 }}>{tb("cancel_heading")}</h4>

              {billing.cancelAtPeriodEnd ? (
                /* Same row as cancelling, read the other way round: the
                   state on the left with its date, the way back on the
                   right. A bordered card made the reversal look like a
                   different kind of thing than the act that caused it. */
                <>
                  <div className="billing-row" style={{ borderTop: "1px solid var(--arco-light-grey)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                      <span style={{ fontSize: 14 }}>{tb("ending_title")}</span>
                      {renewal && (
                        <span className="status-pill status-pill--tinted status-pill--ending shrink-0">
                          {tb("pill_ends", { date: renewal })}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="btn-tertiary"
                      style={{ fontSize: 13, padding: "8px 16px", color: "var(--primary)", borderColor: "var(--primary)", opacity: busy === "resume" ? 0.6 : 1 }}
                      onClick={() => toggleCancel(false)}
                      disabled={pending}
                    >
                      {busy === "resume" ? tb("working") : tb("action_reactivate")}
                    </button>
                  </div>
                  <p className="arco-small-text" style={{ margin: "10px 0 0", maxWidth: 560 }}>
                    {renewal ? tb("ending_body", { date: renewal }) : tb("ending_note")}
                  </p>
                </>
              ) : (
                <>
                  <div className="billing-row" style={{ borderTop: "1px solid var(--arco-light-grey)" }}>
                    <span style={{ fontSize: 14 }}>{tb("cancel_row")}</span>
                    <button
                      type="button"
                      className="btn-tertiary"
                      style={{ fontSize: 13, padding: "8px 16px", color: "var(--destructive)", borderColor: "var(--destructive)" }}
                      onClick={() => setConfirmCancel(true)}
                      disabled={pending}
                    >
                      {tb("cancel_action")}
                    </button>
                  </div>
                  <p className="arco-small-text" style={{ margin: "10px 0 0", maxWidth: 560 }}>{tb("cancel_note")}</p>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* The one place a pop-up beats a page: a destructive choice the
          reader must be able to back out of without losing where they
          were. Same card as every other confirm on the platform. */}
      {confirmCancel && (
        <div className="popup-overlay" onClick={() => !pending && setConfirmCancel(false)}>
          <div className="popup-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3 className="arco-section-title">{tb("cancel_confirm_title")}</h3>
              <button type="button" className="popup-close" onClick={() => setConfirmCancel(false)} aria-label="Sluiten">✕</button>
            </div>
            <p className="arco-small-text" style={{ margin: "0 0 24px" }}>
              {renewal ? tb("cancel_confirm_body", { date: renewal }) : tb("cancel_confirm_body_nodate")}
            </p>
            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                style={{ flex: 1 }}
                onClick={() => setConfirmCancel(false)}
                disabled={pending}
              >
                {tb("cancel_confirm_keep")}
              </button>
              <button
                type="button"
                className="btn-tertiary"
                style={{ flex: 1, color: "var(--destructive)", borderColor: "var(--destructive)" }}
                onClick={() => toggleCancel(true)}
                disabled={pending}
              >
                {busy === "cancel" ? tb("working") : tb("cancel_confirm_go")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One card for every piece of news this page can arrive with:
          a subscription that started, one still clearing, or a mandate
          that moved. They all end the same way — the reader is here,
          looking at the thing that changed. */}
      {notice && (
        <div className="popup-overlay" onClick={() => setNotice(null)}>
          <div className="popup-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3 className="arco-section-title">
                {tb(notice === "active" ? "welcome_title_active"
                  : notice === "processing" ? "welcome_title_processing"
                  : notice === "settled" ? "settled_title"
                  : notice === "still_open" ? "still_open_title"
                  : "method_title")}
              </h3>
              <button type="button" className="popup-close" onClick={() => setNotice(null)} aria-label="Sluiten">✕</button>
            </div>
            <p className="arco-small-text" style={{ margin: "0 0 24px" }}>
              {tb(notice === "active" ? "welcome_body_active"
                : notice === "processing" ? "welcome_body_processing"
                : notice === "collecting" ? "retried_body"
                : notice === "settled" ? "settled_body"
                : notice === "still_open" ? "still_open_body"
                : "method_body")}
            </p>
            <div className="popup-actions">
              <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => setNotice(null)}>
                {tb(notice === "active" || notice === "processing" ? "welcome_close" : "method_close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {editIdentity && (
        <div className="popup-overlay"
          onClick={() => { if (!pending) { setEditIdentity(false); setIdentityVatError(null); setIdentityEmailError(null); setEditingAddress(false) } }}>
          <div className="popup-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3 className="arco-section-title">{tb("identity_title")}</h3>
              <button type="button" className="popup-close"
                onClick={() => { setEditIdentity(false); setIdentityVatError(null); setIdentityEmailError(null); setEditingAddress(false) }}
                aria-label={tb("method_close")}>✕</button>
            </div>
            <p className="arco-small-text" style={{ margin: "0 0 20px" }}>{tb("identity_intro")}</p>

            <label className="form-label" htmlFor="bi-name">{tb("identity_company")}</label>
            <input id="bi-name" className="form-input" value={identity.companyName}
              onChange={(e) => setIdentity((v) => ({ ...v, companyName: e.target.value }))} />

            <label className="form-label">{tb("identity_address")}</label>
            {/* Stated, with a way in — not a search box the reader has
                to answer. Someone who opened this dialog to correct a
                VAT number did not come to re-pick their address, and a
                lookup standing where a known address should be makes
                them do exactly that. Empty, it opens as the search,
                because "Wijzigen" over nothing is a button to nowhere. */}
            {identity.line1 && !editingAddress ? (
              <div className="checkout-address">
                <div style={{ minWidth: 0 }}>
                  <span className="checkout-address-line">{identity.line1}</span>
                  <span className="checkout-address-sub">
                    {[identity.postalCode, identity.city].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <button type="button" className="arco-text-link" onClick={() => setEditingAddress(true)}>
                  {tb("identity_address_change")}
                </button>
              </div>
            ) : (
              <div>
                <AddressLookup
                  placeholder={tb("identity_address_placeholder")}
                  country="NL"
                  inputClassName="form-input"
                  onResolved={(r) => {
                    setIdentity((v) => ({
                      ...v,
                      line1: r.streetAddress,
                      // Straight from the resolver's own field. The
                      // checkout dug it out of the formatted line with
                      // a regex, which only ever matched the Dutch
                      // shape and returned nothing elsewhere.
                      postalCode: r.postalCode ?? "",
                      city: r.city ?? "",
                    }))
                    setEditingAddress(false)
                  }}
                />
              </div>
            )}

            {/* Last, because it is the field that least often changes —
                and separate from the account address on purpose: an
                invoice is filed by whoever does the books. Set at
                checkout and, until now, never correctable. */}
            <label className="form-label" htmlFor="bi-email">{tb("identity_email")}</label>
            <input id="bi-email" type="email"
              className={`form-input${identityEmailError ? " form-input--error" : ""}`}
              value={identity.email}
              onChange={(e) => {
                setIdentity((v) => ({ ...v, email: e.target.value }))
                setIdentityEmailError(null)
              }}
              style={{ marginBottom: 0 }} />
            {identityEmailError
              ? <p className="form-note form-note--error" style={{ marginBottom: 20 }}>{identityEmailError}</p>
              : <p className="form-note" style={{ marginBottom: 20 }}>{tb("identity_email_note")}</p>}

            <label className="form-label" htmlFor="bi-vat">
              {tb("identity_vat")} <span style={{ color: "var(--arco-mid-grey)", fontWeight: 400 }}>{tb("identity_optional")}</span>
            </label>
            <input id="bi-vat" className={`form-input${identityVatError ? " form-input--error" : ""}`}
              placeholder="NL…………B01" value={identity.vatNumber}
              onChange={(e) => {
                setIdentity((v) => ({ ...v, vatNumber: e.target.value }))
                setIdentityVatError(null); setIdentityEmailError(null); setEditingAddress(false)
              }}
              style={{ marginBottom: identityVatError ? 0 : 24 }} />
            {identityVatError && (
              <p className="form-note form-note--error" style={{ marginBottom: 24 }}>{identityVatError}</p>
            )}

            {/* What Stripe's own check made of the number on file.
                Shown, never enforced: VIES goes down, member states
                answer late, and refusing a purchase because a European
                registry is slow is the wrong trade. Only the two
                answers a reader can act on say anything — the other
                two are about VIES, not about them, and a warning there
                would send somebody hunting for a problem they do not
                have. Hidden entirely while the field is being edited:
                the verdict belongs to the saved number, not the one
                halfway through being typed. */}
            {!identityVatError && identity.vatNumber === (details.identity?.vatNumber ?? "") && (
              details.identity?.vatStatus === "unverified" ? (
                <p className="form-note form-note--error" style={{ marginBottom: 24 }}>
                  {tb("identity_vat_unverified")}
                </p>
              ) : details.identity?.vatStatus === "verified" ? (
                <p className="form-note" style={{ marginBottom: 24 }}>
                  {details.identity.vatVerifiedName
                    ? tb("identity_vat_verified_name", { name: details.identity.vatVerifiedName })
                    : tb("identity_vat_verified")}
                </p>
              ) : null
            )}

            <div className="popup-actions">
              <button type="button" className="btn-tertiary" style={{ flex: 1 }}
                onClick={() => { setEditIdentity(false); setIdentityVatError(null); setIdentityEmailError(null); setEditingAddress(false) }} disabled={pending}>
                {tb("cancel_confirm_keep")}
              </button>
              <button type="button" className="btn-primary" style={{ flex: 1 }}
                onClick={saveIdentity} disabled={pending}>
                {busy === "identity" ? tb("working") : tb("identity_save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Same confirm as cancelling, for the same reason: a choice that
          moves money, with a way back that costs nothing. */}
      {switchTo && (
        <div className="popup-overlay" onClick={() => !pending && setSwitchTo(null)}>
          <div className="popup-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3 className="arco-section-title">
                {tb(switchTo === "year" ? "switch_confirm_title" : "switch_confirm_title_down")}
              </h3>
              <button type="button" className="popup-close" onClick={() => setSwitchTo(null)} aria-label="Sluiten">✕</button>
            </div>
            {switchPreview === null ? (
              <p className="arco-small-text" style={{ margin: "0 0 24px" }}>{tb("cycle_calculating")}</p>
            ) : switchPreview === false ? (
              <p className="arco-small-text" style={{ margin: "0 0 24px" }}>{tb("switch_confirm_body_unknown")}</p>
            ) : switchPreview.atPeriodEnd ? (
              // Nothing moves today, so there is no sum to show. A table
              // of zeroes would be arithmetic about nothing.
              <p className="arco-small-text" style={{ margin: "0 0 24px" }}>
                {tb("switch_at_period_end", { date: renewal ?? "" })}
              </p>
            ) : (
              <div style={{ marginBottom: 24 }}>
                {/* The sum, not a sentence about the sum. Someone about
                    to be charged a few hundred euro should be able to
                    check the arithmetic. */}
                <div className="checkout-price-row">
                  <span>{tb(switchTo === "year" ? "cycle_line_new_year" : "cycle_line_new_month")}</span>
                  <span>{euro(switchPreview.newAmount)}</span>
                </div>
                {switchPreview.credit !== 0 && (
                  <div className="checkout-price-row">
                    <span>{tb("cycle_line_credit")}</span>
                    <span>{euro(switchPreview.credit)}</span>
                  </div>
                )}
                <div className="checkout-price-row">
                  <span>{tb("cycle_line_tax")}</span>
                  <span>{euro(switchPreview.tax)}</span>
                </div>
                <div className="checkout-price-row checkout-price-row--total">
                  <span>{tb("cycle_line_due")}</span>
                  <span>{euro(switchPreview.amountDue)}</span>
                </div>
                <p className="arco-small-text" style={{ margin: "14px 0 0" }}>
                  {tb(switchTo === "year" ? "cycle_after_year" : "cycle_after_month")}
                </p>
              </div>
            )}
            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                style={{ flex: 1 }}
                onClick={() => setSwitchTo(null)}
                disabled={pending}
              >
                {tb("cancel_confirm_keep")}
              </button>
              {/* Primary, not the dark secondary: this is a constructive
                  choice. The cancel dialog next door wears a red outline
                  for the opposite reason. */}
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={confirmSwitch}
                // Nothing to confirm until the amount is on screen.
                disabled={pending || switchPreview === null}
              >
                {busy === "switch" ? tb("working") : tb("switch_confirm_go")}
              </button>
            </div>
          </div>
        </div>
      )}

      {!inAdmin && <Footer />}
    </div>
  )
}

/**
 * One usage meter: a label, a filled track with the count inside it,
 * and a value on the right. The count sits in the bar rather than above
 * it so the number and the thing it measures cannot drift apart when
 * the bar is short.
 */
