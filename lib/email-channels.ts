/**
 * Which acquisition loop an e-mail belongs to.
 *
 * Lives outside email-service because that file is 'use server', where
 * every export has to be an async function — a lookup table and a
 * string helper cannot live there. Being a plain module also lets the
 * /emails admin page read the same map the tagger uses, so the label
 * shown to a person and the label written into the link can never
 * drift apart.
 *
 * It also carries NO imports. A type-only import of EmailTemplate from
 * email-service would be erased by the compiler, but the bundler still
 * walks the graph, and dragging a 'use server' module into a client
 * bundle breaks the page that imports this one. The map is keyed by
 * string here; email-service asserts it covers every EmailTemplate, so
 * the exhaustiveness check lives on the server side where the type
 * does.
 */
export type EmailChannel = 'invite' | 'sales' | 'outbound' | 'email' | 'lifecycle'

/**
 * Channels that send from the outreach subdomain rather than the root.
 *
 * Sales and invite mail reaches people who never asked for it: cold
 * pitches to architects, and credits claimed on someone else's project.
 * Together that is three quarters of everything the domain sends. The
 * other quarter is sign-in codes, password resets, domain verification
 * and failed-payment notices — mail that MUST arrive, to people who are
 * waiting for it.
 *
 * Sharing one reputation between those two means a complaint wave on
 * the cold half lands on the half that cannot afford it. So the cold
 * half moves out.
 *
 * This is the channel axis, not the voice axis. `founding-*` reads as a
 * personal note from Niek and stays on the root, because it goes to
 * customers; `professional-invite` is impersonal and moves, because it
 * goes to strangers. Who it sounds like and who it is for are different
 * questions.
 */
const OUTREACH_CHANNELS: ReadonlySet<EmailChannel> = new Set<EmailChannel>(['sales', 'invite'])

/** Whether this template sends from the outreach subdomain. Unknown
 *  templates stay on the root: an unlabelled mail is far more likely to
 *  be a new lifecycle notice than a new cold series, and the root is
 *  the safer place to be wrong. */
export function usesOutreachDomain(template: string): boolean {
  const channel = TEMPLATE_CHANNEL[template]
  return channel !== undefined && OUTREACH_CHANNELS.has(channel)
}

/**
 * Mail the recipient asked for seconds earlier, not a touch from us.
 *
 * "When did we last contact them?" is a sales question, and a sign-in
 * code someone requested themselves is not an answer to it: it would
 * put a row at the top of a recency sort because the owner logged in,
 * which tells a rep nothing about whether to call.
 *
 * Deliberately a template list rather than a channel: the channel axis
 * cannot separate these: `auth-magic-link` and `founding-active` are
 * both 'lifecycle', and only one of them is us reaching out.
 *
 * Everything else counts, including lifecycle and transactional mail.
 * That is the whole point of this predicate — `prospects
 * .last_email_sent_at` was only ever written by the drip queue, so a
 * founding-active or a listed-series mail left no trace and the Sales
 * board reported a contact date weeks older than the inbox.
 */
const SELF_TRIGGERED: ReadonlySet<string> = new Set([
  'auth-confirm-signup',
  'auth-magic-link',
  'auth-recovery',
  'auth-email-change',
  'auth-invite',
  'domain-verification',
])

/** Whether this send counts as us having contacted the recipient.
 *  Unknown and missing templates count: an unlabelled send is far more
 *  likely to be a new lifecycle mail than a new auth code, and a
 *  contact date that is slightly too recent costs a wasted glance,
 *  while one that is weeks stale costs a call that should have been
 *  made. (Apollo's synced events carry no template at all.) */
export function countsAsContact(template: string | null | undefined): boolean {
  if (!template) return true
  return !SELF_TRIGGERED.has(template)
}

/** The utm_source a channel writes into every Arco link it tags. */
export function utmSourceFor(channel: EmailChannel | undefined): string {
  // An unlabelled template parks outside the funnel rather than
  // inflating a channel — and never falls back to a bare 'arco', which
  // did not match the `arco_%` rule and so read as Direct.
  return `arco_${channel ?? 'lifecycle'}`
}

export const TEMPLATE_CHANNEL: Record<string, EmailChannel> = {
  // Sales — path-based attribution via apollo_visitors / showcase_visitors
  'prospect-intro': 'sales',
  'prospect-followup': 'sales',
  'prospect-final': 'sales',
  'outreach-intro': 'sales',
  'outreach-followup': 'sales',
  'outreach-final': 'sales',
  // Visitor-nudge — one drip step, three channel variants resolved at
  // send (lib/visitor-nudge.ts). Path-based attribution like the rest
  // of the claim family.
  'visitor-nudge-invite': 'invite',
  'visitor-nudge-showcase': 'sales',
  // The platform variant of the visitor nudge. Sales, not Email: its
  // two siblings are Invite and Sales, it goes to an audience of pros,
  // and 'email' would drop a pro's click into the CLIENT Email channel
  // — pro traffic on the client row, which is the thing this whole
  // model was rebuilt to stop.
  'visitor-nudge-platform': 'sales',
  // Verified-reminder — cart-abandonment mail, +1 day after step 1
  // without a commit. One template for every channel: the argument is
  // "one step left", not the channel's asset.
  'verified-reminder': 'lifecycle',
  // Invites — path-based attribution via invite_visitors
  'new-professional-invite': 'invite',
  'new-professional-followup': 'invite',
  'new-professional-final': 'invite',
  'professional-invite': 'invite',
  // Pro transactional
  'project-live': 'lifecycle',
  'project-rejected': 'lifecycle',
  'team-invite': 'lifecycle',
  'domain-verification': 'lifecycle',
  // Owned reminder — one drip step, sent only when the claim did NOT
  // convert to Listed; variant resolved at send (lib/owned-welcome.ts):
  // publisher (publish your first project), contributor (get credited
  // by a pro), invited (accept the waiting credit).
  'owned-publisher': 'lifecycle',
  'owned-contributor': 'lifecycle',
  'owned-invited': 'lifecycle',
  // Listed series — company live (replaces the first project-live),
  // the credits/network mail, and the backlink ask. Variants resolved
  // at send (lib/listed-mails.ts).
  'company-live-publisher': 'lifecycle',
  'company-live-contributor': 'lifecycle',
  'listed-professionals-publisher': 'lifecycle',
  'listed-professionals-contributor': 'lifecycle',
  'listed-backlink': 'lifecycle',
  // Subscription — sent to companies that pay (or had it free), so the
  // same bucket as the rest of the pro transactional mail. A click here
  // is a paying customer coming back to the product.
  'payment-failed': 'lifecycle',
  'subscription-ended-nonpayment': 'lifecycle',
  'payment-method-expiring': 'lifecycle',
  'renewal-reminder': 'lifecycle',
  'founding-active': 'lifecycle',
  'founding-ending': 'lifecycle',
  // Client transactional / marketing
  'welcome-homeowner': 'email',
  'discover-projects': 'email',
  'find-professionals': 'email',
  'introduction-request': 'email',
  // Auth — could be either user type; stays neutral
  'auth-confirm-signup': 'lifecycle',
  'auth-magic-link': 'lifecycle',
  'auth-recovery': 'lifecycle',
  'auth-email-change': 'lifecycle',
  'auth-invite': 'lifecycle',
}

/**
 * The same tagging, for mail that is plain text.
 *
 * A hand-written mail from the contact card goes out through Gmail as
 * a text body, so tagArcoEmailLinks — which looks for href=" — never
 * touches it. Every Arco link an admin pasted therefore arrived
 * untagged, and the click read as Direct: the one channel that is
 * supposed to mean "came on their own".
 *
 * That is why sending THROUGH the product is the boundary for Outbound
 * rather than sending by hand. A mail from a personal mailbox cannot
 * carry this, and nothing downstream can tell it apart from someone
 * typing the address.
 *
 * Skips URLs that already carry a utm, same as the HTML version, so a
 * claim link pasted into the draft keeps the loop it was minted for.
 */
export function tagArcoTextLinks(text: string, utmSource: string): string {
  return text.replace(/https?:\/\/[^\s<>"')\]]*arcolist\.com[^\s<>"')\]]*/g, (rawUrl) => {
    try {
      const u = new URL(rawUrl)
      if (u.searchParams.has("utm_source")) return rawUrl
      u.searchParams.set("utm_source", utmSource)
      u.searchParams.set("utm_medium", "email")
      u.searchParams.set("utm_campaign", "manual-compose")
      return u.toString()
    } catch {
      return rawUrl
    }
  })
}
