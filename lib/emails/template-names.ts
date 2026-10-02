/**
 * What an e-mail template is CALLED, for people.
 *
 * One map, because three surfaces name the same templates: the Sales
 * timeline, the Contact Card's preview popup and the /emails table. It
 * lived inside prospects-client, so anything outside that file either
 * imported a whole admin page to get a label or — more often — made up
 * its own, which is how one mail ends up with two names.
 *
 * NO IMPORTS, deliberately, same rule as lib/sales/prospect-status:
 * this is pulled into client bundles, and dragging a 'use server'
 * module along would break the page that imported it.
 *
 * Some ids here are ABSTRACT queue names (visitor-nudge, owned-welcome,
 * company-live, listed-professionals). They are what the drip queue
 * schedules; the concrete variant is resolved at send. Both are named
 * here because the timeline shows the abstract one while a send is
 * still pending.
 */
// Map template ids → friendly display names (same labels as the
// Marketing table on /admin/emails). Falls back to humanised slug.
const TEMPLATE_NAMES: Record<string, string> = {
  // Showcase (formerly "prospect-") — we built a page + project, recipient claims.
  "prospect-intro": "Showcase Intro",
  "prospect-followup": "Showcase Follow-up",
  "prospect-final": "Showcase Final",
  // Manual sends from the contact-card compose popup.
  "manual-compose": "Personal email",
  // Invite — peer-to-peer from another professional on a real project.
  "new-professional-invite": "Invite Intro",
  "new-professional-followup": "Invite Follow-up",
  "new-professional-final": "Invite Final",
  // Outreach (cold) — formerly run via Apollo, now Arco-controlled.
  "outreach-intro": "Outreach Intro",
  "outreach-followup": "Outreach Follow-up",
  "outreach-final": "Outreach Final",
  // Visitor-nudge — one drip step; the queue row is abstract, the sent
  // variant ids carry the channel.
  "visitor-nudge": "Visitor Nudge",
  "visitor-nudge-invite": "Invite Visitor Nudge",
  "visitor-nudge-showcase": "Showcase Visitor Nudge",
  // Internal id stays '-platform' (historic email_events rows carry
  // it); the audience is outreach prospects — the "platform" was only
  // ever the tokenless landing this variant links to.
  "visitor-nudge-platform": "Outreach Visitor Nudge",
  "verified-reminder": "Verified Reminder",
  "owned-welcome": "Owned Reminder",
  "owned-publisher": "Publisher Reminder",
  "owned-contributor": "Contributor Reminder",
  "owned-invited": "Invited Reminder",
  "company-live": "Company Live",
  "company-live-publisher": "Company Live — Publisher",
  "company-live-contributor": "Company Live — Contributor",
  "listed-professionals": "Listed Professionals",
  "listed-professionals-publisher": "Credit Your Professionals",
  "listed-professionals-contributor": "More Projects On Your Page",
  "listed-backlink": "Listed Backlink",
  // Auth-hook templates — the timeline receives the raw render ids;
  // shown under the same names as the /emails Transactional tab.
  "auth-magic-link": "Sign-in Code",
  "auth-confirm-signup": "Signup Confirmation",
  "auth-recovery": "Password Reset",
  "auth-email-change": "Email Change",
  "auth-invite": "Team Invite",
}
/**
 * The friendly name for a template id.
 *
 * Tries the id as given, then with underscores normalised to dashes —
 * older prospect_events rows stored `prospect_intro` where everything
 * since writes `prospect-intro`, and both name the same mail. That
 * normalisation used to sit at the one call site that knew about it,
 * which meant every other caller silently rendered the raw slug.
 *
 * Falls back to a humanised slug, so an id this map has not caught up
 * with still reads as words rather than as a database value.
 */
export function templateDisplayName(template: string): string {
  if (TEMPLATE_NAMES[template]) return TEMPLATE_NAMES[template]
  const dashed = template.replace(/_/g, "-")
  if (TEMPLATE_NAMES[dashed]) return TEMPLATE_NAMES[dashed]
  return dashed
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
