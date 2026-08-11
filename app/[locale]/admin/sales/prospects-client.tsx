"use client"

import { Fragment, useEffect, useRef, useState, useTransition, useCallback } from "react"
import { toast } from "sonner"
import {
  fetchSalesCompanies,
  startProspectSequence,
  pauseProspectSequence,
  removeProspectFromFunnel,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { clickedRateColor, deliveredRateColor, openedRateColor } from "@/lib/email-rate-colors"
import { ContactCard } from "@/components/contact-card/contact-card"
import { useContactParam } from "@/hooks/use-contact-param"

// -- Status config -----------------------------------------------------------

export const STATUS_CONFIG: Record<ProspectStatus, { label: string; cls: string; dot: string }> = {
  prospect: { label: "Prospect", cls: "bg-amber-50 text-amber-700", dot: "bg-[#f59e0b]" },
  contacted: { label: "Contacted", cls: "bg-amber-50 text-amber-700", dot: "bg-[#f59e0b]" },
  visitor: { label: "Visitor", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  signup: { label: "Signup", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  company: { label: "Created", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  active: { label: "Listed", cls: "bg-purple-50 text-purple-800 font-semibold", dot: "bg-[#7c3aed]" },
  // Removed never renders in the funnel — the row hides any contact with this
  // status, and the company row drops entirely if every contact is removed.
  // Kept here so per-contact rendering doesn't crash if a stray row slips in.
  removed: { label: "Removed", cls: "bg-gray-50 text-gray-500", dot: "bg-[#a1a1a0]" },
}

// Statuses surfaced in the multi-select status filter. 'removed' is a soft-
// delete marker — admin doesn't filter for it, the row is just hidden.
const ALL_STATUSES: ProspectStatus[] = [
  "prospect", "contacted", "visitor", "signup", "company", "active",
]

export const SEQUENCE_CONFIG: Record<SequenceStatus, { label: string; dot: string }> = {
  not_started: { label: "Not started", dot: "bg-[#a1a1a0]" },
  active: { label: "Active", dot: "bg-[#2563eb]" },
  paused: { label: "Paused", dot: "bg-amber-400" },
  finished: { label: "Finished", dot: "bg-emerald-500" },
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
function getSuppressionState(contact: { bouncedAt: string | null; complainedAt: string | null; unsubscribedAt: string | null }):
  { label: "Bounced" | "Complained" | "Unsubscribed" } | null {
  if (contact.complainedAt) return { label: "Complained" }
  if (contact.bouncedAt) return { label: "Bounced" }
  if (contact.unsubscribedAt) return { label: "Unsubscribed" }
  return null
}

// Funnel stages aligned with Growth lifecycle model
const FUNNEL_STAGES: { status: ProspectStatus; label: string; driver: "prospect" | "acquisition" | "retention" }[] = [
  { status: "prospect", label: "Prospect", driver: "prospect" },
  { status: "contacted", label: "Contacted", driver: "prospect" },
  { status: "visitor", label: "Visitor", driver: "acquisition" },
  { status: "signup", label: "Signup", driver: "acquisition" },
  { status: "company", label: "Created", driver: "acquisition" },
  { status: "active", label: "Listed", driver: "retention" },
]

// First card where each driver label should appear
const DRIVER_LABEL_AT: Record<string, string> = {
  prospect: "prospect",
  acquisition: "visitor",
  retention: "active",
}

const DRIVER_COLORS: Record<string, string> = {
  prospect: "#f59e0b",
  acquisition: "#2563eb",
  retention: "#7c3aed",
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
  // Invite — peer-to-peer from another professional on a real project.
  "new-professional-invite": "Invite Intro",
  "new-professional-followup": "Invite Follow-up",
  "new-professional-final": "Invite Final",
  // Outreach (cold) — formerly run via Apollo, now Arco-controlled.
  "outreach-intro": "Outreach Intro",
  "outreach-followup": "Outreach Follow-up",
  "outreach-final": "Outreach Final",
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
  initialOutboundDueCount: number
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
  initialOutboundDueCount,
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
  // Toggle for the Outbound-due button: when true, the table only renders
  // companies with a next outbound today or in the past. Count next to the
  // button stays global (initialOutboundDueCount) — it doesn't shrink to
  // zero when the filter is active.
  const [outboundDueOnly, setOutboundDueOnly] = useState(false)
  const [outboundDueCount, setOutboundDueCount] = useState(initialOutboundDueCount)
  // Multi-select row state — mirrors the /admin/companies pattern. Keyed
  // on row.rowId; bulk actions iterate the underlying contacts of every
  // selected row. Cleared on successful bulk action or filter change.
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [search, setSearch] = useState("")
  const [showStatusGuide, setShowStatusGuide] = useState(false)
  const [showApolloSync, setShowApolloSync] = useState(false)
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
        outboundDueOnly,
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
      setOutboundDueCount(result.outboundDueCount)
      setOffset(off)
      setHasMore(result.totalCompanies > off + result.companies.length)
    })
  }, [statusFilter, sourceFilter, sequenceFilter, search, outboundDueOnly, sortBy, sortDir])

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
    outboundDueOnly?: boolean
  }) => {
    if (opts.statuses !== undefined) setStatusFilter(opts.statuses)
    if (opts.sources !== undefined) setSourceFilter(opts.sources)
    if (opts.sequences !== undefined) setSequenceFilter(opts.sequences)
    if (opts.outboundDueOnly !== undefined) setOutboundDueOnly(opts.outboundDueOnly)
    const s = opts.statuses ?? statusFilter
    const src = opts.sources ?? sourceFilter
    const seq = opts.sequences ?? sequenceFilter
    const due = opts.outboundDueOnly ?? outboundDueOnly
    startTransition(async () => {
      const result = await fetchSalesCompanies({
        statuses: s, sources: src, sequences: seq, search,
        outboundDueOnly: due,
        offset: 0, limit: 50, sortBy, sortDir,
      })
      setCompanies(result.companies)
      setTotalCompanies(result.totalCompanies)
      setFunnel(result.funnel)
      setOutboundDueCount(result.outboundDueCount)
      setTotalEmailsSent(result.companies.reduce((sum, c) => sum + c.emailsSent, 0))
      setOffset(0)
      setHasMore(result.totalCompanies > result.companies.length)
      // Any narrowing invalidates the current selection — otherwise a
      // hidden selected row would still be picked up by bulk actions.
      setSelectedRowIds(new Set())
    })
  }, [statusFilter, sourceFilter, sequenceFilter, search, outboundDueOnly, sortBy, sortDir])

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
      const res = await fetch("/api/apollo-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_list", list_id: syncListId.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setSyncResult(`Imported ${data.synced} contacts`)
        reload({ offset: 0 })
      } else {
        setSyncResult(`Error: ${data.error}`)
      }
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
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="arco-section-title">Sales</h3>
          <p className="text-xs text-[#a1a1a0] mt-0.5">
            {companies.length} of {totalCompanies} companies
            {" · "}
            <button type="button" className="text-[#016D75] hover:underline cursor-pointer" onClick={() => setShowStatusGuide(true)}>
              Status guide
            </button>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Apollo connection badge — same pattern as the Inbox mailbox
              badge. Clicking it opens the Import contacts popup, so the
              import flow stays one click away without a dedicated button. */}
          <button
            type="button"
            onClick={() => {
              setSyncListId(currentApolloListId ?? "")
              setShowApolloSync(true)
            }}
            className="flex items-center gap-2 cursor-pointer"
            title="Import contacts from Apollo"
          >
            {apolloSyncStatus?.connected ? (
              <>
                <span
                  className="status-pill"
                  style={{
                    borderColor: apolloSyncStatus.hadError ? "#fecaca" : "#bbf7d0",
                    color: apolloSyncStatus.hadError ? "#b91c1c" : "#166534",
                  }}
                >
                  <span className={`status-pill-dot ${apolloSyncStatus.hadError ? "bg-red-500" : "bg-emerald-500"}`} />
                  {apolloSyncStatus.hadError ? "Sync error" : "Connected"}
                </span>
                <span className="text-[11px] text-[#a1a1a0]">
                  Apollo · {apolloProspectsCount} contacts
                  {" · "}last sync {apolloSyncStatus.lastSyncAt ? formatRelativeSync(apolloSyncStatus.lastSyncAt) : "never"}
                </span>
              </>
            ) : (
              <>
                <span className="status-pill" style={{ borderColor: "#e5e5e4", color: "#6b6b68" }}>
                  <span className="status-pill-dot bg-[#a1a1a0]" />
                  Not connected
                </span>
                <span className="text-[11px] text-[#a1a1a0]">Apollo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Conversion funnel — counts unique companies per stage. */}
      <div className="mb-8 -mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        {(() => {
          const cols = FUNNEL_STAGES.map((_, i) => i === 0 ? "auto" : "1fr auto").join(" ")
          const stageKeys = FUNNEL_STAGES.map((s) => s.status)
          const cohorted = stageKeys.map((key, i) =>
            stageKeys.slice(i).reduce((sum, k) => sum + ((funnel as any)[k] ?? 0), 0)
          )

          return (
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 0, alignItems: "start" }}>
              {FUNNEL_STAGES.map((stage, i) => {
                const count = (funnel as any)[stage.status] ?? 0
                const prevCohort = i > 0 ? cohorted[i - 1] : funnel.total
                const thisCohort = cohorted[i]
                const rate = i === 0 ? "" : conversionRate(prevCohort, thisCohort)
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
                      </div>
                    )}
                    <div className="flex flex-col">
                      {driverLabel ? (
                        <p className="arco-eyebrow mb-2" style={{ color: DRIVER_COLORS[driverLabel] }}>{driverLabel.charAt(0).toUpperCase() + driverLabel.slice(1)}</p>
                      ) : (
                        <div style={{ height: 24 }} />
                      )}
                      <button
                        onClick={() => toggleStatus(stage.status)}
                        className={`rounded-[3px] border bg-white px-3 py-3 transition-colors hover:border-[#c4c4c2] ${statusFilter.includes(stage.status) ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
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
            </div>
          )
        })()}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
        <div className="flex-1">
          <div className="relative max-w-xs">
            <input
              type="text"
              placeholder="Search company or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-3 text-xs border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
            />
            <svg className="absolute left-2.5 top-2.5 text-[#a1a1a0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Outbound-due toggle — accent button sitting left of the Status
              filter, mirroring the Review CTA on /admin/projects. Always
              renders when the global count is > 0 so the rep can see how
              many companies are due for outbound at a glance; clicking
              toggles the table-level filter. */}
          {outboundDueCount > 0 && (
            <button
              type="button"
              onClick={() => handleFilterChange({ outboundDueOnly: !outboundDueOnly })}
              className="btn-primary"
              style={{
                fontSize: 13,
                padding: "6px 16px",
                borderRadius: 3,
                opacity: outboundDueOnly ? 1 : 0.92,
                boxShadow: outboundDueOnly ? "inset 0 0 0 2px rgba(0,0,0,0.18)" : undefined,
              }}
              aria-pressed={outboundDueOnly}
            >
              Outbound ({outboundDueCount})
            </button>
          )}
          {/* Multi-select status filter — empty selection = all statuses. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`w-[170px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 ${
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
            <DropdownMenuContent align="start" className="min-w-[180px]">
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
                className={`w-[170px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 ${
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
                className={`w-[150px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 ${
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
            <DropdownMenuContent align="start" className="min-w-[180px]">
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
        </div>
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
      <div className="arco-table-wrap">
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
              <th
                style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("next_outbound_at")}
                title="Sort by next outbound follow-up"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Next outbound
                  {sortBy === "next_outbound_at" && (
                    <span className="text-[10px] text-[#a1a1a0]">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr>
                <td colSpan={15} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
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
              />
            ))}
          </tbody>
        </table>
      </div>

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
                { dot: "bg-[#2563eb]", label: "Created", desc: "Owns a company in Created status — claimed but never listed yet.", specs: "Company claimed · Profile setup" },
                { dot: "bg-[#2563eb]", label: "Signup", desc: "Created an Arco account but has not claimed or created a company yet.", specs: "Account created · No company" },
                { dot: "bg-[#2563eb]", label: "Visitor", desc: "Clicked a link in an outreach email and visited the site.", specs: "Email engagement · No account yet" },
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
              <strong>Flow:</strong> Prospect → Contacted → Visitor → Signup → Created → Listed
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
      <ContactCard
        email={contactParam.email}
        prospectId={contactParam.prospectId}
        onEmailAssigned={(next) => contactParam.open(next)}
        onRemoved={() => {
          contactParam.close()
          reload({ offset })
        }}
        onClose={contactParam.close}
      />
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
}: {
  row: SalesCompanyRow
  selected: boolean
  onToggleSelect: (value: boolean) => void
  /** Shared Contact Card slide-over — email-keyed (prospect-keyed
   *  fallback for empty-email rows). Row click opens the primary
   *  contact; contact / +N-more clicks open that specific contact. */
  onOpenContactCard: (contact: SalesContact) => void
}) {
  const claimed = row.claimedCompany
  const companyInitials = (row.companyName ?? "")
    .split(" ")
    .filter(Boolean)
    .map((t) => t[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "?"

  const subtitle = [claimed?.primaryService, claimed?.city ?? row.city].filter(Boolean).join(" · ")

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
      onClick={() => onOpenContactCard(row.primaryContact)}
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
            {claimed?.slug ? (
              <a
                href={`/professionals/${claimed.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="arco-table-primary hover:underline"
              >
                {row.companyName}
              </a>
            ) : (
              <span className="arco-table-primary">{row.companyName}</span>
            )}
            {subtitle && <span className="arco-table-secondary">{subtitle}</span>}
          </div>
        </div>
      </td>

      {/* Contacts — own onClick handler stops the row's click bubble so
          the contact dropdown / +N more popover open without the row's
          Details popup also firing on top. */}
      <td onClick={(e) => e.stopPropagation()}>
        <ContactsCell row={row} onOpenContactCard={onOpenContactCard} />
      </td>

      {/* Status (aggregated) */}
      <td>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusCfg.dot}`} />
          <span className="arco-table-primary" style={{ whiteSpace: "nowrap" }}>{statusCfg.label}</span>
        </div>
      </td>

      {/* Sequence (aggregated single value, or suppression override) */}
      <td>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${suppression ? "bg-red-500" : sequenceCfg.dot}`} />
          <span className="arco-table-primary" style={{ whiteSpace: "nowrap", fontWeight: 400 }}>
            {suppression ? suppression.label : sequenceCfg.label}
          </span>
        </div>
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
      <td className="arco-table-nowrap" style={{ textAlign: "right", color: "var(--text-disabled)" }}>
        {row.nextOutboundAt ? (
          <span className="inline-flex items-center gap-1.5">
            {new Date(row.nextOutboundAt) < new Date() && (
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" title="Overdue" />
            )}
            {formatDate(row.nextOutboundAt)}
          </span>
        ) : (
          <span className="text-[#c4c4c2]">—</span>
        )}
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
}: {
  row: SalesCompanyRow
  onOpenContactCard: (contact: SalesContact) => void
}) {
  const primary = row.primaryContact
  const overflow = row.contacts.length - 1

  return (
    <div className="flex flex-col gap-0.5">
      {/* Primary contact — opens the Contact Card panel directly. All
          per-contact actions (Log outbound, sequence transitions,
          Remove from funnel) live inside the panel now. */}
      <button
        type="button"
        onClick={() => onOpenContactCard(primary)}
        className="flex items-center gap-1.5 hover:text-[#016D75] transition-colors cursor-pointer text-left"
      >
        <ContactInline contact={primary} />
      </button>

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
              <DropdownMenuItem
                key={c.prospectId}
                className="text-xs cursor-pointer"
                onClick={() => onOpenContactCard(c)}
              >
                <ContactInline contact={c} />
              </DropdownMenuItem>
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
function ContactInline({ contact }: { contact: SalesContact }) {
  const statusCfg = STATUS_CONFIG[contact.status] ?? STATUS_CONFIG.prospect
  const sequenceCfg = SEQUENCE_CONFIG[contact.sequenceStatus] ?? SEQUENCE_CONFIG.not_started
  const suppression = getSuppressionState(contact)
  const displayName = contact.resolvedContact.name?.trim() || contact.contactName?.trim() || contact.email
  return (
    <>
      <span className="arco-table-status">
        <span className={`arco-table-status-dot ${suppression ? "bg-red-500" : sequenceCfg.dot}`} />
        <span className="truncate max-w-[160px]">{displayName}</span>
      </span>
      <span className="status-pill">
        <span className={`status-pill-dot ${statusCfg.dot}`} />
        {statusCfg.label}
      </span>
      <span className="status-pill">{sourceLabel(contact.source)}</span>
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
