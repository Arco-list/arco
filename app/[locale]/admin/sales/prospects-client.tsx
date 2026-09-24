"use client"

import { Fragment, useEffect, useRef, useState, useTransition, useCallback } from "react"
import { ArrowUpRight } from "lucide-react"
import { toast } from "sonner"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { EmailComposeModal } from "@/components/contact-card/email-compose-modal"
import { AdminTabs, useAdminTab } from "@/components/admin/admin-tabs"
import {
  markProspectNotInterested,
  fetchSalesCompanies,
  skipCallListProspect,
  startProspectSequence,
  pauseProspectSequence,
  removeProspectFromFunnel,
  syncApolloNow,
  syncResendEmailStats,
  type ProspectEvent,
  type ProspectStatus,
  type SalesCompanyRow,
  type SalesContact,
  type SalesFunnel,
  type SalesSortBy,
  type SalesSortDir,
  type SequenceStatus,
  type SequenceFilterValue,
} from "./actions"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { clickedRateColor, deliveredRateColor, openedRateColor } from "@/lib/email-rate-colors"
import { LogOutboundModal } from "./log-outbound-modal"
import { ContactCard } from "@/components/contact-card/contact-card"
import { useContactParam } from "@/hooks/use-contact-param"

// Primary-outline action pill — shared by the row "Log" button, the
// call-list "Skip" button and the panel's Activity "Log" (kept in sync
// manually there). Deliberately quiet: outline + primary text.
const ACTION_PILL_CLASS =
  "shrink-0 rounded-[12px] border border-[#016D75] text-[#016D75] text-[10px] font-medium px-2 py-[2px] leading-normal cursor-pointer hover:bg-[#f0f7f6] transition-colors"

// -- Status config -----------------------------------------------------------

export const STATUS_CONFIG: Record<ProspectStatus, { label: string; cls: string; dot: string }> = {
  prospect: { label: "Prospect", cls: "bg-amber-50 text-amber-700", dot: "bg-[#f59e0b]" },
  contacted: { label: "Contacted", cls: "bg-amber-50 text-amber-700", dot: "bg-[#f59e0b]" },
  visitor: { label: "Visitor", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  verified: { label: "Verified", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  owned: { label: "Owned", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  // Mirror of companies 'unlisted' — claimed, page currently hidden.
  unlisted: { label: "Unlisted", cls: "bg-gray-50 text-gray-600", dot: "bg-[#a1a1a0]" },
  active: { label: "Listed", cls: "bg-purple-50 text-purple-800 font-semibold", dot: "bg-[#7c3aed]" },
  // Removed never renders in the funnel — the row hides any contact with this
  // status, and the company row drops entirely if every contact is removed.
  // Kept here so per-contact rendering doesn't crash if a stray row slips in.
  removed: { label: "Removed", cls: "bg-gray-50 text-gray-500", dot: "bg-[#a1a1a0]" },
}

// Statuses surfaced in the multi-select status filter. 'removed' is a soft-
// delete marker — admin doesn't filter for it, the row is just hidden.
const ALL_STATUSES: ProspectStatus[] = [
  "prospect", "contacted", "visitor", "verified", "owned", "unlisted", "active",
]

export const SEQUENCE_CONFIG: Record<SequenceStatus, { label: string; dot: string }> = {
  not_started: { label: "Not started", dot: "bg-[#a1a1a0]" },
  active: { label: "Active", dot: "bg-[#2563eb]" },
  paused: { label: "Paused", dot: "bg-amber-400" },
  finished: { label: "Finished", dot: "bg-emerald-500" },
  // Derived state: the contact wrote back and nothing is queued anymore —
  // the machine is done here, a human owns the thread.
  replied: { label: "Replied", dot: "bg-emerald-500" },
}

// Sequence-filter dropdown options. Real sequence_status values plus
// the three suppression states that override the row's Sequence
// display (all three render with a red dot).
const SEQUENCE_FILTER_OPTIONS: { value: SequenceFilterValue; label: string; dot: string }[] = [
  { value: "not_started", label: "Not started", dot: "bg-[#a1a1a0]" },
  { value: "active", label: "Active", dot: "bg-[#2563eb]" },
  { value: "paused", label: "Paused", dot: "bg-amber-400" },
  { value: "finished", label: "Finished", dot: "bg-emerald-500" },
  { value: "bounced", label: "Bounced", dot: "bg-red-500" },
  { value: "complained", label: "Complained", dot: "bg-red-500" },
  { value: "unsubscribed", label: "Unsubscribed", dot: "bg-red-500" },
  { value: "not_interested", label: "Not interested", dot: "bg-red-500" },
]
const SEQUENCE_FILTER_LABEL: Record<SequenceFilterValue, { label: string; dot: string }> = Object.fromEntries(
  SEQUENCE_FILTER_OPTIONS.map((o) => [o.value, { label: o.label, dot: o.dot }]),
) as Record<SequenceFilterValue, { label: string; dot: string }>

// Channel-filter dropdown options. DB still stores the historical source
// codes; sourceLabel renders them post-Apollo-cutover names.
// "outbound" and "email" are synthetic channels: neither corresponds to
// a prospects.source value.
//   - outbound → any manual outbound touch logged (call/meeting/manual
//     email/linkedin, incl. no-answer attempts). Read off
//     rows.lastOutboundAt.
//   - email → an inbound reply has landed (inbound_emails linked to any
//     of the row's prospects). Outgoing sends alone don't flip this —
//     the pill signals "they replied", not "we sent". Read off
//     rows.hasEmailActivity.
const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: "arco", label: "Showcase" },
  { value: "invites", label: "Invite" },
  { value: "apollo", label: "Outreach" },
  { value: "outbound", label: "Outbound" },
  { value: "email", label: "Email" },
]

// Recipient-suppression states from the Resend webhook + List-Unsubscribe.
// All three terminate the sequence — surfaced as a red override in the
// row's Sequence column. Priority complained > bounced > unsubscribed
// (most reputation-damaging first); only one ever renders. Cancellation
// reasons echoing these states are suppressed in the per-email step list
// (the override is enough; we don't need to repeat "bounced" on every
// cancelled row).
const SUPPRESSED_CANCEL_REASONS = new Set(["bounced", "complained", "unsubscribed"])
function getSuppressionState(contact: { bouncedAt: string | null; complainedAt: string | null; unsubscribedAt: string | null; notInterestedAt?: string | null }):
  { label: "Bounced" | "Complained" | "Unsubscribed" | "Not interested"; dot: string } | null {
  if (contact.complainedAt) return { label: "Complained", dot: "bg-red-500" }
  if (contact.bouncedAt) return { label: "Bounced", dot: "bg-red-500" }
  if (contact.unsubscribedAt) return { label: "Unsubscribed", dot: "bg-red-500" }
  // Polite decline — sequence over, retouch with care.
  if (contact.notInterestedAt) return { label: "Not interested", dot: "bg-red-500" }
  return null
}

// Funnel stages aligned with Growth lifecycle model. 'subscribed' is
// counted from subscriptions rather than from a prospect status —
// there is no such status, which is why this stage read zero for as
// long as it existed. 'unlisted' is NOT a chain stage: it renders as a
// parked card under Listed, same as /companies.
const FUNNEL_STAGES: { status: ProspectStatus | "subscribed"; label: string; driver: "prospect" | "acquisition" | "retention" | "monetization" }[] = [
  { status: "prospect", label: "Prospect", driver: "prospect" },
  { status: "contacted", label: "Contacted", driver: "prospect" },
  { status: "visitor", label: "Visitor", driver: "acquisition" },
  // The remodeled ladder: Verified (identity proven + company step
  // confirmed) before Owned (account attached at the commit). Signup
  // is an event (signed_up_at), not a stage.
  { status: "verified", label: "Verified", driver: "acquisition" },
  { status: "owned", label: "Owned", driver: "acquisition" },
  { status: "active", label: "Listed", driver: "retention" },
  { status: "subscribed", label: "Subscribed", driver: "monetization" },
]

// First card where each driver label should appear
const DRIVER_LABEL_AT: Record<string, string> = {
  prospect: "prospect",
  acquisition: "visitor",
  retention: "active",
  monetization: "subscribed",
}

const DRIVER_COLORS: Record<string, string> = {
  prospect: "#f59e0b",
  acquisition: "#2563eb",
  retention: "#7c3aed",
  // Same green as the dashboard's monetization driver.
  monetization: "#0f766e",
}

// Source labels shown in the multi-pill cell. The DB still stores the
// historical source codes ('arco' | 'invites' | 'apollo') — this map
// renders them as their post-Apollo-cutover names: Showcase (we built a
// page + project), Invite (peer-to-peer from another professional), and
// Outreach (cold outbound, formerly run from Apollo).
const SOURCE_LABELS: Record<string, string> = {
  arco: "Showcase",
  invites: "Invite",
  apollo: "Outreach",
  manual: "Manual",
  outbound: "Outbound",
  email: "Email",
}
const sourceLabel = (s: string): string => SOURCE_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1)

// -- Helpers -----------------------------------------------------------------

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    })
  } catch { return dateStr }
}

export function formatDateShort(dateStr: string | null) {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const timePart = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    return `${datePart} · ${timePart}`
  } catch { return dateStr }
}

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
export function templateDisplayName(template: string): string {
  if (TEMPLATE_NAMES[template]) return TEMPLATE_NAMES[template]
  return template
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Derive the campaign channel label ("Showcase" / "Outreach" /
 *  "Invite") from an email template id. Used to append a channel pill
 *  to automated email rows in the Activity feed so the rep sees which
 *  sequence a given send belongs to at a glance. Apollo-legacy step
 *  ids (apollo-step-*) roll up to Outreach. Returns null for anything
 *  unclassified. */
function templateChannelLabel(template: string | null | undefined): string | null {
  if (!template) return null
  if (template.startsWith("prospect-")) return "Showcase"
  if (template.startsWith("new-professional-")) return "Invite"
  if (template.startsWith("outreach-")) return "Outreach"
  if (template.startsWith("apollo-")) return "Outreach"
  return null
}

/** Coalesce every campaign hint on an event's metadata down to a
 *  single label. Reads (in priority order):
 *    - metadata.template     — set on email_sent / email_resent
 *    - metadata.template_set — set on sequence_enroled + friends
 *    - metadata.source       — "Apollo" (rolls up to Outreach)
 *  Returns null when none of the three yields a match. */
function eventCampaignLabel(event: ProspectEvent): string | null {
  const template = typeof event.metadata?.template === "string"
    ? (event.metadata.template as string).replace(/_/g, "-")
    : null
  const fromTemplate = templateChannelLabel(template)
  if (fromTemplate) return fromTemplate

  const set = typeof event.metadata?.template_set === "string"
    ? (event.metadata.template_set as string).toLowerCase()
    : null
  if (set === "outreach") return "Outreach"
  if (set === "showcase" || set === "prospect") return "Showcase"
  if (set === "invite" || set === "new-professional") return "Invite"

  const source = typeof event.metadata?.source === "string"
    ? (event.metadata.source as string).toLowerCase()
    : null
  if (source === "apollo") return "Outreach"

  return null
}

function conversionRate(from: number, to: number): string {
  if (from === 0) return "0%"
  return `${Math.round((to / from) * 100)}%`
}

const EVENT_LABELS: Record<string, string> = {
  status_changed: "Status changed",
  email_sent: "Email sent",
  email_resent: "Email resent",
  "email.received": "Email received",
  admin_replied: "Email replied",
  sequence_started: "Sequence started",
  sequence_enroled: "Sequence enrolled",
  sequence_paused: "Sequence paused",
  sequence_resumed: "Sequence resumed",
  sequence_finished: "Sequence finished",
  removed_from_funnel: "Removed from funnel",
  unsubscribed: "Unsubscribed",
  bounced: "Email bounced",
  complained: "Marked as spam",
  company_invited: "Company invited",
  "prospect.landing_visited": "Visited landing page",
  "prospect.signed_up": "Signed Up",
  "prospect.signup_started": "Signup Started",
  "prospect.company_created": "Company Created",
  "prospect.listed": "Company Listed",
  "company.draft": "Company Created",
  "company.signup": "Company Signup",
  "company.listed": "Company Listed",
  "company.unlisted": "Company Unlisted",
  "company.deactivated": "Company Deactivated",
  "user.signed_up": "User signed up",
}

function formatEventLabel(type: string, metadata?: Record<string, unknown> | null): string {
  // Sequence lifecycle events (enrolled / started / paused / resumed /
  // finished) get their campaign prefixed when metadata.template_set is
  // present — "Outreach sequence enrolled" reads more usefully than
  // the bare "Sequence enrolled" the previous fallback produced.
  if (type.startsWith("sequence_")) {
    const set = typeof metadata?.template_set === "string"
      ? (metadata.template_set as string).toLowerCase()
      : null
    const campaign =
      set === "outreach" ? "Outreach"
      : set === "showcase" || set === "prospect" ? "Showcase"
      : set === "invite" || set === "new-professional" ? "Invite"
      : null
    const base = EVENT_LABELS[type] ?? type.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    if (campaign) {
      // "Sequence enrolled" → "Outreach sequence enrolled"
      const rest = base.replace(/^Sequence /, "sequence ")
      return `${campaign} ${rest}`
    }
    return base
  }
  // Email send events get specialised when metadata.template is present:
  // "Showcase Intro sent" / "Outreach Follow-up resent" reads better
  // than the generic "Email sent" / "Email resent".
  if (type === "email_sent" || type === "email_resent") {
    const rawTemplate = typeof metadata?.template === "string" ? metadata.template : null
    if (rawTemplate) {
      const friendly =
        TEMPLATE_NAMES[rawTemplate]
        ?? TEMPLATE_NAMES[rawTemplate.replace(/_/g, "-")]
        ?? templateDisplayName(rawTemplate.replace(/_/g, "-"))
      return `${friendly} ${type === "email_resent" ? "resent" : "sent"}`
    }
  }
  // Surface the differentiating bit of metadata inline so the row tells
  // the whole story without an expansion drawer.
  if (type === "removed_from_funnel") {
    const prev = typeof metadata?.previous_status === "string" ? metadata.previous_status : null
    return prev ? `Removed from funnel · was ${prev}` : "Removed from funnel"
  }
  if (EVENT_LABELS[type]) return EVENT_LABELS[type]
  if (type.startsWith("status_changed_to_")) {
    const to = type.slice("status_changed_to_".length).replace(/_/g, " ")
    return `Status → ${to}`
  }
  return type
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// -- Event history row -------------------------------------------------------

const MANUAL_OUTCOME_LABEL: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  no_answer: "No answer",
}

const MANUAL_OUTCOME_DOT: Record<string, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-[#a1a1a0]",
  negative: "bg-red-500",
  no_answer: "bg-amber-400",
}

/** Trailing channel pill for the row — Email / Call / Meeting / LinkedIn
 *  / Note. Null for system events (status changes, landing visits,
 *  sequence lifecycle, etc.) so those rows don't get a pill. */
function eventChannelLabel(eventType: string): string | null {
  if (eventType.startsWith("manual.")) {
    const kind = eventType.slice("manual.".length)
    if (kind === "call") return "Call"
    if (kind === "meeting") return "Meeting"
    if (kind === "email") return "Email"
    if (kind === "linkedin") return "LinkedIn"
    if (kind === "note") return "Note"
    return null
  }
  if (
    eventType === "email.received"
    || eventType === "email_sent"
    || eventType === "email_resent"
    || eventType === "replied"
    || eventType === "admin_replied"
    || eventType === "bounced"
    || eventType === "unsubscribed"
    || eventType === "complained"
  ) {
    return "Email"
  }
  return null
}

/** ▶ chevron shown before the row label; rotates 90° when the row is
 *  expanded. Absolutely positioned so it hangs to the left of the label
 *  column *without* nudging the label's start position — that way
 *  Activity names line up exactly with Lifecycle labels + Outreach
 *  template names one section up. Hidden entirely (not just invisible)
 *  when the row isn't expandable. */
function ExpandChevron({ visible, open }: { visible: boolean; open: boolean }) {
  if (!visible) return null
  return (
    <span
      aria-hidden="true"
      className={`text-[#a1a1a0] transition-transform inline-block absolute ${open ? "rotate-90" : ""}`}
      style={{ left: -12, top: 3, fontSize: 10, lineHeight: 1, width: 8 }}
    >
      ▶
    </span>
  )
}

export function EventHistoryRow({
  event,
  onEditManualLog,
  onDeleteManualLog,
  compact = false,
}: {
  event: ProspectEvent
  /** When provided AND the row is a manual outbound log, an actions
   *  kebab (⋯) appears on the right with Edit / Delete items. */
  onEditManualLog?: (logId: string) => void
  onDeleteManualLog?: (logId: string) => void
  /** Card-view opt-in. Hides:
   *  * the channel pill (Outreach / Showcase / Invite) at the end
   *    of every row — redundant on the ContactCard where Channel is
   *    already surfaced in the Activity section.
   *  * the subject / snippet preview on admin_replied and
   *    email.received rows — the panel is scoped to one contact so
   *    "Re: Een podium…" doesn't add signal.
   *  Also drops the date from text-xs (12px) down to 11px to match
   *  the Activity "Status" label typography on the same panel.
   *
   *  Off by default so the /admin/sales popup renders unchanged. */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const isManual = event.event_type.startsWith("manual.")
  const isInboundEmail = event.event_type === "email.received"
  // Only company_invited carries auto-event data that's worth expanding
  // (project + inviter links). All other auto-events fold their
  // differentiating bits into the label via formatEventLabel. Inbound
  // emails render via their own branch below.
  const isCompanyInvited = event.event_type === "company_invited"
  const manualBody = isManual
    ? typeof event.metadata?.body === "string" && event.metadata.body.trim()
      ? (event.metadata.body as string)
      : null
    : null
  const expandable =
    (isCompanyInvited && Object.keys(event.metadata ?? {}).length > 0) || Boolean(manualBody)

  const dateStyle = compact ? { fontSize: 11 } : undefined
  const channel = eventChannelLabel(event.event_type)
  const channelPill = channel && !compact ? (
    <span className="status-pill shrink-0">{channel}</span>
  ) : null

  // "Email replied" (admin_replied) — expandable to show the reply body
  // hydrated from inbound_emails.replied_text via ContactDetailBody.
  if (event.event_type === "admin_replied") {
    const replyText = typeof event.metadata?.replied_text === "string"
      ? (event.metadata.replied_text as string).trim() || null
      : null
    const originalSubject = typeof event.metadata?.original_subject === "string"
      ? (event.metadata.original_subject as string)
      : null
    const canExpand = Boolean(replyText)
    return (
      <div className="text-xs">
        <button
          type="button"
          onClick={() => canExpand && setOpen((v) => !v)}
          className={`w-full grid items-baseline gap-2 text-left ${canExpand ? "cursor-pointer hover:text-[#1c1c1a]" : "cursor-default"}`}
          style={{ gridTemplateColumns: "90px 1fr" }}
          disabled={!canExpand}
        >
          <span className="text-[#a1a1a0] whitespace-nowrap" style={dateStyle}>{formatDateShort(event.created_at)}</span>
          <span className="text-[#1c1c1a] inline-flex items-center gap-2 min-w-0 w-full relative">
            <ExpandChevron visible={canExpand} open={open} />
            <span>Email replied</span>
            {originalSubject && !compact && (
              <span className="text-[#6b6b68] truncate" title={originalSubject}>· Re: {originalSubject}</span>
            )}
            {channelPill}
          </span>
        </button>
        {open && replyText && (
          <p className="mt-1 pl-[98px] text-[#6b6b68] whitespace-pre-wrap">{replyText}</p>
        )}
      </div>
    )
  }

  if (isInboundEmail) {
    const subject = typeof event.metadata?.subject === "string" ? (event.metadata.subject as string) : null
    const snippet = typeof event.metadata?.snippet === "string" ? (event.metadata.snippet as string) : null
    const bodyText = typeof event.metadata?.body_text === "string" ? (event.metadata.body_text as string) : null
    const preview = bodyText?.trim() || snippet?.trim() || null
    const canExpand = Boolean(preview)
    return (
      <div className="text-xs">
        <button
          type="button"
          onClick={() => canExpand && setOpen((v) => !v)}
          className={`w-full grid items-baseline gap-2 text-left ${canExpand ? "cursor-pointer hover:text-[#1c1c1a]" : "cursor-default"}`}
          style={{ gridTemplateColumns: "90px 1fr" }}
          disabled={!canExpand}
        >
          <span className="text-[#a1a1a0] whitespace-nowrap" style={dateStyle}>{formatDateShort(event.created_at)}</span>
          <span className="text-[#1c1c1a] inline-flex items-center gap-2 min-w-0 w-full relative">
            <ExpandChevron visible={canExpand} open={open} />
            <span>Email received</span>
            {subject && !compact && <span className="text-[#6b6b68] truncate" title={subject}>· {subject}</span>}
            {channelPill}
          </span>
        </button>
        {open && preview && (
          <p className="mt-1 pl-[98px] text-[#6b6b68] whitespace-pre-wrap">{preview}</p>
        )}
      </div>
    )
  }

  if (isManual) {
    const kind = event.event_type.slice("manual.".length)
    const outcome = typeof event.metadata?.outcome === "string" ? (event.metadata.outcome as string) : null
    const author = typeof event.metadata?.author === "string" ? (event.metadata.author as string) : null
    const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1)
    const logId = typeof event.metadata?.log_id === "string" ? (event.metadata.log_id as string) : null
    const canEditOrDelete = Boolean(logId && (onEditManualLog || onDeleteManualLog))

    return (
      <div className="text-xs group relative">
        <button
          type="button"
          onClick={() => expandable && setOpen((v) => !v)}
          className={`w-full grid items-baseline gap-2 text-left relative ${expandable ? "cursor-pointer hover:text-[#1c1c1a]" : "cursor-default"}`}
          style={{ gridTemplateColumns: "90px 1fr" }}
          disabled={!expandable}
        >
          <span className="text-[#a1a1a0] whitespace-nowrap" style={dateStyle}>{formatDateShort(event.created_at)}</span>
          <span className="text-[#1c1c1a] inline-flex items-center gap-2 min-w-0 w-full relative">
            <ExpandChevron visible={expandable} open={open} />
            <span>{kindLabel}</span>
            {outcome && MANUAL_OUTCOME_LABEL[outcome] && (
              <span className="inline-flex items-center gap-1 text-[#6b6b68]">
                <span className={`h-1.5 w-1.5 rounded-full ${MANUAL_OUTCOME_DOT[outcome] ?? "bg-[#a1a1a0]"}`} />
                {MANUAL_OUTCOME_LABEL[outcome]}
              </span>
            )}
            {author && <span className="text-[#a1a1a0] truncate">· {author}</span>}
            {channelPill}
            {canEditOrDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="ml-1 shrink-0 h-5 w-5 flex items-center justify-center rounded text-[#a1a1a0] hover:text-[#1c1c1a] hover:bg-[#f5f5f4] transition-colors"
                    aria-label="Log actions"
                  >
                    ⋯
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[120px] z-[600]"
                >
                  {/* z-[600] overrides the shadcn z-50 default so this
                      menu paints above the contact detail popup
                      (.popup-overlay uses z-500 in globals.css). Without
                      it, opening Edit/Delete near the bottom of the
                      Activity list rendered the menu behind the popup
                      card and got visually clipped. */}
                  {onEditManualLog && logId && (
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditManualLog(logId)
                      }}
                    >
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onDeleteManualLog && logId && (
                    <DropdownMenuItem
                      className="text-xs cursor-pointer text-red-600 focus:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteManualLog(logId)
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </span>
        </button>
        {open && manualBody && (
          <p className="mt-1 pl-[98px] text-[#6b6b68] whitespace-pre-wrap">{manualBody}</p>
        )}
      </div>
    )
  }

  // Campaign pill (Showcase / Outreach / Invite) derived from every
  // hint on the event's metadata — template, template_set, source.
  // When present, it *replaces* the generic Email channel pill so the
  // row surfaces only the more specific label. Inbound emails
  // (email.received) are handled by their own branch above and keep
  // the plain Email pill.
  const campaignLabel = eventCampaignLabel(event)
  const campaignPill = campaignLabel && !compact ? (
    <span className="status-pill shrink-0">{campaignLabel}</span>
  ) : null
  const trailingPill = campaignPill ?? channelPill

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className={`w-full grid items-baseline gap-2 text-left py-0.5 ${expandable ? "cursor-pointer hover:text-[#1c1c1a]" : "cursor-default"}`}
        style={{ gridTemplateColumns: "90px 1fr" }}
        disabled={!expandable}
      >
        <span className="text-[#a1a1a0] whitespace-nowrap" style={dateStyle}>{formatDateShort(event.created_at)}</span>
        <span className="text-[#1c1c1a] inline-flex items-center gap-2 min-w-0 w-full">
          <ExpandChevron visible={expandable} open={open} />
          <span className="truncate">{formatEventLabel(event.event_type, event.metadata as Record<string, unknown> | null)}</span>
          {trailingPill}
        </span>
      </button>
      {open && expandable && isCompanyInvited && <CompanyInvitedDetails metadata={event.metadata} />}
    </div>
  )
}

function CompanyInvitedDetails({ metadata }: { metadata: Record<string, unknown> }) {
  const project = metadata.project as
    | { slug: string | null; title: string | null }
    | null
  const inviter = metadata.inviter as
    | { slug: string | null; name: string | null }
    | null
  return (
    <div className="mt-1 ml-4 flex flex-col gap-0.5 pb-1">
      {project && (
        <div className="flex items-baseline gap-2">
          <span className="text-[#a1a1a0] w-24 shrink-0">Invited on</span>
          {project.slug ? (
            <a
              href={`/projects/${project.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#016D75] hover:underline break-all"
            >
              {project.title || "Untitled project"}
            </a>
          ) : (
            <span className="text-[#6b6b68] break-all">{project.title || "Untitled project"}</span>
          )}
        </div>
      )}
      {inviter && (
        <div className="flex items-baseline gap-2">
          <span className="text-[#a1a1a0] w-24 shrink-0">Invited by</span>
          {inviter.slug ? (
            <a
              href={`/professionals/${inviter.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#016D75] hover:underline break-all"
            >
              {inviter.name}
            </a>
          ) : (
            <span className="text-[#6b6b68] break-all">{inviter.name}</span>
          )}
        </div>
      )}
    </div>
  )
}

/** "4m ago" / "2h ago" / "3d ago" for the Apollo badge — same buckets as
 *  the Inbox mailbox badge. */
function formatRelativeSync(ts: string): string {
  try {
    const ms = Date.now() - new Date(ts).getTime()
    if (ms < 60_000) return "just now"
    const m = Math.floor(ms / 60_000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}d ago`
    return formatDateShort(ts)
  } catch {
    return ts
  }
}

// -- Component ---------------------------------------------------------------

type Props = {
  initialCompanies: SalesCompanyRow[]
  initialTotalCompanies: number
  initialFunnel: SalesFunnel
  initialEmailsSent: number
  currentApolloListId?: string | null
  apolloProspectsCount?: number
  /** Apollo connection badge (Inbox pattern) — key presence + newest
   *  apollo_sync_runs row. Clicking the badge opens the import popup. */
  apolloSyncStatus?: { connected: boolean; lastSyncAt: string | null; hadError: boolean } | null
}

export function ProspectsClient({
  initialCompanies,
  initialTotalCompanies,
  initialFunnel,
  initialEmailsSent,
  currentApolloListId = null,
  apolloProspectsCount = 0,
  apolloSyncStatus = null,
}: Props) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [totalCompanies, setTotalCompanies] = useState(initialTotalCompanies)
  const [funnel, setFunnel] = useState(initialFunnel)
  const [totalEmailsSent, setTotalEmailsSent] = useState(initialEmailsSent)
  const [statusFilter, setStatusFilter] = useState<ProspectStatus[]>([])
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [sequenceFilter, setSequenceFilter] = useState<SequenceFilterValue[]>([])
  // Toggle for the Call list button: when true, the table only renders
  // today's ranked call queue (max 10, tier order).
  const [callListOnly, setCallListOnly] = useState(false)
  // All / Call list as URL-backed tabs (?tab=calls) — the bar tab is the
  // source of truth; the effect below keeps callListOnly in step so tab
  // clicks, back/forward and deep links all apply the filter.
  const barTab = useAdminTab(["all", "calls"] as const)
  // Log outbound modal target — opened from the black "Log" pill on a
  // contact row. The panel has its own instance; this one serves the
  // table without opening the panel first.
  // Companies-style row menu, opened AT the click position via a
  // zero-size fixed anchor. Only rows with a companies record get it;
  // company-less prospect rows keep opening the contact panel.
  const [rowMenu, setRowMenu] = useState<{ row: SalesCompanyRow; x: number; y: number } | null>(null)
  // Contact menu actions that live at table level: compose opens the
  // shared modal; the two funnel exits confirm, apply and reload.
  const [emailTarget, setEmailTarget] = useState<SalesContact | null>(null)
  const handleNotInterested = async (contact: SalesContact) => {
    const r = await markProspectNotInterested(contact.prospectId, true)
    if (r.success) { toast.success("Marked as not interested"); reload({ offset, append: false }) }
    else toast.error(r.error ?? "Failed")
  }
  const handleRemoveFromFunnel = async (contact: SalesContact) => {
    if (!confirm(`Remove ${contact.contactName ?? contact.email} from the funnel?`)) return
    const r = await removeProspectFromFunnel(contact.prospectId)
    if (r.success) { toast.success("Removed from funnel"); reload({ offset, append: false }) }
    else toast.error(r.error ?? "Failed")
  }
  const [logOutboundTarget, setLogOutboundTarget] = useState<{
    prospectId: string
    contactLabel: string
    companyLabel: string
    contactEmail: string | null
    contactPhone: string | null
    contactAvatarUrl: string | null
  } | null>(null)
  // Multi-select row state — mirrors the /admin/companies pattern. Keyed
  // on row.rowId; bulk actions iterate the underlying contacts of every
  // selected row. Cleared on successful bulk action or filter change.
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [search, setSearch] = useState("")
  const [showStatusGuide, setShowStatusGuide] = useState(false)
  const [showApolloSync, setShowApolloSync] = useState(false)
  // Apollo status pill — compact dot+time design shared with the Inbox
  // and Growth pills; click runs the activity sync on demand.
  const [apolloIsSyncing, setApolloIsSyncing] = useState(false)
  const [apolloLastSyncAt, setApolloLastSyncAt] = useState<string | null>(apolloSyncStatus?.lastSyncAt ?? null)
  const [apolloSyncErrored, setApolloSyncErrored] = useState(Boolean(apolloSyncStatus?.hadError))

  const handleApolloSyncNow = async () => {
    if (apolloIsSyncing) return
    setApolloIsSyncing(true)
    const result = await syncApolloNow()
    setApolloIsSyncing(false)
    setApolloLastSyncAt(new Date().toISOString())
    if (result.success) {
      setApolloSyncErrored(false)
      toast.success(result.updated > 0 ? `Apollo synced — ${result.updated} prospects updated` : "Apollo synced — no changes")
    } else {
      setApolloSyncErrored(true)
      toast.error(result.error ?? "Apollo sync failed")
    }
  }
  const [syncListId, setSyncListId] = useState("")
  const [editingListId, setEditingListId] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(initialTotalCompanies > 50)
  const [isPending, startTransition] = useTransition()
  // last_contacted_at desc is the primary sales workflow — admins want to
  // see who they last touched first. Created sort exists for cohort
  // analysis ("everyone added this week").
  const [sortBy, setSortBy] = useState<SalesSortBy>("last_contacted_at")
  const [sortDir, setSortDir] = useState<SalesSortDir>("desc")

  const reload = useCallback((opts?: { offset?: number; append?: boolean }) => {
    const off = opts?.offset ?? 0
    startTransition(async () => {
      const result = await fetchSalesCompanies({
        statuses: statusFilter,
        sources: sourceFilter,
        sequences: sequenceFilter,
        search,
        callListOnly,
        offset: off,
        limit: 50,
        sortBy,
        sortDir,
      })
      if (opts?.append) {
        setCompanies((prev) => [...prev, ...result.companies])
        // Email totals are summed across the loaded page, so when paginating
        // we accumulate; resetting on a fresh load would clobber prior pages.
        setTotalEmailsSent((prev) => prev + result.companies.reduce((s, c) => s + c.emailsSent, 0))
      } else {
        setCompanies(result.companies)
        setTotalEmailsSent(result.companies.reduce((s, c) => s + c.emailsSent, 0))
      }
      setTotalCompanies(result.totalCompanies)
      setFunnel(result.funnel)
      setOffset(off)
      setHasMore(result.totalCompanies > off + result.companies.length)
    })
  }, [statusFilter, sourceFilter, sequenceFilter, search, callListOnly, sortBy, sortDir])

  // Resend email backfill — pulls open/click events the webhook may have
  // missed. Cheap (throttled to once/hour server-side); refresh the table
  // afterwards so newly-credited engagements show up.
  const syncedRef = useRef(false)
  useEffect(() => {
    if (syncedRef.current) return
    syncedRef.current = true
    syncResendEmailStats().then(({ synced }) => {
      if (synced > 0) reload()
    })
  }, [reload])

  const handleFilterChange = useCallback((opts: {
    statuses?: ProspectStatus[]
    sources?: string[]
    sequences?: SequenceFilterValue[]
    callListOnly?: boolean
  }) => {
    if (opts.statuses !== undefined) setStatusFilter(opts.statuses)
    if (opts.sources !== undefined) setSourceFilter(opts.sources)
    if (opts.sequences !== undefined) setSequenceFilter(opts.sequences)
    if (opts.callListOnly !== undefined) setCallListOnly(opts.callListOnly)
    const s = opts.statuses ?? statusFilter
    const src = opts.sources ?? sourceFilter
    const seq = opts.sequences ?? sequenceFilter
    const due = opts.callListOnly ?? callListOnly
    startTransition(async () => {
      const result = await fetchSalesCompanies({
        statuses: s, sources: src, sequences: seq, search,
        callListOnly: due,
        offset: 0, limit: 50, sortBy, sortDir,
      })
      setCompanies(result.companies)
      setTotalCompanies(result.totalCompanies)
      setFunnel(result.funnel)
      setTotalEmailsSent(result.companies.reduce((sum, c) => sum + c.emailsSent, 0))
      setOffset(0)
      setHasMore(result.totalCompanies > result.companies.length)
      // Any narrowing invalidates the current selection — otherwise a
      // hidden selected row would still be picked up by bulk actions.
      setSelectedRowIds(new Set())
    })
  }, [statusFilter, sourceFilter, sequenceFilter, search, callListOnly, sortBy, sortDir])

  useEffect(() => {
    const wantCalls = barTab === "calls"
    if (wantCalls !== callListOnly) handleFilterChange({ callListOnly: wantCalls })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the tab
    // drives this; the other deps would re-fire it on unrelated fetches.
  }, [barTab])

  const toggleStatus = useCallback((status: ProspectStatus) => {
    const next = statusFilter.includes(status)
      ? statusFilter.filter((s) => s !== status)
      : [...statusFilter, status]
    handleFilterChange({ statuses: next })
  }, [statusFilter, handleFilterChange])

  const toggleSource = useCallback((src: string) => {
    const next = sourceFilter.includes(src)
      ? sourceFilter.filter((s) => s !== src)
      : [...sourceFilter, src]
    handleFilterChange({ sources: next })
  }, [sourceFilter, handleFilterChange])

  const toggleSequence = useCallback((seq: SequenceFilterValue) => {
    const next = sequenceFilter.includes(seq)
      ? sequenceFilter.filter((s) => s !== seq)
      : [...sequenceFilter, seq]
    handleFilterChange({ sequences: next })
  }, [sequenceFilter, handleFilterChange])

  const handleSearch = useCallback(() => {
    reload({ offset: 0 })
  }, [reload])

  // Live search: debounce typed input and re-fetch automatically — matches
  // the admin/companies search-as-you-type behaviour. Skip on first render.
  const firstSearchRender = useRef(true)
  useEffect(() => {
    if (firstSearchRender.current) { firstSearchRender.current = false; return }
    const t = setTimeout(() => reload({ offset: 0 }), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const handleLoadMore = useCallback(() => {
    reload({ offset: offset + 50, append: true })
  }, [reload, offset])

  const toggleSort = useCallback((field: SalesSortBy) => {
    // Default first-click direction is "desc" for date columns (most recent
    // first) — except next_scheduled_at, where the natural reading is
    // "soonest pending send first" (asc).
    const defaultDir: SalesSortDir = field === "next_scheduled_at" ? "asc" : "desc"
    const nextDir: SalesSortDir = sortBy === field ? (sortDir === "desc" ? "asc" : "desc") : defaultDir
    setSortBy(field)
    setSortDir(nextDir)
    startTransition(async () => {
      const result = await fetchSalesCompanies({
        statuses: statusFilter, sources: sourceFilter, sequences: sequenceFilter, search,
        offset: 0, limit: 50, sortBy: field, sortDir: nextDir,
      })
      setCompanies(result.companies)
      setTotalCompanies(result.totalCompanies)
      setFunnel(result.funnel)
      setTotalEmailsSent(result.companies.reduce((sum, c) => sum + c.emailsSent, 0))
      setOffset(0)
      setHasMore(result.totalCompanies > result.companies.length)
    })
  }, [sortBy, sortDir, statusFilter, sourceFilter, sequenceFilter, search])

  // Shared Contact Card mount. URL-driven so the panel is deep-linkable
  // and survives navigation. Every contact click (row, contact inline,
  // +N-more item) routes here — the old center-modal is gone.
  const contactParam = useContactParam()
  // Contact row → panel. If the contact has an email, key on email;
  // otherwise fall back to prospect_id so the panel still opens (rep
  // fills in the email in place, then the panel flips to the email
  // key via onEmailAssigned below).
  const openContactCard = useCallback((contact: SalesContact) => {
    const email = contact.email?.trim()
    if (email) contactParam.open(email)
    else contactParam.openProspect(contact.prospectId)
  }, [contactParam])

  const handleSyncList = async () => {
    if (!syncListId.trim()) return
    setIsSyncing(true)
    setSyncResult(null)
    try {
      // Large lists span multiple invocations: the route stops before the
      // 300s function ceiling and returns nextPage; keep calling until
      // the list is exhausted, accumulating the running total.
      let total = 0
      let startPage: number | null = 1
      while (startPage) {
        const res: Response = await fetch("/api/apollo-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync_list", list_id: syncListId.trim(), start_page: startPage }),
        })
        const data = await res.json()
        if (!res.ok) {
          setSyncResult(`Error: ${data.error}`)
          return
        }
        total += data.synced ?? 0
        startPage = data.nextPage ?? null
        setSyncResult(`Imported ${total} contacts${startPage ? "… continuing" : ""}`)
      }
      reload({ offset: 0 })
    } catch {
      setSyncResult("Failed to import contacts")
    } finally {
      setIsSyncing(false)
    }
  }

  // ── Multi-select helpers ───────────────────────────────────────────────
  const allVisibleSelected = companies.length > 0 && companies.every((r) => selectedRowIds.has(r.rowId))
  const someVisibleSelected = companies.some((r) => selectedRowIds.has(r.rowId))

  const toggleAllVisible = useCallback((value: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (value) companies.forEach((r) => next.add(r.rowId))
      else companies.forEach((r) => next.delete(r.rowId))
      return next
    })
  }, [companies])

  const toggleRow = useCallback((rowId: string, value: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (value) next.add(rowId)
      else next.delete(rowId)
      return next
    })
  }, [])

  // Fan out a per-prospect action across every contact of every selected
  // row. Reports the count that succeeded so the toast is honest even if
  // half of them are already in the target state (e.g. paused).
  const runBulkContactAction = useCallback(
    async (
      actionLabel: string,
      fn: (prospectId: string) => Promise<{ success: boolean; error?: string }>,
    ) => {
      const selectedRows = companies.filter((r) => selectedRowIds.has(r.rowId))
      if (selectedRows.length === 0) return
      setIsBulkProcessing(true)
      let success = 0
      let failure = 0
      for (const row of selectedRows) {
        for (const contact of row.contacts) {
          const result = await fn(contact.prospectId)
          if (result.success) success++
          else failure++
        }
      }
      if (success > 0) toast.success(`${actionLabel} — ${success} ${success === 1 ? "contact" : "contacts"}`)
      if (failure > 0 && success === 0) toast.error(`${actionLabel} failed`)
      setSelectedRowIds(new Set())
      setIsBulkProcessing(false)
      reload({ offset, append: false })
    },
    [companies, selectedRowIds, reload, offset],
  )

  return (
    <>
      {/* Sticky toolbar — no tabs on Sales; search left, filters +
          Apollo status pills right. Scrolls horizontally on mobile. */}
      <AdminTabs
        title="Sales"
        tabs={[
          { key: "all", label: "All" },
          { key: "calls", label: "Call list" },
        ]}
        active={barTab}
        actions={
          <>
          <div className="relative shrink-0" style={{ width: 240 }}>
            <input
              type="text"
              placeholder="Search company or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-8 text-xs border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
            />
            <svg className="absolute left-2.5 top-2.5 text-[#a1a1a0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-[3px] text-[#a1a1a0] hover:text-[#1c1c1a] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          {/* Multi-select status filter — empty selection = all statuses. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`w-[140px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${
                  statusFilter.length > 0
                    ? "border-[#1c1c1a] bg-[#fafaf9]"
                    : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {statusFilter.length === 0 ? (
                    <span className="text-[#6b6b68]">All statuses</span>
                  ) : statusFilter.length === 1 ? (
                    <>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[statusFilter[0]].dot}`} />
                      <span className="truncate">{STATUS_CONFIG[statusFilter[0]].label}</span>
                    </>
                  ) : (
                    <span>{statusFilter.length} statuses</span>
                  )}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px] z-[120]">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  if (statusFilter.length > 0) handleFilterChange({ statuses: [] })
                }}
                className="text-xs"
              >
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {ALL_STATUSES.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={statusFilter.includes(s)}
                  onCheckedChange={() => toggleStatus(s)}
                  onSelect={(e) => e.preventDefault()}
                  className="text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[s].dot}`} />
                    {STATUS_CONFIG[s].label}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Multi-select sequence filter — empty selection = all sequences. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`w-[140px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${
                  sequenceFilter.length > 0
                    ? "border-[#1c1c1a] bg-[#fafaf9]"
                    : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {sequenceFilter.length === 0 ? (
                    <span className="text-[#6b6b68]">All sequences</span>
                  ) : sequenceFilter.length === 1 ? (
                    <>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${SEQUENCE_FILTER_LABEL[sequenceFilter[0]].dot}`} />
                      <span className="truncate">{SEQUENCE_FILTER_LABEL[sequenceFilter[0]].label}</span>
                    </>
                  ) : (
                    <span>{sequenceFilter.length} sequences</span>
                  )}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[200px]">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  if (sequenceFilter.length > 0) handleFilterChange({ sequences: [] })
                }}
                className="text-xs"
              >
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {SEQUENCE_FILTER_OPTIONS.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.value}
                  checked={sequenceFilter.includes(o.value)}
                  onCheckedChange={() => toggleSequence(o.value)}
                  onSelect={(e) => e.preventDefault()}
                  className="text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${o.dot}`} />
                    {o.label}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Multi-select channel filter — empty selection = all channels. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`w-[140px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${
                  sourceFilter.length > 0
                    ? "border-[#1c1c1a] bg-[#fafaf9]"
                    : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {sourceFilter.length === 0 ? (
                    <span className="text-[#6b6b68]">All channels</span>
                  ) : sourceFilter.length === 1 ? (
                    <span className="truncate">{sourceLabel(sourceFilter[0])}</span>
                  ) : (
                    <span>{sourceFilter.length} channels</span>
                  )}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px] z-[120]">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  if (sourceFilter.length > 0) handleFilterChange({ sources: [] })
                }}
                className="text-xs"
              >
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {CHANNEL_OPTIONS.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.value}
                  checked={sourceFilter.includes(o.value)}
                  onCheckedChange={() => toggleSource(o.value)}
                  onSelect={(e) => e.preventDefault()}
                  className="text-xs"
                >
                  {o.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          </>
        }
      />

      {/* Status pills + guide — float in the gap under the sticky bar
          (tour-replay position). The Apollo pills moved out of the bar
          so the bar holds only search + filters; the filter dropdowns
          no longer disappear when Apollo is disconnected. */}
      <div className="wrap" style={{ position: "relative", height: 0 }}>
        <div className="absolute right-5 md:right-[60px] flex items-center gap-2" style={{ top: 12 }}>
          {apolloSyncStatus?.connected ? (
            <>
              <button
                type="button"
                onClick={() => void handleApolloSyncNow()}
                disabled={apolloIsSyncing}
                className="status-pill"
                title={apolloIsSyncing ? "Syncing…" : "Sync Apollo activity now"}
                style={{
                  background: "none",
                  cursor: apolloIsSyncing ? "default" : "pointer",
                  borderColor: apolloSyncErrored ? "#fecaca" : "#bbf7d0",
                  color: apolloSyncErrored ? "#b91c1c" : "#166534",
                  opacity: apolloIsSyncing ? 0.6 : 1,
                }}
              >
                <span className={`status-pill-dot ${apolloSyncErrored ? "bg-red-500" : "bg-emerald-500"}`} />
                {apolloIsSyncing ? "syncing…" : apolloLastSyncAt ? formatRelativeSync(apolloLastSyncAt) : "never synced"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSyncListId(currentApolloListId ?? "")
                  setShowApolloSync(true)
                }}
                className="status-pill"
                title="Import contacts from Apollo"
                style={{ background: "none", cursor: "pointer" }}
              >
                {apolloProspectsCount} contacts
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSyncListId(currentApolloListId ?? "")
                setShowApolloSync(true)
              }}
              className="status-pill"
              title="Import contacts from Apollo"
              style={{ background: "none", cursor: "pointer", borderColor: "#e5e5e4", color: "#6b6b68" }}
            >
              <span className="status-pill-dot bg-[#a1a1a0]" />
              Not connected
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowStatusGuide(true)}
            className="arco-text-link arco-text-link--primary"
            style={{ fontSize: 12 }}
          >
            Status guide
          </button>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 52, paddingBottom: 48 }}>

      {/* Conversion funnel — counts unique companies per stage. */}
      <div className="mb-8 -mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        {(() => {
          const cols = FUNNEL_STAGES.map((_, i) => i === 0 ? "auto" : "1fr auto").join(" ")
          const stageKeys = FUNNEL_STAGES.map((s) => s.status)
          // Parked Unlisted rows count as "in or past" every stage up to
          // and including Owned (they claimed — they left the track just
          // before Listed), so the chain rates stay honest.
          const unlistedCount = (funnel as any).unlisted ?? 0
          const ownedIdx = stageKeys.indexOf("owned")
          const listedIdx = stageKeys.indexOf("active")
          const cohorted = stageKeys.map((key, i) =>
            stageKeys.slice(i).reduce((sum, k) => sum + ((funnel as any)[k] ?? 0), 0)
            + (i <= ownedIdx ? unlistedCount : 0)
          )

          return (
            <div style={{ display: "grid", gridTemplateColumns: cols, gridTemplateRows: "auto auto", gap: 0, alignItems: "start" }}>
              {FUNNEL_STAGES.map((stage, i) => {
                const count = (funnel as any)[stage.status] ?? 0
                const prevCohort = i > 0 ? cohorted[i - 1] : funnel.total
                const thisCohort = cohorted[i]
                const rate = i === 0 ? "" : conversionRate(prevCohort, thisCohort)
                // Cumulative conversion from the connector's left stage all
                // the way to Listed — rendered under the line, below the
                // single-stage rate. One decimal below 10% (6/1000 would
                // otherwise round to a misleading 1%). Skipped on the final
                // connector, where it would duplicate the stage rate.
                const listedCohort = cohorted[listedIdx]
                const listedPct = prevCohort > 0 ? (listedCohort / prevCohort) * 100 : 0
                const toListed =
                  i > 0 && i < listedIdx && listedCohort > 0 && prevCohort > 0
                    ? `${listedPct < 10 ? listedPct.toFixed(1) : Math.round(listedPct)}%`
                    : ""
                const color = DRIVER_COLORS[stage.driver]
                const driverLabel = Object.entries(DRIVER_LABEL_AT).find(([, s]) => s === stage.status)?.[0]
                return (
                  <Fragment key={stage.status}>
                    {i > 0 && (
                      <div className="relative px-1 self-center" style={{ minWidth: 32 }}>
                        <div className="w-full border-t border-[#d4d4d3]" />
                        {rate && (
                          <span className="absolute text-[10px] font-medium text-[#6b6b68]" style={{ top: -16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>{rate}</span>
                        )}
                        {toListed && (
                          // Just "→ X%" in Listed's purple — the colour IS
                          // the label (matches the Listed dot), and the
                          // title spells it out for anyone who needs it.
                          <span className="absolute text-[10px] font-medium" style={{ top: 4, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", color: "#7c3aed" }} title="Cumulative conversion to Listed from the stage on the left">
                            {"→ "}{toListed}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col">
                      {driverLabel ? (
                        <p className="arco-eyebrow mb-2" style={{ color: DRIVER_COLORS[driverLabel] }}>{driverLabel.charAt(0).toUpperCase() + driverLabel.slice(1)}</p>
                      ) : (
                        <div style={{ height: 24 }} />
                      )}
                      <button
                        onClick={stage.status === "subscribed" ? undefined : () => toggleStatus(stage.status as ProspectStatus)}
                        disabled={stage.status === "subscribed"}
                        className={`rounded-[3px] border bg-white px-3 py-3 transition-colors ${stage.status === "subscribed" ? "cursor-default opacity-60" : "hover:border-[#c4c4c2]"} ${statusFilter.includes(stage.status as ProspectStatus) ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
                        style={{ width: 132 }}
                      >
                        <div className="flex items-center gap-[6px] mb-1.5">
                          <span className="status-pill-dot shrink-0" style={{ background: color }} />
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 400, color: "var(--text-primary)" }}>{stage.label}</span>
                        </div>
                        <p className="arco-card-title text-left">{count}</p>
                      </button>
                    </div>
                  </Fragment>
                )
              })}
              {/* Parked end-state (row 2): Unlisted under Listed — a
                  park/off-ramp, not a step, so no connector. Mirrors the
                  /companies funnel. Card column = 2·listedIdx+1. */}
              <div style={{ gridRow: 2, gridColumn: 2 * listedIdx + 1, display: "flex", flexDirection: "column" }}>
                <div style={{ height: 6 }} />
                <button
                  type="button"
                  onClick={() => toggleStatus("unlisted")}
                  className={`rounded-[3px] border bg-white px-3 py-1.5 transition-colors hover:border-[#c4c4c2] flex items-center gap-[6px] ${statusFilter.includes("unlisted") ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
                  style={{ width: 132 }}
                >
                  <span className="status-pill-dot shrink-0" style={{ background: "#a1a1a0" }} />
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 400, color: "var(--text-primary)", whiteSpace: "nowrap" }}>Unlisted</span>
                  <span className="text-xs ml-auto" style={{ color: "var(--text-primary)" }}>{unlistedCount}</span>
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Bulk actions bar — mirrors /admin/companies. Appears when any
          row is selected; iterates every contact of every selected row
          for prospect-level actions (Pause / Remove). */}
      {selectedRowIds.size > 0 && (() => {
        const selectedCount = selectedRowIds.size
        const selectedContacts = companies
          .filter((r) => selectedRowIds.has(r.rowId))
          .reduce((n, r) => n + r.contacts.length, 0)
        return (
          <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-[#f5f5f4] rounded-[3px] border border-[#e5e5e4]">
            <span className="text-xs text-[#6b6b68]">
              {selectedCount} {selectedCount === 1 ? "company" : "companies"} selected
              {selectedContacts !== selectedCount && ` · ${selectedContacts} contacts`}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                disabled={isBulkProcessing}
                onClick={async () => {
                  // Only kick off contacts whose sequence is currently
                  // `not_started` — starting an active/paused/finished
                  // contact would either re-fire the intro or throw. Skip
                  // silently for those; the toast reports only the count
                  // we actually started.
                  const eligible = companies
                    .filter((r) => selectedRowIds.has(r.rowId))
                    .flatMap((r) => r.contacts)
                    .filter((c) => c.sequenceStatus === "not_started")
                  if (eligible.length === 0) {
                    toast.info("No eligible contacts — sequences already started or finished")
                    return
                  }
                  setIsBulkProcessing(true)
                  let success = 0
                  let failure = 0
                  for (const c of eligible) {
                    const r = await startProspectSequence(c.prospectId)
                    if (r.success) success++
                    else failure++
                  }
                  if (success > 0) toast.success(`Sequence started — ${success} ${success === 1 ? "contact" : "contacts"}`)
                  if (failure > 0 && success === 0) toast.error("Failed to start sequence")
                  setSelectedRowIds(new Set())
                  setIsBulkProcessing(false)
                  reload({ offset, append: false })
                }}
              >
                Start sequence
              </button>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                disabled={isBulkProcessing}
                onClick={() => runBulkContactAction("Sequence paused", pauseProspectSequence)}
              >
                Pause sequence
              </button>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors"
                disabled={isBulkProcessing}
                onClick={() => runBulkContactAction("Removed from funnel", removeProspectFromFunnel)}
              >
                Remove
              </button>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                disabled={isBulkProcessing}
                onClick={() => setSelectedRowIds(new Set())}
              >
                Clear
              </button>
            </div>
            {isBulkProcessing && <span className="text-xs text-[#a1a1a0]">Processing…</span>}
          </div>
        )
      })()}

      {/* Companies table — one row per company, contacts column expands inline. */}
      {/* Count — directly above the table, margins as on Users */}
      <div className="discover-results-meta" style={{ marginBottom: 0 }}>
        <p className="discover-results-count">
          <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{companies.length}</strong> of {totalCompanies} companies
        </p>
      </div>

      <div className="arco-table-wrap" style={{ marginTop: 16 }}>
        <table className="arco-table" style={{ minWidth: 1200 }}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAllVisible(!!v)}
                  aria-label="Select all"
                  className="h-3.5 w-3.5"
                />
              </th>
              <th>Company</th>
              {callListOnly && <th>Reason</th>}
              <th>Contacts</th>
              <th>Status</th>
              <th>Sequence</th>
              <th>Channel</th>
              <th style={{ textAlign: "center" }}>Sent</th>
              <th style={{ textAlign: "center" }}>Delivered</th>
              <th style={{ textAlign: "center" }}>Opened</th>
              <th style={{ textAlign: "center" }}>Clicked</th>
              <th
                style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("created_at")}
                title="Sort by created"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Created
                  {sortBy === "created_at" && (
                    <span className="text-[10px] text-[#a1a1a0]">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </span>
              </th>
              <th
                style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("last_contacted_at")}
                title="Sort by last email sent"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Last email
                  {sortBy === "last_contacted_at" && (
                    <span className="text-[10px] text-[#a1a1a0]">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </span>
              </th>
              <th
                style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("next_scheduled_at")}
                title="Sort by next email scheduled"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Next email
                  {sortBy === "next_scheduled_at" && (
                    <span className="text-[10px] text-[#a1a1a0]">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </span>
              </th>
              <th
                style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("last_outbound_at")}
                title="Sort by last manual outbound touch"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Last outbound
                  {sortBy === "last_outbound_at" && (
                    <span className="text-[10px] text-[#a1a1a0]">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr>
                <td colSpan={callListOnly ? 15 : 14} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  No companies found.
                </td>
              </tr>
            )}
            {companies.map((row) => (
              <CompanyRowView
                key={row.rowId}
                row={row}
                selected={selectedRowIds.has(row.rowId)}
                onToggleSelect={(v) => toggleRow(row.rowId, v)}
                onOpenContactCard={openContactCard}
                onLogOutbound={(contact) =>
                  setLogOutboundTarget({
                    prospectId: contact.prospectId,
                    contactLabel: contact.resolvedContact.name?.trim() || contact.email || "Unnamed contact",
                    companyLabel: row.companyName,
                    contactEmail: contact.resolvedContact.email ?? contact.email ?? null,
                    contactPhone: row.claimedCompany?.phone ?? null,
                    contactAvatarUrl: contact.resolvedContact.avatarUrl ?? null,
                  })
                }
                showCallColumn={callListOnly}
                onOpenRowMenu={(e) => setRowMenu({ row, x: e.clientX, y: e.clientY })}
                onSendEmail={(c) => setEmailTarget(c)}
                onNotInterested={handleNotInterested}
                onRemoveFromFunnel={handleRemoveFromFunnel}
                onRenamed={() => reload({ offset, append: false })}
                onSkip={async () => {
                  const r = await skipCallListProspect(row.primaryContact.prospectId)
                  if (r.success) {
                    toast.success("Skipped — resurfaces as a follow-up in a week")
                    reload({ offset: 0 })
                  } else {
                    toast.error(r.error)
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating row menu — mirrors /admin/companies: view / copy
          link / edit / promote, conditional on what the row's company
          actually supports. */}
      {(() => {
        const claimed = rowMenu?.row.claimedCompany ?? null
        const canShowcase = Boolean(rowMenu?.row.companyId && claimed && !claimed.ownerUserId && claimed.status === "added")
        return (
          <DropdownMenu open={Boolean(rowMenu)} onOpenChange={(open) => { if (!open) setRowMenu(null) }}>
            <DropdownMenuTrigger asChild>
              <span aria-hidden style={{ position: "fixed", left: rowMenu?.x ?? 0, top: rowMenu?.y ?? 0, width: 0, height: 0 }} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {claimed?.slug && (
                <DropdownMenuItem asChild>
                  <a href={`/professionals/${claimed.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                    View company
                  </a>
                </DropdownMenuItem>
              )}
              {claimed?.slug && (
                <DropdownMenuItem
                  className="text-xs cursor-pointer"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/professionals/${claimed.slug}`)
                    toast.success("Company link copied")
                  }}
                >
                  Copy company link
                </DropdownMenuItem>
              )}
              {rowMenu?.row.companyId && (
                <DropdownMenuItem asChild>
                  <a href={`/dashboard/company?company_id=${rowMenu.row.companyId}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                    Edit company
                  </a>
                </DropdownMenuItem>
              )}
              {canShowcase && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a
                      href={`/api/admin/promote-showcase?company_id=${rowMenu!.row.companyId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs cursor-pointer"
                      onClick={() => toast.success("Showcase actief — bedrijfspagina geopend in nieuw tabblad")}
                    >
                      Promote to showcase
                    </a>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })()}

      {emailTarget && (
        <EmailComposeModal
          email={emailTarget.email}
          emails={[emailTarget.email]}
          contactLabel={emailTarget.resolvedContact.name?.trim() || emailTarget.contactName || emailTarget.email}
          prospectId={emailTarget.prospectId}
          onClose={() => setEmailTarget(null)}
          onSent={() => { setEmailTarget(null); reload({ offset, append: false }) }}
        />
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="h-9 px-6 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {/* Status Guide Popup */}
      {showStatusGuide && (
        <div className="popup-overlay" onClick={() => setShowStatusGuide(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Sales statuses</h3>
              <button type="button" className="popup-close" onClick={() => setShowStatusGuide(false)} aria-label="Close">✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { dot: "bg-[#7c3aed]", label: "Listed", desc: "Owns a Listed company — fully converted.", specs: "Live on platform · Conversion complete" },
                { dot: "bg-[#2563eb]", label: "Owned", desc: "Company claimed by an Arco account (step 2 of the claim funnel) — not listed yet.", specs: "Owner attached · Profile setup" },
                { dot: "bg-[#2563eb]", label: "Verified", desc: "Identity proven (invite delivery or domain code) and company details confirmed on step 1 — the claim is not completed yet.", specs: "Step 1 done · No owner yet" },
                { dot: "bg-[#2563eb]", label: "Visitor", desc: "Clicked the link in a claim e-mail and opened the funnel.", specs: "Email engagement · No account yet" },
                { dot: "bg-[#f59e0b]", label: "Contacted", desc: "At least one intro email has been sent. Advances automatically on send.", specs: "Intro sent · Drip sequence active" },
                { dot: "bg-[#f59e0b]", label: "Prospect", desc: "In the sales funnel — Showcase, Invite, or Outreach contact with no email sent yet.", specs: "In sales funnel · Awaiting first email" },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", gap: 12 }}>
                  <span className={`${s.dot} shrink-0`} style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 5 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#1c1c1a" }}>{s.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b6b68", lineHeight: 1.4 }}>{s.desc}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#a1a1a0", lineHeight: 1.3 }}>{s.specs}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, padding: "12px 16px", background: "#f5f5f4", borderRadius: 4, fontSize: 11, color: "#6b6b68", lineHeight: 1.5 }}>
              <strong>Flow:</strong> Prospect → Contacted → Visitor → Verified → Owned → Listed
              <br />
              <strong>Signup</strong> is an event, not a stage: it stamps the account facts (signed_up_at) and can happen at any point — an existing Arco user claims without one.
              <br />
              <strong>Aggregation:</strong> Each row shows the highest stage any contact at the company has reached. Channel column shows every distinct entry point (Showcase, Invite, Outreach).
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowStatusGuide(false)}
                className="h-9 px-4 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import contacts popup. Imports a Apollo list of contacts into
          prospects + auto-enrols them on the Outreach drip. List ID is
          stored on each row so we can re-import a list later. */}
      {showApolloSync && (
        <div className="popup-overlay" onClick={() => setShowApolloSync(false)}>
          <div className="popup-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3 className="arco-section-title">Import contacts</h3>
              <button type="button" className="popup-close" onClick={() => setShowApolloSync(false)} aria-label="Close">✕</button>
            </div>

            <p style={{ margin: "0 0 12px", fontSize: 11, color: "#a1a1a0", lineHeight: 1.5 }}>
              Pulls contacts from an Apollo list into prospects and auto-enrols them on the Outreach sequence. Find the list ID in Apollo → Lists → click a list → the ID is in the URL.
            </p>

            <label className="text-xs font-medium text-[#6b6b68] block mb-1">List ID</label>
            {editingListId || !currentApolloListId ? (
              <input
                type="text"
                value={syncListId}
                onChange={(e) => setSyncListId(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
                placeholder={currentApolloListId ?? "e.g. 6501a2b3c4d5e6f7..."}
                autoFocus={editingListId}
              />
            ) : (
              <div className="flex items-center justify-between gap-2 h-9 px-3 border border-[#e5e5e4] rounded-[3px] bg-[#fafaf9]">
                <code className="text-xs text-[#1c1c1a] truncate">{currentApolloListId}</code>
                <button
                  type="button"
                  onClick={() => {
                    setSyncListId(currentApolloListId ?? "")
                    setEditingListId(true)
                  }}
                  className="text-xs font-medium text-[#016D75] hover:underline shrink-0"
                >
                  Change
                </button>
              </div>
            )}

            <p style={{ margin: "10px 0 12px", fontSize: 11, color: "#6b6b68" }}>
              {apolloProspectsCount} contact{apolloProspectsCount === 1 ? "" : "s"} imported so far.
            </p>

            {syncResult && (
              <p className={`text-xs mb-3 ${syncResult.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                {syncResult}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowApolloSync(false)}
                className="h-9 px-4 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleSyncList}
                disabled={isSyncing || !syncListId.trim()}
                className="h-9 px-4 text-xs font-medium rounded-[3px] text-white transition-colors disabled:opacity-50"
                style={{ background: "var(--primary, #016D75)" }}
              >
                {isSyncing ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 1 shared Contact Card — mounted at page level so the
          URL param drives visibility. Row click opens; timeline modal
          (line 1588) is still reachable via the +N-more menu. */}
      {/* Log outbound modal — opened from the black "Log" pill on rows */}
      {logOutboundTarget && (
        <LogOutboundModal
          open
          onOpenChange={(open) => { if (!open) setLogOutboundTarget(null) }}
          prospectId={logOutboundTarget.prospectId}
          contactLabel={logOutboundTarget.contactLabel}
          companyLabel={logOutboundTarget.companyLabel}
          contactEmail={logOutboundTarget.contactEmail}
          contactPhone={logOutboundTarget.contactPhone}
          contactAvatarUrl={logOutboundTarget.contactAvatarUrl}
          initialValues={null}
          onLogged={() => {
            setLogOutboundTarget(null)
            reload({ offset })
          }}
        />
      )}

      <ContactCard
        email={contactParam.email}
        prospectId={contactParam.prospectId}
        onEmailAssigned={(next) => contactParam.open(next)}
        onRemoved={() => {
          contactParam.close()
          reload({ offset })
        }}
        onChanged={() => reload({ offset })}
        onClose={contactParam.close}
      />

      </div>
    </>
  )
}

// -- Sub-components ----------------------------------------------------------

/**
 * One row of the Sales table = one company.
 *
 * Contacts column mirrors the Projects column on /admin/companies:
 * the primary contact is rendered inline with `dot + name + status pill +
 * sequence pill`; clicking it (or the row) opens the shared Contact
 * Card panel. Companies with multiple contacts get a "+N more" link
 * that lists the remaining contacts — each opens its own panel. The
 * row never expands inline.
 */
function CompanyRowView({
  row,
  selected,
  onToggleSelect,
  onOpenContactCard,
  onLogOutbound,
  onSkip,
  showCallColumn,
  onOpenRowMenu,
  onSendEmail,
  onNotInterested,
  onRemoveFromFunnel,
  onRenamed,
}: {
  row: SalesCompanyRow
  selected: boolean
  onToggleSelect: (value: boolean) => void
  /** Shared Contact Card slide-over — email-keyed (prospect-keyed
   *  fallback for empty-email rows). Row click opens the primary
   *  contact; contact / +N-more clicks open that specific contact. */
  onOpenContactCard: (contact: SalesContact) => void
  /** Black "Log" pill next to the contact name — opens the Log
   *  outbound modal without opening the panel first. */
  onLogOutbound: (contact: SalesContact) => void
  /** Call-list mode only: snooze this row out of today's queue. */
  onSkip: () => void
  /** True while the Call list toggle is active — renders the Reason column. */
  showCallColumn: boolean
  /** Row click for rows WITH a companies record: the companies-style
   *  dropdown at the click position. Company-less rows fall back to
   *  the contact panel. */
  onOpenRowMenu: (e: React.MouseEvent) => void
  onSendEmail: (contact: SalesContact) => void
  onNotInterested: (contact: SalesContact) => void
  onRemoveFromFunnel: (contact: SalesContact) => void
  /** After an inline company rename — parent refetches the table. */
  onRenamed: () => void
}) {
  const claimed = row.claimedCompany
  // Inline rename, companies-table style: name click edits, blur/Enter
  // saves straight to companies.name.
  const [editingName, setEditingName] = useState<string | null>(null)
  const companyInitials = (row.companyName ?? "")
    .split(" ")
    .filter(Boolean)
    .map((t) => t[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "?"

  const subtitle = [claimed?.primaryService, claimed?.city ?? row.city].filter(Boolean).join(" · ")

  // External-website link for the arrow icon next to the name. Claimed
  // companies use their own website/domain; prospect-only rows fall back
  // to the Apollo-sourced website on any of the row's contacts.
  const externalSiteRaw =
    claimed?.website ??
    claimed?.domain ??
    row.contacts.find((c) => c.website)?.website ??
    null
  const externalHref = externalSiteRaw
    ? /^https?:\/\//i.test(externalSiteRaw) ? externalSiteRaw : `https://${externalSiteRaw}`
    : null

  // Email rate display — clamp delivered up so we never show delivered <
  // opened (Resend webhook latency between event types). Cap at sent so
  // duplicate webhook events can't push the rate past 100%.
  const ratePct = row.emailsSent > 0 ? {
    delivered: Math.round(
      Math.min(Math.max(row.emailsDelivered, row.emailsOpened, row.emailsClicked), row.emailsSent) /
        row.emailsSent * 100,
    ),
    opened: Math.round(Math.min(row.emailsOpened, row.emailsSent) / row.emailsSent * 100),
    clicked: Math.round(Math.min(row.emailsClicked, row.emailsSent) / row.emailsSent * 100),
  } : null

  const statusCfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.prospect
  const sequenceCfg = SEQUENCE_CONFIG[row.sequenceStatus] ?? SEQUENCE_CONFIG.not_started
  // Suppression overrides the underlying sequence pill — when the
  // primary contact has bounced / complained / unsubscribed the
  // sequence is effectively over, so we surface that as the row's
  // Sequence display. Multi-contact rows use the primary contact's
  // state since the row click also opens the primary's popup.
  const suppression = getSuppressionState(row.primaryContact)

  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [role='menuitem']")) return
        if (row.companyId) onOpenRowMenu(e)
        else onOpenContactCard(row.primaryContact)
      }}
      style={{ cursor: "pointer" }}
      className="hover:bg-[#fafaf9]"
    >
      {/* Row-select checkbox — stops row-click bubble so ticking a row
          doesn't also open its details popup. */}
      <td onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onToggleSelect(!!v)}
          aria-label="Select row"
          className="h-3.5 w-3.5"
        />
      </td>

      {/* Company */}
      <td>
        <div className="flex items-center gap-3">
          {claimed?.logoUrl ? (
            <div className="arco-table-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={claimed.logoUrl} alt={row.companyName} />
            </div>
          ) : (
            <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>
              {companyInitials}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="flex items-center gap-1 min-w-0">
              {editingName !== null && row.companyId ? (
                <input
                  autoFocus
                  className="arco-table-primary border-b border-[#016D75] bg-transparent outline-none min-w-0 flex-1"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={async () => {
                    const trimmed = editingName.trim()
                    setEditingName(null)
                    if (!trimmed || trimmed === row.companyName) return
                    const supabase = getBrowserSupabaseClient()
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { error } = await supabase.from("companies").update({ name: trimmed } as any).eq("id", row.companyId!)
                    if (error) { toast.error(error.message); return }
                    toast.success("Name updated")
                    onRenamed()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur()
                    if (e.key === "Escape") setEditingName(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : row.companyId ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditingName(row.companyName ?? "") }}
                  className="arco-table-primary truncate hover:text-[#016D75] transition-colors text-left cursor-pointer bg-transparent border-none p-0"
                  title="Click to edit name"
                >
                  {row.companyName}
                </button>
              ) : (
                <span className="arco-table-primary truncate">{row.companyName}</span>
              )}
              {externalHref && (
                <a
                  href={externalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 text-[#a2a29f] hover:text-[#016D75] transition-colors"
                  title={externalHref}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </span>
            {subtitle && <span className="arco-table-secondary">{subtitle}</span>}
          </div>
        </div>
      </td>

      {/* Reason — call-list mode only. Plain text (the WHY) + a Skip
          pill matching the Log pill's design. */}
      {showCallColumn && (
        <td onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <span className="arco-table-primary" style={{ fontWeight: 400, whiteSpace: "nowrap" }}>
              {row.callReason ?? "—"}
            </span>
            {row.callReason && (
              <button
                type="button"
                onClick={onSkip}
                className={ACTION_PILL_CLASS}
                title="Skip — resurfaces as a follow-up in a week"
              >
                Skip
              </button>
            )}
          </div>
        </td>
      )}

      {/* Contacts — own onClick handler stops the row's click bubble so
          the contact dropdown / +N more popover open without the row's
          Details popup also firing on top. */}
      <td onClick={(e) => e.stopPropagation()}>
        <ContactsCell
          row={row}
          onOpenContactCard={onOpenContactCard}
          onLogOutbound={onLogOutbound}
          onSendEmail={onSendEmail}
          onNotInterested={onNotInterested}
          onRemoveFromFunnel={onRemoveFromFunnel}
        />
      </td>

      {/* Status (aggregated over the row's contacts) — read-only by
          design: it's the MAX across contacts, so editing it here
          would silently mutate one contact under an aggregate. Status
          moves through the real funnel events. */}
      <td>
        <span className="arco-table-status">
          <span className={`arco-table-status-dot ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>
      </td>

      {/* Sequence (aggregated single value, or suppression override) */}
      <td>
        <span className="arco-table-status">
          <span className={`arco-table-status-dot ${suppression ? suppression.dot : sequenceCfg.dot}`} />
          {suppression ? suppression.label : sequenceCfg.label}
        </span>
      </td>

      {/* Source (multi-pill) — Outbound + Email are appended when the
          row has that activity (see hasEmailActivity / lastOutboundAt).
          Single row: no wrap + horizontal-only overflow so long channel
          lists don't push the row taller than the rest of the table. */}
      <td>
        <div className="flex items-center gap-1 flex-nowrap overflow-x-auto whitespace-nowrap">
          {row.sources.map((s) => (
            <span key={s} className="status-pill shrink-0">{sourceLabel(s)}</span>
          ))}
          {/* Showcase membership comes from the company's lifecycle, not
              a contact source — append unless an 'arco' source already
              rendered the same label. */}
          {row.claimedCompany?.status === "prospected" && !row.sources.includes("arco") && (
            <span className="status-pill shrink-0">Showcase</span>
          )}
          {row.lastOutboundAt && (
            <span className="status-pill shrink-0">Outbound</span>
          )}
          {row.hasEmailActivity && (
            <span className="status-pill shrink-0">Email</span>
          )}
        </div>
      </td>

      <td style={{ textAlign: "center" }}>{row.emailsSent || "—"}</td>
      <td style={{ textAlign: "center" }}>
        {ratePct ? <span className={deliveredRateColor(ratePct.delivered, row.emailsSent)}>{ratePct.delivered}%</span> : <span className="text-[#a1a1a0] font-normal">—</span>}
      </td>
      <td style={{ textAlign: "center" }}>
        {ratePct ? <span className={openedRateColor(ratePct.opened, row.emailsSent)}>{ratePct.opened}%</span> : <span className="text-[#a1a1a0] font-normal">—</span>}
      </td>
      <td style={{ textAlign: "center" }}>
        {ratePct ? <span className={clickedRateColor(ratePct.clicked, row.emailsSent)}>{ratePct.clicked}%</span> : <span className="text-[#a1a1a0] font-normal">—</span>}
      </td>

      <td className="arco-table-nowrap" style={{ textAlign: "right", color: "var(--text-disabled)" }}>{formatDate(row.createdAt)}</td>
      <td className="arco-table-nowrap" style={{ textAlign: "right", color: "var(--text-disabled)" }}>
        {row.lastContactedAt ? formatDate(row.lastContactedAt) : <span className="text-[#c4c4c2]">—</span>}
      </td>
      <td className="arco-table-nowrap" style={{ textAlign: "right", color: "var(--text-disabled)" }}>
        {row.nextScheduledAt ? formatDate(row.nextScheduledAt) : <span className="text-[#c4c4c2]">—</span>}
      </td>
      <td className="arco-table-nowrap" style={{ textAlign: "right", color: "var(--text-disabled)" }}>
        {row.lastOutboundAt ? formatDate(row.lastOutboundAt) : <span className="text-[#c4c4c2]">—</span>}
      </td>
    </tr>
  )
}

/** Contacts cell — Projects-column pattern.
 *
 *   Layout:
 *     ● <name>  [● Status]  [● Sequence]
 *     +N more
 *
 *   The primary contact opens its Contact Card panel on click; "+N more"
 *   opens a dropdown listing the remaining contacts, each of which opens
 *   its own panel. The row never expands inline. */
function ContactsCell({
  row,
  onOpenContactCard,
  onLogOutbound,
  onSendEmail,
  onNotInterested,
  onRemoveFromFunnel,
}: {
  row: SalesCompanyRow
  onOpenContactCard: (contact: SalesContact) => void
  onLogOutbound: (contact: SalesContact) => void
  onSendEmail: (contact: SalesContact) => void
  onNotInterested: (contact: SalesContact) => void
  onRemoveFromFunnel: (contact: SalesContact) => void
}) {
  const primary = row.primaryContact
  const overflow = row.contacts.length - 1

  // Companies-style contact menu, shared by the primary chip and each
  // +N-more contact.
  const renderContactMenuItems = (contact: SalesContact) => {
    const phone = contact.phone ?? row.claimedCompany?.phone ?? null
    return (
      <>
        <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => onOpenContactCard(contact)}>
          Details
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => onLogOutbound(contact)}>
          Log outbound
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => onSendEmail(contact)}>
          Send email
        </DropdownMenuItem>
        {phone && (
          <DropdownMenuItem asChild>
            <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="text-xs cursor-pointer">
              Call
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-xs cursor-pointer text-[#b45309] focus:text-[#b45309]"
          onClick={() => onNotInterested(contact)}
        >
          Not interested
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-xs cursor-pointer text-red-600 focus:text-red-600"
          onClick={() => onRemoveFromFunnel(contact)}
        >
          Remove from funnel
        </DropdownMenuItem>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* Primary contact — opens the contact menu (companies pattern);
          Details in the menu opens the panel. The quiet "Log" pill
          stays as the one-click shortcut. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 hover:text-[#016D75] transition-colors cursor-pointer text-left"
          >
            <ContactInline contact={primary} companyShowcased={row.claimedCompany?.status === "prospected"} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          {renderContactMenuItems(primary)}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Overflow — dropdown is only a picker for WHICH contact; each
          item opens that contact's panel. */}
      {overflow > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="arco-table-secondary hover:text-[#016D75] transition-colors text-left cursor-pointer w-fit"
              style={{ marginTop: 0 }}
            >
              +{overflow} more
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[280px]">
            {row.contacts.slice(1).map((c) => (
              <DropdownMenuSub key={c.prospectId}>
                <DropdownMenuSubTrigger className="text-xs">
                  <ContactInline contact={c} companyShowcased={row.claimedCompany?.status === "prospected"} />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[180px]">
                  {renderContactMenuItems(c)}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

/** Inline pill-row representation of a single contact: leading sequence
 *  dot + name + status pill + source pill. Used as the click target for
 *  the primary contact and as each +N-more item label. The leading dot
 *  reflects the *sequence* state (active / paused / finished /
 *  not_started) for at-a-glance outreach scanning; status (the funnel
 *  stage) sits in its own pill alongside the source. Email is
 *  intentionally omitted — the panel carries the full address.
 *
 *  Suppression states (bounced / complained / unsubscribed) override
 *  the row's Sequence column instead — keeping the source pill stable
 *  here so the admin can still identify the channel at a glance. */
function ContactInline({ contact, afterName, companyShowcased = false }: { contact: SalesContact; afterName?: React.ReactNode; companyShowcased?: boolean }) {
  const statusCfg = STATUS_CONFIG[contact.status] ?? STATUS_CONFIG.prospect
  const displayName = contact.resolvedContact.name?.trim() || contact.contactName?.trim() || contact.email
  // Showcase is an UPGRADE of the track: before any outreach touch the
  // source pill is simply replaced ("Showcase"); once outreach has
  // started, both pills show — the history plus the current state.
  const outreachStarted =
    contact.emailsSent > 0 || contact.sequenceStatus !== "not_started" || !!contact.lastOutboundAt
  const showcaseUpgrade = companyShowcased && contact.source !== "arco"
  const replaceSourceWithShowcase = showcaseUpgrade && !outreachStarted
  return (
    <>
      <span className="arco-table-status">
        <span className="truncate max-w-[160px]">{displayName}</span>
      </span>
      {afterName}
      <span className="status-pill">
        <span className={`status-pill-dot ${statusCfg.dot}`} />
        {statusCfg.label}
      </span>
      <span className="status-pill">{replaceSourceWithShowcase ? "Showcase" : sourceLabel(contact.source)}</span>
      {showcaseUpgrade && !replaceSourceWithShowcase && (
        <span className="status-pill">Showcase</span>
      )}
      {contact.lastOutboundAt && (
        <span className="status-pill">Outbound</span>
      )}
      {contact.hasInboundEmail && (
        <span className="status-pill">Email</span>
      )}
    </>
  )
}


// CompanyInfo type kept for backwards compat with any external imports —
// the new aggregator bakes this directly into SalesCompanyRow.claimedCompany.
export type CompanyInfo = { logoUrl: string | null; services: string[]; city: string | null }
