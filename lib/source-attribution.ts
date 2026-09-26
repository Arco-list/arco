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
  | "ai"
  | "paid"
  | "outbound"
  | "lifecycle"
  | "direct"

/**
 * Assistants that answer a question and hand over a link.
 *
 * Carved out of Referral, where they were invisible: in September
 * chatgpt.com was the second-largest external referrer after Google,
 * and it made up the whole Referral channel on its own. Gemini needs
 * naming before the search list, or `google.` claims it and an AI
 * recommendation reads as organic search.
 *
 * A different acquisition motion from a magazine linking to us, and
 * growing — worth its own row rather than a share of somebody else's.
 */
const AI_DOMAINS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
]

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

  // ── Signals the visitor carried with them ──────────────────────
  //
  // Everything in this block beats the referrer, because a tag says
  // what we meant and a referrer only says what the last hop was. The
  // order inside it matters once: a claim path has to win over a
  // template label, since a mail can carry both.

  if (utm === "share") return "shares"

  // Paid has no referrer signature worth trusting — an ad click looks
  // like whatever network served it. It is only ever as reliable as
  // the tagging, which is why the tagging exists before the spend.
  if (utm.startsWith("paid_") || utm === "arco_paid") return "paid"

  // Claim and landing paths first: a token URL names the loop it was
  // minted for, and that outranks whichever template the link sat in.
  if (isSalesPath(url)) return "sales"
  if (isInvitesPath(url)) return "invites"
  if (utm === "arco_claim_invite") return "invites"
  if (utm.startsWith("arco_claim_")) return "sales"

  // Assistants tag their own handovers, so read the utm as well as the
  // referrer: ChatGPT sets utm_source=chatgpt.com, and in roughly half
  // the visits measured the referrer did not survive the hop. This sits
  // above the direct check for that reason — without it those arrivals
  // read as "came on their own".
  if (matchesAny(utm, AI_DOMAINS)) return "ai"

  // Our own mail, labelled by the loop that sent it. One value per
  // label so nothing falls through to a referrer rule — which is what
  // happened to the bare "arco" tag, and why 311 people we had mailed
  // were counted as Direct.
  if (utm === "arco_invite") return "invites"
  if (utm === "arco_sales") return "sales"
  if (utm === "arco_outbound") return "outbound"
  if (utm === "arco_email") return "email"
  if (utm === "arco_lifecycle") return "lifecycle"
  // ── Tags that are already out there ────────────────────────────
  //
  // Mail sent before the relabelling carries the old audience tags, and
  // those links keep getting clicked for months. Without these three the
  // catch-all below would sweep them all into lifecycle, and the Email
  // channel's own history would read as zero from the next sync on.
  //
  //   arco_client  was client lifecycle and marketing — what arco_email
  //                means now, so it maps across.
  //   arco_pro     was pro transactional: out of the acquisition funnel
  //                then and now.
  //   arco         was the 'neutral' tag, used where attribution came
  //                from the URL path instead. When that path fired it
  //                already won above; what is left cannot be resolved to
  //                a loop, and "our mail, no loop" beats the Direct it
  //                used to land in.
  if (utm === "arco_client") return "email"
  if (utm === "arco_pro") return "lifecycle"

  // Any other arco_* is a label nobody set yet. Lifecycle, not email:
  // an unlabelled mail should sit out of the funnel until somebody
  // decides where it belongs, rather than quietly inflating a channel.
  if (utm.startsWith("arco")) return "lifecycle"

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

  // Before SEARCH_DOMAINS: gemini.google.com matches "google." too.
  if (matchesAny(ref, AI_DOMAINS)) return "ai"
  if (matchesAny(ref, SEARCH_DOMAINS)) return "google"
  if (matchesAny(ref, SOCIAL_DOMAINS)) return "social"
  if (matchesAny(ref, WEBMAIL_DOMAINS)) return "email"
  return "referral"
}
