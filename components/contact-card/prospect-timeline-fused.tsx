"use client"

import { useEffect, useState } from "react"
import {
  fetchProspectById,
  fetchProspectEvents,
  fetchProspectInboundEmails,
  getProspectInviteContext,
  getProspectSequence,
  type Prospect,
  type ProspectEvent,
  type ProspectSequenceStep,
  type ProspectInviteContext,
  type InboundEmailForProspect,
  type ProspectStatus,
} from "@/app/admin/sales/actions"
import {
  EventHistoryRow,
  STATUS_CONFIG,
  formatDateShort,
  templateDisplayName,
} from "@/app/admin/sales/prospects-client"

/**
 * Fused timeline for the shared Contact Card.
 *
 * Structure inside the Timeline section:
 *
 *   1. PillsRow      — status, sequence (when != not_started), emails /
 *                      opened count, next-follow-up date, red pills for
 *                      the three suppression states.
 *   2. TimelineStream — every real event newest-first:
 *                        * lifecycle transitions as dashed dividers,
 *                        * sequence sends as first-class rows with a
 *                          clickable template, language pill, and one
 *                          merged status-and-engagement pill,
 *                        * prospect_events / inbound_emails / manual
 *                          logs via the existing EventHistoryRow.
 *
 * SequenceStrip was dropped: the same sends now live in the stream as
 * clickable rows, and queued / paused / not_started state is carried
 * by the top pill row.
 *
 * ContactDetailBody stays untouched — the +N-more modal path still uses
 * it. Retire once this render has proven out.
 */

type Props = {
  prospectId: string
  email: string
}

type Bundle = {
  prospect: Prospect | null
  events: ProspectEvent[]
  sequence: ProspectSequenceStep[]
  locale: "en" | "nl" | null
  inviteContext: ProspectInviteContext | null
  inboundEmails: InboundEmailForProspect[]
}

export function ProspectTimelineFused({ prospectId, email }: Props) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; bundle: Bundle }
  >({ kind: "loading" })
  const [preview, setPreview] = useState<{ template: string; lang: "en" | "nl" } | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ kind: "loading" })
    Promise.all([
      fetchProspectById(prospectId),
      fetchProspectEvents(prospectId),
      getProspectSequence(prospectId),
      fetchProspectInboundEmails(prospectId),
    ])
      .then(async ([prospect, eventsResult, sequenceResult, inboundResult]) => {
        if (cancelled) return
        const inviteResult =
          prospect && prospect.source === "invites"
            ? await getProspectInviteContext(prospectId)
            : ({ success: true, context: null } as const)
        if (cancelled) return
        setState({
          kind: "ready",
          bundle: {
            prospect,
            events: eventsResult.events ?? [],
            sequence: sequenceResult.success ? sequenceResult.steps ?? [] : [],
            locale: sequenceResult.success ? sequenceResult.locale ?? null : null,
            inviteContext: inviteResult.success ? inviteResult.context ?? null : null,
            inboundEmails: inboundResult.emails ?? [],
          },
        })
      })
      .catch((err) => {
        if (!cancelled) setState({ kind: "error", message: err?.message ?? "Failed to load timeline" })
      })
    return () => { cancelled = true }
  }, [prospectId, email])

  if (state.kind === "loading") {
    return <p style={{ fontSize: 12, color: "#a1a1a0", margin: 0 }}>Loading timeline…</p>
  }
  if (state.kind === "error") {
    return <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>{state.message}</p>
  }

  const { bundle } = state
  const guessedLang: "en" | "nl" = bundle.locale
    ?? (email.toLowerCase().endsWith(".nl") || email.toLowerCase().endsWith(".be") ? "nl" : "en")

  return (
    <>
      <ActivitySection bundle={bundle} />
      <div>
        <SectionLabel>Timeline</SectionLabel>
        <TimelineStream
          bundle={bundle}
          guessedLang={guessedLang}
          onPreviewTemplate={(template) => setPreview({ template, lang: guessedLang })}
        />
      </div>
      {preview && (
        <TemplatePreviewModal
          template={preview.template}
          initialLang={preview.lang}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}

// ── Activity section (status / channel / created, DetailField style) ──

function ActivitySection({ bundle }: { bundle: Bundle }) {
  const p = bundle.prospect
  const statusCfg = p ? STATUS_CONFIG[p.status as ProspectStatus] : null

  // Distinct campaign channels the sequence steps belong to. A contact
  // can accumulate more than one channel over their lifetime (e.g.
  // Showcase then Invite once they claim), so render as a set of
  // outline pills — same visual as the language pill on sequence rows.
  const channels = Array.from(
    new Set(
      bundle.sequence.map((s) => channelForTemplate(s.template)).filter((c): c is string => Boolean(c)),
    ),
  )

  // Suppression state — rendered as an inline suffix on Status so a
  // bounced/unsubscribed/complained prospect reads as red at a glance.
  const suppression = p?.bounced_at ? "bounced"
    : p?.complained_at ? "complained"
    : p?.unsubscribed_at ? "unsubscribed"
    : null

  return (
    <div>
      <SectionLabel>Activity</SectionLabel>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        <Row label="Status">
          {statusCfg ? (
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${statusCfg.dot}`} />
              <span>{statusCfg.label}</span>
              {suppression && <span style={{ color: "#b91c1c" }}>· {suppression}</span>}
            </span>
          ) : (
            <span style={{ color: "#a1a1a0" }}>—</span>
          )}
        </Row>
        <Row label="Channel">
          {channels.length > 0 ? (
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
              {channels.map((c) => (
                <span
                  key={c}
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    padding: "0 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: "#1c1c1a",
                    border: "1px solid #e5e5e4",
                    background: "transparent",
                  }}
                >
                  {c}
                </span>
              ))}
            </span>
          ) : (
            <span style={{ color: "#a1a1a0" }}>—</span>
          )}
        </Row>
        <Row label="Created">
          {p?.created_at ? formatDateShort(p.created_at).split(" · ")[0] : (
            <span style={{ color: "#a1a1a0" }}>—</span>
          )}
        </Row>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="grid items-baseline gap-2"
      style={{ gridTemplateColumns: "70px 1fr" }}
    >
      <span style={{ fontSize: 11, color: "#a1a1a0" }}>{label}</span>
      <span style={{ fontSize: 12, lineHeight: 1.5, color: "#1c1c1a", minWidth: 0 }}>
        {children}
      </span>
    </div>
  )
}

function channelForTemplate(template: string): string | null {
  if (!template) return null
  if (template.startsWith("prospect-")) return "Showcase"
  if (template.startsWith("new-professional-")) return "Invite"
  if (template.startsWith("outreach-")) return "Outreach"
  return null
}

// ── Merged stream ──────────────────────────────────────────────────────

type StreamRow =
  | { kind: "stage"; ts: string; label: string; dot: string; key: string }
  | { kind: "sequence"; ts: string; step: ProspectSequenceStep; key: string }
  | { kind: "event"; ts: string; event: ProspectEvent; key: string }

function TimelineStream({
  bundle,
  guessedLang,
  onPreviewTemplate,
}: {
  bundle: Bundle
  guessedLang: "en" | "nl"
  onPreviewTemplate: (template: string) => void
}) {
  const prospect = bundle.prospect
  const isInvite = prospect?.source === "invites"

  // Lifecycle stages become chapter dividers. Fictional as "events"
  // (derived from prospect columns, not the events table) but the
  // divider styling reads honestly.
  const initialStatus = (isInvite ? "contacted" : "prospect") as ProspectStatus
  const firstSentAt = bundle.sequence
    .filter((s) => s.status === "sent" && s.timestamp)
    .map((s) => s.timestamp as string)
    .sort()[0] ?? null
  const stageDefs: Array<{ label: string; ts: string | null; status: ProspectStatus }> = prospect
    ? [
        { label: "prospect", ts: prospect.created_at, status: initialStatus },
        { label: "contacted", ts: firstSentAt ?? prospect.last_email_sent_at, status: "contacted" },
        { label: "visitor", ts: prospect.landing_visited_at, status: "visitor" },
        { label: "signup", ts: prospect.signed_up_at, status: "signup" },
        { label: "created", ts: prospect.company_created_at, status: "company" },
        { label: "listed", ts: (prospect as any).converted_at, status: "active" },
      ]
    : []
  if (isInvite && stageDefs.length > 0) stageDefs[0].label = "invited"
  const stageRows: StreamRow[] = stageDefs
    .filter((s): s is { label: string; ts: string; status: ProspectStatus } => Boolean(s.ts))
    .map((s) => ({ kind: "stage", ts: s.ts, label: s.label, dot: STATUS_CONFIG[s.status].dot, key: `stage-${s.status}` }))

  // Sequence sends folded in as their own row type so we can render a
  // clickable template link + language pill + engagement pill instead
  // of the generic event line.
  const sequenceRows: StreamRow[] = bundle.sequence
    .filter((s) => s.status === "sent" && s.timestamp)
    .map((s) => ({
      kind: "sequence" as const,
      ts: s.timestamp as string,
      key: `seq-${s.template}`,
      step: s,
    }))

  // Inbound emails render via EventHistoryRow (its email.received branch
  // knows how to expand snippet + body).
  const inboundRows: StreamRow[] = bundle.inboundEmails.map((m) => ({
    kind: "event" as const,
    ts: m.received_at,
    key: `inbound-${m.id}`,
    event: {
      id: `inbound-email-${m.id}`,
      prospect_id: prospect?.id ?? "",
      event_type: "email.received",
      created_at: m.received_at,
      metadata: {
        from_email: m.from_email,
        from_name: m.from_name,
        subject: m.subject,
        snippet: m.snippet,
        body_text: m.body_text,
        inbound_email_id: m.id,
        status: m.status,
      },
    } as ProspectEvent,
  }))

  // Chapter dividers already carry every lifecycle transition:
  // stage row = "PROSPECT" / "CONTACTED" / "VISITOR" / "SIGNUP" /
  // "CREATED" / "LISTED" at the correct timestamp. Drop every event
  // row that would just repeat one of those transitions.
  //
  //   * prospect.landing_visited  -> "visitor" chapter
  //   * prospect.signed_up        -> "signup" chapter
  //   * prospect.company_created  -> "created" chapter
  //   * prospect.listed           -> "listed" chapter (also the
  //                                 synthetic listed row we used to
  //                                 add from converted_at)
  //   * user.signed_up            -> same as signup
  //   * company_invited           -> "invited" chapter (also the
  //                                 synthetic invited row we used to
  //                                 add from inviteContext)
  //   * status_changed / status_changed_to_* — the coarse "Status
  //                                 changed" line, always redundant
  //                                 with the specific chapter that
  //                                 fires at the same time.
  //
  // Prior version added synthetic invited/listed rows and did a 60s-
  // window dedup for status_changed — both are gone now. The chapter
  // divider is the canonical row for every stage.
  const CHAPTER_EVENT_TYPES = new Set([
    "prospect.landing_visited",
    "prospect.signed_up",
    "prospect.company_created",
    "prospect.listed",
    "user.signed_up",
    "company_invited",
    "status_changed",
  ])

  // Cleanup on raw events, in one pass:
  //   * `replied` — redundant with email.received rows above.
  //   * `email_sent` / `email_resent` — fully covered by the sequence
  //     row now (this was the "Email Sent" duplicate the rep saw
  //     stacked under "Outreach Follow-up sent").
  //   * lifecycle-transition events — see CHAPTER_EVENT_TYPES above.
  //   * `admin_replied` gets reply body hydrated from inbound_emails.
  const inboundById = new Map(bundle.inboundEmails.map((m) => [m.id, m]))
  const enrichedEvents = bundle.events
    .filter((ev) => ev.event_type !== "replied")
    .filter((ev) => ev.event_type !== "email_sent" && ev.event_type !== "email_resent")
    .filter((ev) => !CHAPTER_EVENT_TYPES.has(ev.event_type) && !ev.event_type.startsWith("status_changed_to_"))
    .map((ev) => {
      if (ev.event_type !== "admin_replied") return ev
      const linkedId = typeof ev.metadata?.inbound_email_id === "string"
        ? ev.metadata.inbound_email_id
        : null
      const linked = linkedId ? inboundById.get(linkedId) ?? null : null
      if (!linked) return ev
      return {
        ...ev,
        metadata: {
          ...ev.metadata,
          replied_text: linked.replied_text,
          original_subject: linked.subject,
        },
      }
    })

  const eventRows: StreamRow[] = enrichedEvents
    .map((ev) => ({ kind: "event" as const, ts: ev.created_at, key: ev.id, event: ev }))

  const rows: StreamRow[] = [...stageRows, ...sequenceRows, ...inboundRows, ...eventRows]
    .sort((a, b) => b.ts.localeCompare(a.ts))

  if (rows.length === 0) {
    return <p style={{ fontSize: 12, color: "#a1a1a0", margin: "8px 0 0" }}>No events yet.</p>
  }

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((row) =>
        row.kind === "stage" ? (
          <StageDivider key={row.key} label={row.label} ts={row.ts} dot={row.dot} />
        ) : row.kind === "sequence" ? (
          <SequenceRow
            key={row.key}
            step={row.step}
            lang={guessedLang}
            onPreview={onPreviewTemplate}
          />
        ) : (
          <EventHistoryRow key={row.key} event={row.event} />
        ),
      )}
    </div>
  )
}

// ── Sequence row (clickable, single engagement pill) ───────────────────

function SequenceRow({
  step,
  lang,
  onPreview,
}: {
  step: ProspectSequenceStep
  lang: "en" | "nl"
  onPreview: (template: string) => void
}) {
  // One pill per row. Delivery/engagement supersedes the raw send
  // state — "opened" is a strictly stronger signal than "sent" for the
  // rep, so we collapse the two into a single pill that reads at a
  // glance.
  const engagement = (() => {
    if (step.clickedAt || step.lastEvent === "clicked") return { dot: "bg-purple-500", label: "clicked", tone: "default" as const }
    if (step.openedAt || step.lastEvent === "opened") return { dot: "bg-blue-500", label: "opened", tone: "default" as const }
    if (step.lastEvent === "delivered") return { dot: "bg-emerald-500", label: "delivered", tone: "default" as const }
    if (step.lastEvent === "bounced") return { dot: "bg-red-500", label: "bounced", tone: "danger" as const }
    if (step.lastEvent === "complained") return { dot: "bg-red-500", label: "complained", tone: "danger" as const }
    // Fallback: raw send state. "sent" is the neutral default when no
    // Resend engagement event has arrived (yet).
    const s = step.status
    if (s === "sent") return { dot: "bg-emerald-500", label: "sent", tone: "default" as const }
    if (s === "queued") return { dot: "bg-[#2563eb]", label: "queued", tone: "default" as const }
    if (s === "paused") return { dot: "bg-amber-400", label: "paused", tone: "default" as const }
    if (s === "finished") return { dot: "bg-emerald-500", label: "finished", tone: "default" as const }
    if (s === "failed") return { dot: "bg-red-500", label: "retrying", tone: "danger" as const }
    return { dot: "bg-[#a1a1a0]", label: s, tone: "default" as const }
  })()

  const clickable = !step.template.startsWith("apollo-step-")
  const name = templateDisplayName(step.template)

  return (
    <div
      className="grid items-center gap-2 text-xs"
      style={{ gridTemplateColumns: "90px 1fr" }}
    >
      <span className="text-[#a1a1a0] whitespace-nowrap">
        {step.timestamp ? formatDateShort(step.timestamp) : "—"}
      </span>
      <span className="inline-flex items-center gap-2 min-w-0 flex-wrap">
        {clickable ? (
          <button
            type="button"
            onClick={() => onPreview(step.template)}
            className="text-[#016D75] hover:underline truncate cursor-pointer text-left"
          >
            {name}
          </button>
        ) : (
          <span className="text-[#1c1c1a] truncate text-left">{step.label || name}</span>
        )}
        <span className="status-pill shrink-0">{lang.toUpperCase()}</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
            background: "transparent",
            color: engagement.tone === "danger" ? "#b91c1c" : "#1c1c1a",
            border: `1px solid ${engagement.tone === "danger" ? "#fecaca" : "#e5e5e4"}`,
            whiteSpace: "nowrap",
          }}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${engagement.dot}`} />
          {engagement.label}
        </span>
      </span>
    </div>
  )
}

// ── Template preview modal ─────────────────────────────────────────────

function TemplatePreviewModal({
  template,
  initialLang,
  onClose,
}: {
  template: string
  initialLang: "en" | "nl"
  onClose: () => void
}) {
  const [lang, setLang] = useState<"en" | "nl">(initialLang)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 800 }}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: "min(720px, 90vw)" }}>
        <div className="popup-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 className="arco-section-title" style={{ margin: 0 }}>{templateDisplayName(template)}</h3>
            <div style={{ display: "inline-flex", border: "1px solid #eeeeed", borderRadius: 999, padding: 2 }}>
              {(["en", "nl"] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLang(loc)}
                  style={{
                    background: lang === loc ? "var(--arco-black)" : "transparent",
                    color: lang === loc ? "#fff" : "var(--arco-mid-grey)",
                    padding: "3px 12px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: lang === loc ? 500 : 400,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <iframe
          src={`/admin/emails/preview?template=${template}&lang=${lang}`}
          style={{ width: "100%", height: "70vh", border: "none", background: "#fff" }}
          title={`${template} preview`}
        />
      </div>
    </div>
  )
}

// ── Small shared helpers ───────────────────────────────────────────────

function StageDivider({ label, ts, dot }: { label: string; ts: string; dot: string }) {
  return (
    <div
      className="grid items-center gap-2"
      style={{ gridTemplateColumns: "90px 1fr", padding: "6px 0", borderTop: "1px dashed #eeeeed" }}
    >
      <span style={{ fontSize: 11, color: "#a1a1a0", whiteSpace: "nowrap" }}>{formatDateShort(ts)}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
        <span style={{ fontSize: 12, fontWeight: 500, color: "#1c1c1a" }}>
          {capitalizeFirst(label)}
        </span>
      </span>
    </div>
  )
}

function capitalizeFirst(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#a1a1a0",
      }}
    >
      {children}
    </span>
  )
}
