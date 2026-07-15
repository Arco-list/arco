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
  SEQUENCE_CONFIG,
  STATUS_CONFIG,
  formatDateShort,
} from "@/app/admin/sales/prospects-client"

/**
 * Fused timeline for the shared Contact Card.
 *
 * Replaces the three stacked sections (Lifecycle / Outreach Sequence /
 * Activity) that ContactDetailBody renders in the old modal with a
 * single time-ordered stream:
 *
 *   1. Header pill row  — status, sequence, emails-sent/opened,
 *                          next-follow-up, suppression pills. Answers
 *                          "what's the state of this contact right now?"
 *                          at a glance.
 *   2. Sequence strip   — 3 dots for Intro / Follow / Final showing plan
 *                          state (sent / queued / paused / not_started).
 *                          Preserved as a separate strip because parts
 *                          of it live in the future ("queued") and don't
 *                          have a timestamp to belong in the stream.
 *   3. Merged stream    — every real event, newest first. Lifecycle
 *                          transitions become chapter-divider rows;
 *                          sequence sends become event rows; prospect
 *                          events + inbound emails + outbound logs
 *                          render via the existing EventHistoryRow.
 *
 * ContactDetailBody stays untouched — the old +N-more modal path still
 * uses it. Once this render has proven out, retire the old path.
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PillsRow bundle={bundle} />
      <SequenceStrip steps={bundle.sequence} />
      <TimelineStream bundle={bundle} />
    </div>
  )
}

// ── Header pills ───────────────────────────────────────────────────────

function PillsRow({ bundle }: { bundle: Bundle }) {
  const p = bundle.prospect
  const statusCfg = p ? STATUS_CONFIG[p.status as ProspectStatus] : null
  const seqCfg = p?.sequence_status ? SEQUENCE_CONFIG[p.sequence_status] : null

  const pills: { key: string; label: string; dot?: string; tone?: "default" | "danger" }[] = []
  if (statusCfg) pills.push({ key: "status", label: statusCfg.label, dot: statusCfg.dot })
  if (seqCfg && p?.sequence_status && p.sequence_status !== "not_started") {
    pills.push({ key: "seq", label: seqCfg.label, dot: seqCfg.dot })
  }
  if (p && p.emails_sent > 0) {
    pills.push({
      key: "emails",
      label:
        p.emails_opened > 0
          ? `${p.emails_sent} email${p.emails_sent === 1 ? "" : "s"} · ${p.emails_opened} opened`
          : `${p.emails_sent} email${p.emails_sent === 1 ? "" : "s"}`,
    })
  }
  const nextFollowUp = ((p as unknown) as { next_follow_up_at?: string | null })?.next_follow_up_at
  if (nextFollowUp) {
    pills.push({ key: "followup", label: `Follow-up ${formatDateShort(nextFollowUp).split(" · ")[0]}` })
  }
  if (p?.unsubscribed_at) pills.push({ key: "unsubscribed", label: "Unsubscribed", tone: "danger" })
  if (p?.bounced_at) pills.push({ key: "bounced", label: "Bounced", tone: "danger" })
  if (p?.complained_at) pills.push({ key: "complained", label: "Complained", tone: "danger" })

  if (pills.length === 0) return null

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {pills.map((pill) => (
        <span
          key={pill.key}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
            background: pill.tone === "danger" ? "#fef2f2" : "#f5f5f4",
            color: pill.tone === "danger" ? "#b91c1c" : "#1c1c1a",
            border: pill.tone === "danger" ? "1px solid #fecaca" : "1px solid transparent",
          }}
        >
          {pill.dot && <span className={`inline-block h-1.5 w-1.5 rounded-full ${pill.dot}`} />}
          {pill.label}
        </span>
      ))}
    </div>
  )
}

// ── Sequence 3-slot strip ──────────────────────────────────────────────

function SequenceStrip({ steps }: { steps: ProspectSequenceStep[] }) {
  if (steps.length === 0) return null
  const stepPill: Record<ProspectSequenceStep["status"], { dot: string; label: string }> = {
    sent:      { dot: "bg-emerald-500", label: "sent" },
    queued:    { dot: "bg-[#2563eb]",   label: "queued" },
    paused:    { dot: "bg-amber-400",   label: "paused" },
    finished:  { dot: "bg-emerald-500", label: "finished" },
    cancelled: { dot: "bg-[#a1a1a0]",   label: "cancelled" },
    failed:    { dot: "bg-red-500",     label: "retrying" },
    missing:   { dot: "bg-[#e5e5e4]",   label: "not started" },
  }
  return (
    <div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#a1a1a0",
        }}
      >
        Sequence
      </span>
      <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "flex-start" }}>
        {steps.map((step) => {
          const pill = stepPill[step.status]
          return (
            <div key={step.template} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                <span style={{ fontSize: 11, color: "#6b6b68" }}>{pill.label}</span>
              </div>
              <p style={{ fontSize: 12, color: "#1c1c1a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {step.label}
              </p>
              {step.timestamp && (
                <p style={{ fontSize: 10, color: "#a1a1a0", margin: "2px 0 0" }}>
                  {formatDateShort(step.timestamp).split(" · ")[0]}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Merged stream ──────────────────────────────────────────────────────

type StreamRow =
  | { kind: "stage"; ts: string; label: string; dot: string; key: string }
  | { kind: "event"; ts: string; event: ProspectEvent; key: string }

function TimelineStream({ bundle }: { bundle: Bundle }) {
  const prospect = bundle.prospect
  const isInvite = prospect?.source === "invites"

  // Lifecycle stages: replicated from ContactDetailBody, one row per
  // reached stage. Fictional as "events" (they're derived from prospect
  // columns, not the events table) but rendering them inline reads
  // honestly as chapter dividers.
  const initialStatus = (isInvite ? "contacted" : "prospect") as ProspectStatus
  const firstSentAt = bundle.sequence
    .filter((s) => s.status === "sent" && s.timestamp)
    .map((s) => s.timestamp as string)
    .sort()[0] ?? null
  const stageDefs: Array<{ label: string; ts: string | null; status: ProspectStatus }> = prospect
    ? [
        { label: isInvite ? "Invited" : "Prospect", ts: prospect.created_at, status: initialStatus },
        { label: "Contacted", ts: firstSentAt ?? prospect.last_email_sent_at, status: "contacted" },
        { label: "Visitor", ts: prospect.landing_visited_at, status: "visitor" },
        { label: "Signup", ts: prospect.signed_up_at, status: "signup" },
        { label: "Created", ts: prospect.company_created_at, status: "company" },
        { label: "Listed", ts: (prospect as any).converted_at, status: "active" },
      ]
    : []
  const stageRows: StreamRow[] = stageDefs
    .filter((s): s is { label: string; ts: string; status: ProspectStatus } => Boolean(s.ts))
    .map((s) => ({ kind: "stage", ts: s.ts, label: s.label, dot: STATUS_CONFIG[s.status].dot, key: `stage-${s.status}` }))

  // Sequence sends folded in as event rows via synthetic prospect_event
  // shape. Only 'sent' steps have a real timestamp.
  const sequenceRows: StreamRow[] = bundle.sequence
    .filter((s) => s.status === "sent" && s.timestamp)
    .map((s) => ({
      kind: "event" as const,
      ts: s.timestamp as string,
      key: `seq-${s.template}`,
      event: {
        id: `synthetic-seq-${s.template}`,
        prospect_id: prospect?.id ?? "",
        event_type: "email.sent",
        created_at: s.timestamp as string,
        metadata: { template: s.template, label: s.label },
      } as ProspectEvent,
    }))

  // Inbound emails folded in the same way ContactDetailBody does.
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

  // Synthetic invited/listed events (parity with ContactDetailBody).
  const syntheticRows: StreamRow[] = []
  if (isInvite && bundle.inviteContext && (bundle.inviteContext.project || bundle.inviteContext.inviter) && prospect) {
    syntheticRows.push({
      kind: "event",
      ts: prospect.created_at,
      key: "synth-invited",
      event: {
        id: `synthetic-company-invited-${prospect.id}`,
        prospect_id: prospect.id,
        event_type: "company_invited",
        created_at: prospect.created_at,
        metadata: {
          project: bundle.inviteContext.project,
          inviter: bundle.inviteContext.inviter,
        },
      } as ProspectEvent,
    })
  }
  const convertedAt = (prospect as any)?.converted_at as string | null | undefined
  if (convertedAt && prospect) {
    syntheticRows.push({
      kind: "event",
      ts: convertedAt,
      key: "synth-listed",
      event: {
        id: `synthetic-prospect-listed-${prospect.id}`,
        prospect_id: prospect.id,
        event_type: "prospect.listed",
        created_at: convertedAt,
        metadata: {},
      } as ProspectEvent,
    })
  }

  // Drop `replied` (redundant with email.received) and hydrate
  // admin_replied bodies — mirrors ContactDetailBody's cleanup.
  const inboundById = new Map(bundle.inboundEmails.map((m) => [m.id, m]))
  const enrichedEvents = bundle.events
    .filter((ev) => ev.event_type !== "replied")
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

  // De-dupe the coarse status_changed rows that fire alongside the
  // specific lifecycle events. Same rule ContactDetailBody uses (60s
  // window).
  const lifecycleTimes = new Set<number>()
  for (const ev of enrichedEvents) {
    if (ev.event_type === "prospect.signed_up" || ev.event_type === "prospect.company_created") {
      lifecycleTimes.add(new Date(ev.created_at).getTime())
    }
  }
  if (convertedAt) lifecycleTimes.add(new Date(convertedAt).getTime())
  const nearLifecycle = (ts: string) => {
    const t = new Date(ts).getTime()
    for (const key of lifecycleTimes) if (Math.abs(t - key) < 60_000) return true
    return false
  }
  const eventRows: StreamRow[] = enrichedEvents
    .filter((ev) => !(ev.event_type === "status_changed" && nearLifecycle(ev.created_at)))
    .map((ev) => ({ kind: "event" as const, ts: ev.created_at, key: ev.id, event: ev }))

  const rows: StreamRow[] = [...stageRows, ...sequenceRows, ...inboundRows, ...syntheticRows, ...eventRows]
    .sort((a, b) => b.ts.localeCompare(a.ts))

  if (rows.length === 0) {
    return (
      <div>
        <SectionLabel>Activity</SectionLabel>
        <p style={{ fontSize: 12, color: "#a1a1a0", margin: "8px 0 0" }}>No events yet.</p>
      </div>
    )
  }

  return (
    <div>
      <SectionLabel>Activity</SectionLabel>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) =>
          row.kind === "stage" ? (
            <StageDivider key={row.key} label={row.label} ts={row.ts} dot={row.dot} />
          ) : (
            <EventHistoryRow key={row.key} event={row.event} />
          ),
        )}
      </div>
    </div>
  )
}

function StageDivider({ label, ts, dot }: { label: string; ts: string; dot: string }) {
  return (
    <div
      className="grid items-center gap-2"
      style={{ gridTemplateColumns: "90px 1fr", padding: "6px 0", borderTop: "1px dashed #eeeeed" }}
    >
      <span style={{ fontSize: 11, color: "#a1a1a0", whiteSpace: "nowrap" }}>{formatDateShort(ts)}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: "#1c1c1a" }}>
          {label}
        </span>
      </span>
    </div>
  )
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
