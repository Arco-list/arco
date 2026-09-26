import { getTranslations } from "next-intl/server"
import { headers } from "next/headers"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { verifyClaimToken } from "@/lib/claim/claim-token"
import { loadClaimContext, loadPlatformStartContext } from "@/lib/claim/context"

import { Link } from "@/i18n/navigation"

import { ClaimClient } from "./claim-client"
import { HeaderLanguageSwitcher } from "@/components/header-language-switcher"
import styles from "./claim.module.css"

export const dynamic = "force-dynamic"

/**
 * /claim?t=… — the new company signup funnel, entered by a signed,
 * single-use token from an invite email.
 *
 * Built NEXT TO the modal-based flow: nothing links here until the
 * invite emails' claim_url is switched over. The page only reads on
 * load — the token is proof, not a session, and everything rendered is
 * public information about the recipient's own company. Accounts are
 * created by an explicit POST on the last screen, never by a GET.
 */
export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ t?: string; step?: string; c?: string; p?: string }>
}) {
  const { locale } = await params
  const { t: token, step, c: pickedCompanyId, p: pickedPlaceId } = await searchParams
  const t = await getTranslations({ locale, namespace: "claim" })

  // Dead-end states wear the same chrome as the funnel itself — the
  // funnel header (logo, language switcher) and the step-1 type scale —
  // so a spent or broken link still lands on a page that feels like
  // the product, with a way onward where one exists.
  const invalid = (title: string, body: string, action?: { href: string; label: string }) => (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
            alt="Arco"
            className={styles.logo}
          />
          <HeaderLanguageSwitcher />
        </div>
      </header>
      <div className={styles.body}>
        <div className={styles.wrap}>
          <div className={styles.intro}>
            <h1 className={`arco-page-title ${styles.display}`}>{title}</h1>
            <p className={`arco-body-text ${styles.lede}`}>{body}</p>
            {action && (
              <div style={{ marginTop: 28 }}>
                <Link href={action.href} className="landing-cta">{action.label}</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )

  // No token at all → the PLATFORM channel: the tokenless funnel entered
  // from the site itself, opening on a company search instead of a
  // prefilled review. A token that is present but broken still errors —
  // a mangled email link should say so, not silently demote the visitor
  // to the search flow.
  let parsed: Awaited<ReturnType<typeof verifyClaimToken>> | null = null
  let ctx = null
  if (token !== undefined) {
    parsed = await verifyClaimToken(token)
    if (!parsed.ok) {
      return parsed.reason === "expired"
        ? invalid(t("expired_title"), t("expired_body"))
        : invalid(t("invalid_title"), t("invalid_body"))
    }
    // Funnel stage, recorded BEFORE the page decides what to show.
    //
    // A signed token that verifies means this person clicked the link
    // in their e-mail, and that is the whole of what the visitor step
    // asks. Whether they then get the claim form, "already claimed" or
    // "link already used" is the product answering a different
    // question, and it used to decide the measurement too: this block
    // sat below three early returns, so a second click on the same
    // link, or a company a colleague had claimed in the meantime, was
    // a real arrival that no ledger recorded. The funnel read those as
    // people who never opened the mail.
    //
    // Geo + UA guard: SafeLinks-style scanners render this page too,
    // from foreign datacenters — those must not stamp Visitor.
    // Read off the narrowed token here: `parsed` is a let, so inside the
    // callbacks below TypeScript can no longer prove it is the ok variant.
    const prospectEmail = parsed.email
    const tokenChannel = parsed.channel
    const tokenCompanyId = parsed.companyId
    const h = await headers()
    const visitCtx = { country: h.get("x-vercel-ip-country"), userAgent: h.get("user-agent") }
    // Fire-and-forget, both of them: rendering never waits on
    // bookkeeping, and a failed write must not cost the visitor a page.
    void import("@/lib/prospect-ref")
      .then(({ trackProspectLandingVisit }) => trackProspectLandingVisit(prospectEmail, visitCtx))
      .catch(() => {})
    // The same arrival, recorded on the credit rather than on the
    // prospect. Two ledgers because they answer to different funnels:
    // Sales counts people it mailed, Invites counts pros another pro
    // credited, and a visitor can be one without being the other.
    // Before this, only the Sales half was written from here and the
    // Invites funnel's middle step sat at nearly zero.
    void import("@/lib/invites/track-invite-landing")
      .then(({ trackInviteLandingVisit }) => trackInviteLandingVisit(prospectEmail, visitCtx))
      .catch(() => {})
    // And the arrival itself, which is the funnel step. The two ledgers
    // above answer "did this prospect / this credit respond"; this one
    // answers "how many pros reached the claim page, and through which
    // loop" — the same question for all four channels, in one unit.
    void import("@/lib/claim/track-arrival")
      .then(({ trackClaimArrival }) => trackClaimArrival({
        channel: tokenChannel,
        email: prospectEmail,
        companyId: tokenCompanyId,
        ctx: visitCtx,
      }))
      .catch(() => {})

    // /login is a dead redirect to "/" — sign-in lives in the modal,
    // which the login-modal provider auto-opens whenever a redirectTo
    // param is present. So: home + redirectTo = modal open, and after
    // signing in they land on their company dashboard.
    if (parsed.consumed) return invalid(t("used_title"), t("used_body"), { href: "/?redirectTo=/dashboard/company", label: t("used_cta") })

    ctx = await loadClaimContext({
      companyId: parsed.companyId,
      creditId: parsed.creditId,
      email: parsed.email,
    })
    if (!ctx) return invalid(t("invalid_title"), t("invalid_body"))
    if (ctx.company.ownerId) return invalid(t("claimed_title"), t("claimed_body"))
  } else {
    // A pick carried in the querystring (written by the client so a
    // locale switch survives) rehydrates SERVER-side for Arco rows —
    // the page then arrives already on the picked state, no flash of
    // the search screen. Google picks (?p=) resolve client-side; the
    // client shows a loading state for those instead of the search.
    if (pickedCompanyId) {
      const picked = await loadClaimContext({ companyId: pickedCompanyId, creditId: null, email: "" })
      if (picked && !picked.company.ownerId) {
        ctx = { ...picked, company: { ...picked.company, contactLocal: "" } }
      }
    }
    if (!ctx) ctx = await loadPlatformStartContext()

    // The platform route: no token, so no e-mail and no scanner risk —
    // nobody was mailed this link. Counted here rather than beside the
    // token branch because that branch returns early on a broken link,
    // and a broken link is not a platform arrival.
    void import("@/lib/claim/track-arrival")
      .then(({ trackClaimArrival }) => trackClaimArrival({
        channel: "platform",
        companyId: pickedCompanyId ?? null,
      }))
      .catch(() => {})
  }

  // An existing session changes what step 2 asks: someone already signed
  // in publishes as that account (or switches), rather than creating one.
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  let sessionUser: { email: string; name: string; avatarUrl: string | null } | null = null
  if (user?.email) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
    const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
      || meta.full_name || meta.name || user.email
    sessionUser = {
      email: user.email,
      name,
      avatarUrl: profile?.avatar_url ?? meta.avatar_url ?? meta.picture ?? null,
    }
  }

  return (
    <ClaimClient
      token={parsed ? token! : ""}
      email={parsed?.ok ? parsed.email : ""}
      channel={parsed?.ok ? parsed.channel : "platform"}
      sessionUser={sessionUser}
      // The OAuth round trip returns with &step=you so the visitor lands
      // back on the account step instead of restarting at the company
      // review. A fresh signed-in visit without the marker still starts
      // at step 1 — the review is the point of the page.
      initialScreen={parsed && step === "you" ? "you" : "company"}
      ctx={ctx}
      initialPlatformCompanyId={!parsed && pickedCompanyId && ctx.company.id ? ctx.company.id : null}
      initialRestoringPick={Boolean(!parsed && pickedPlaceId)}
    />
  )
}
