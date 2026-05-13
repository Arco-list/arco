/**
 * First-touch source categorization.
 *
 * Mirrors the HogQL `sourceCategoryPredicate` used for the per-source
 * channel breakdowns in the Growth Model. Sharing one TS function
 * across the signup capture path, the server backfill script, and any
 * client-side resolution keeps the channel buckets consistent — if we
 * ever add a new category (e.g. "podcast referrer") we change it here
 * and the database CHECK constraint, full stop.
 *
 * Inputs are the three PostHog `$initial_*` person properties stamped
 * at first identify:
 *   - `$initial_referring_domain` — domain of the HTTP referrer on the
 *     first session. NULL / "$direct" for typed URL or bookmark.
 *   - `$initial_current_url` — full URL of the first pageview. Used
 *     for the path-based Sales/Invites distinction since those land
 *     on internal URLs whose referrer doesn't identify the channel.
 *   - `$initial_utm_source` — UTM source parameter on the first
 *     session. `share` → tagged share URL; `arco_*` → Arco email.
 */

export type FirstTouchSource =
  | "sales"
  | "invites"
  | "email"
  | "shares"
  | "google"
  | "social"
  | "referral"
  | "direct"

const SEARCH_DOMAINS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "yahoo.",
  "ecosia.",
  "brave.",
  "qwant.",
  "startpage.",
]

const SOCIAL_DOMAINS = [
  "linkedin.",
  "facebook.",
  "instagram.",
  "twitter.",
  "x.com",
  "pinterest.",
]

const WEBMAIL_DOMAINS = [
  "mail.",
  "outlook.",
]

// Internal hosts whose referrer should not be classified as Referral.
// Mirrors NOT_SELF_REFERRAL in growth-metric-cache.ts.
const INTERNAL_DOMAINS = [
  "arcolist.com",
  "localhost",
  "vercel.app",
  "vercel.com",
  "github.com", // PR / repo navigation, internal team
  "accounts.google.com", // OAuth callback, not Google search
]

function lc(s: string | null | undefined): string {
  return (s ?? "").toLowerCase()
}

function matchesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(n))
}

/**
 * Path-based Sales/Invites detection — the referrer for these
 * channels is internal (the recipient was on arcolist.com after
 * clicking through email), so we discriminate via URL path / query.
 */
function isSalesPath(url: string): boolean {
  // Outreach (Apollo cold): /businesses/architects?ref=
  // Showcase: /businesses/architects?inviteEmail=
  return url.includes("/businesses/architects") && (url.includes("ref=") || url.includes("inviteemail="))
}

function isInvitesPath(url: string): boolean {
  // Project invites land on /businesses/professionals with inviteEmail.
  return url.includes("/businesses/professionals") && url.includes("inviteemail=")
}

/**
 * Categorize a first-touch into one of the 8 channels. Precedence
 * matters: path-based attribution (Sales / Invites / Arco email) wins
 * over referrer-based, since the referrer for those clicks is always
 * arcolist.com (internal) and would otherwise fall through to
 * "direct" or "referral" misleadingly.
 */
export function categorizeFirstTouch(
  referringDomain: string | null | undefined,
  currentUrl: string | null | undefined,
  utmSource: string | null | undefined,
): FirstTouchSource {
  const ref = lc(referringDomain)
  const url = lc(currentUrl)
  const utm = lc(utmSource)

  // Path / UTM wins.
  if (utm === "share") return "shares"
  if (isSalesPath(url) || utm === "arco_sales" || utm === "arco_pro") {
    // arco_pro: Arco transactional emails to pros — bucketed as Email
    // for clients/visitors but as Sales for the pro acquisition funnel?
    // Keep simple: arco_pro = email channel (Arco transactional).
    if (utm === "arco_pro" || utm === "arco_client") return "email"
    return "sales"
  }
  if (isInvitesPath(url)) return "invites"
  if (utm.startsWith("arco_")) return "email"

  // Referrer-based.
  const isDirect = !ref || ref === "$direct"
  if (isDirect) return "direct"

  const isInternal = matchesAny(ref, INTERNAL_DOMAINS)
  if (isInternal) {
    // Self-referral with no path/utm signal — treat as Direct rather
    // than Referral. The first identified session may have lost its
    // original referrer through an OAuth redirect or similar internal
    // hop; Direct is the more honest default.
    return "direct"
  }

  if (matchesAny(ref, SEARCH_DOMAINS)) return "google"
  if (matchesAny(ref, SOCIAL_DOMAINS)) return "social"
  if (matchesAny(ref, WEBMAIL_DOMAINS)) return "email"
  return "referral"
}
