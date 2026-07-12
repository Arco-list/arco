"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getContactByEmail, type ContactByEmailData } from "@/lib/contacts/get-contact-by-email"
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
  type SalesContact,
} from "@/app/admin/sales/actions"
import { ContactDetailBody, type ContactDetailBundle } from "@/app/admin/sales/prospects-client"

/**
 * Shared Contact Card — right-anchored slide-over. Phase 2a folds the
 * detailed Lifecycle / Outreach Sequence / Activity sections into the
 * card by reusing ContactDetailBody from prospects-client. The old
 * center-modal path stays reachable from the +N-more menu on
 * /admin/sales; we'll retire it once this rendering has proven out
 * for a week (Phase 2b).
 *
 * Data model still keyed on normalized email. Timeline sub-bundle is
 * fetched for the FIRST prospect returned by getContactByEmail — same
 * primary-contact behavior /admin/sales uses.
 *
 * Explicitly NOT here yet:
 *   - Edit affordances (email, phone, role). Requires committing to
 *     a single authoritative write path across profiles /
 *     company_contacts / prospects.
 *   - Merge / relink UI for the email-1 vs email-2 case.
 *   - Reuse on /admin/companies or /admin/users.
 */

type Props = {
  email: string | null
  onClose: () => void
}

export function ContactCard({ email, onClose }: Props) {
  const [state, setState] = useState<{
    kind: "idle" | "loading" | "error" | "ready"
    data?: ContactByEmailData
    error?: string
  }>({ kind: "idle" })

  useEffect(() => {
    if (!email) {
      setState({ kind: "idle" })
      return
    }
    let cancelled = false
    setState({ kind: "loading" })
    getContactByEmail(email).then((result) => {
      if (cancelled) return
      if (result.success) setState({ kind: "ready", data: result.data })
      else setState({ kind: "error", error: result.error })
    })
    return () => { cancelled = true }
  }, [email])

  // Esc closes; also traps double-close in prod. Registered only when
  // the panel is actually open so it doesn't fight with other keyboard
  // shortcuts on the underlying page.
  useEffect(() => {
    if (!email) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [email, onClose])

  if (!email) return null

  const data = state.kind === "ready" ? state.data : undefined
  const displayName = pickDisplayName(data)
  const primaryPhone = data?.profile?.phone ?? null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.35)",
          zIndex: 700,
        }}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Contact ${email}`}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 100vw)",
          background: "#fff",
          boxShadow: "-20px 0 48px rgba(15, 23, 42, 0.16)",
          zIndex: 701,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <header style={{ padding: "20px 24px 16px", borderBottom: "1px solid #eeeeed" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 className="arco-section-title" style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>
                {displayName}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b6b68", wordBreak: "break-all" }}>
                {email}
                {primaryPhone && (
                  <>
                    <span style={{ color: "#d4d4d3" }}> · </span>
                    <span>{primaryPhone}</span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 20,
                color: "#a1a1a0",
                padding: 4,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </header>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          {state.kind === "loading" && (
            <p style={{ fontSize: 12, color: "#a1a1a0", margin: 0 }}>Loading…</p>
          )}
          {state.kind === "error" && (
            <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>
              Failed to load contact: {state.error}
            </p>
          )}
          {state.kind === "ready" && data && <CardBody data={data} />}
        </div>
      </aside>
    </>
  )
}

function CardBody({ data }: { data: ContactByEmailData }) {
  const companies = groupByCompany(data)
  const linkedProfile = data.profile
  const primaryProspect = data.prospects[0] ?? null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Section label="Account">
        {linkedProfile ? (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 12, color: "#1c1c1a" }}>
            <li>
              <strong>{[linkedProfile.first_name, linkedProfile.last_name].filter(Boolean).join(" ") || "—"}</strong>
              {linkedProfile.is_active === false && (
                <span style={{ marginLeft: 8, color: "#dc2626" }}>· inactive</span>
              )}
            </li>
            <li style={{ marginTop: 4, color: "#6b6b68" }}>Profile: {linkedProfile.id}</li>
          </ul>
        ) : (
          <p style={{ fontSize: 12, color: "#a1a1a0", margin: 0 }}>
            No signed-up account linked to this email.
          </p>
        )}
      </Section>

      <Section label="Companies">
        {companies.length === 0 ? (
          <p style={{ fontSize: 12, color: "#a1a1a0", margin: 0 }}>
            Not linked to any company yet.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {companies.map((c) => (
              <li
                key={c.companyId ?? c.label}
                style={{
                  border: "1px solid #eeeeed",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <strong style={{ color: "#1c1c1a" }}>
                    {c.companyId ? (
                      <Link
                        href={`/admin/companies?company_id=${c.companyId}`}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {c.label}
                      </Link>
                    ) : (
                      c.label
                    )}
                  </strong>
                  {c.role && <span style={{ color: "#6b6b68" }}>{c.role}</span>}
                </div>
                {c.prospectSummary && (
                  <p style={{ margin: "6px 0 0", color: "#6b6b68" }}>{c.prospectSummary}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section label="Timeline">
        {primaryProspect ? (
          <ProspectTimeline prospectId={primaryProspect.id} email={data.email} />
        ) : (
          <p style={{ fontSize: 12, color: "#a1a1a0", margin: 0 }}>
            No prospect record on this email — nothing to time-line yet.
          </p>
        )}
      </Section>
    </div>
  )
}

/**
 * Loads the same five parallel actions /admin/sales calls when it opens
 * the row popup, then hands them to ContactDetailBody with a synthetic
 * SalesContact. Only five fields on SalesContact are actually read by
 * ContactDetailBody (source, email, createdAt, lastEmailSentAt,
 * prospectId — verified by grep on the function body), so the rest are
 * filled from the Prospect row with safe zeros where the Prospect
 * type doesn't carry a value. The double-cast through unknown is the
 * price of not building a public SalesContact factory yet — Phase 2b.
 *
 * onPreviewEmail is a no-op for now; the "Preview template" affordance
 * is still reachable in the old modal via the +N-more menu. Same for
 * onEditManualLog / onDeleteManualLog, which are optional.
 */
function ProspectTimeline({ prospectId, email }: { prospectId: string; email: string }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; contact: SalesContact; bundle: ContactDetailBundle }
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

        const bundle: ContactDetailBundle = {
          prospect,
          events: eventsResult.events ?? [],
          sequence: sequenceResult.success ? sequenceResult.steps ?? [] : [],
          locale: sequenceResult.success ? sequenceResult.locale ?? null : null,
          inviteContext: inviteResult.success ? inviteResult.context ?? null : null,
          inboundEmails: inboundResult.emails ?? [],
        }

        const contact = synthesizeSalesContact(prospect, email, bundle.inboundEmails)
        setState({ kind: "ready", contact, bundle })
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
  return (
    <ContactDetailBody
      contact={state.contact}
      details={state.bundle}
      onPreviewEmail={() => { /* no-op — still available in the +N-more modal */ }}
    />
  )
}

function synthesizeSalesContact(
  prospect: Prospect | null,
  fallbackEmail: string,
  inboundEmails: InboundEmailForProspect[],
): SalesContact {
  // ContactDetailBody reads five fields off `contact`; every other
  // SalesContact field flows through to child components that we know
  // aren't wired for the card path yet, so populating them from the
  // Prospect row (or safe zeros) is enough for the current render.
  const p = prospect
  const synthetic = {
    prospectId: p?.id ?? "",
    email: p?.email ?? fallbackEmail,
    contactName: p?.contact_name ?? null,
    source: (p?.source as SalesContact["source"]) ?? "apollo",
    status: (p?.status as SalesContact["status"]) ?? "prospect",
    sequenceStatus: (p?.sequence_status as SalesContact["sequenceStatus"]) ?? "not_started",
    emailsSent: p?.emails_sent ?? 0,
    emailsDelivered: p?.emails_delivered ?? 0,
    emailsOpened: p?.emails_opened ?? 0,
    emailsClicked: p?.emails_clicked ?? 0,
    lastEmailSentAt: p?.last_email_sent_at ?? null,
    lastEmailOpenedAt: p?.last_email_opened_at ?? null,
    lastEmailClickedAt: p?.last_email_clicked_at ?? null,
    unsubscribedAt: p?.unsubscribed_at ?? null,
    bouncedAt: p?.bounced_at ?? null,
    complainedAt: p?.complained_at ?? null,
    createdAt: p?.created_at ?? new Date().toISOString(),
    updatedAt: p?.updated_at ?? p?.created_at ?? new Date().toISOString(),
    refCode: p?.ref_code ?? "",
    resolvedContact: {
      name: p?.contact_name ?? null,
      email: p?.email ?? fallbackEmail,
      avatarUrl: null,
      userId: p?.user_id ?? null,
    },
    lastOutboundAt: ((p as unknown) as { last_outbound_at?: string | null })?.last_outbound_at ?? null,
    nextFollowUpAt: ((p as unknown) as { next_follow_up_at?: string | null })?.next_follow_up_at ?? null,
    hasInboundEmail: inboundEmails.length > 0,
  }
  return synthetic as unknown as SalesContact
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#a1a1a0",
        }}
      >
        {label}
      </span>
      <div style={{ marginTop: 8 }}>{children}</div>
    </section>
  )
}

// ── helpers ────────────────────────────────────────────────────────────

function pickDisplayName(data: ContactByEmailData | undefined): string {
  if (!data) return "Contact"
  const p = data.profile
  const fromProfile = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim()
  if (fromProfile) return fromProfile
  const namedProspect = data.prospects.find((pr) => pr.contact_name?.trim())?.contact_name
  if (namedProspect) return namedProspect.trim()
  return data.email
}

type GroupedCompany = {
  companyId: string | null
  label: string
  role: string | null
  prospectSummary: string | null
}

// Merges prospect rows (may lack a companyId) and company_contacts
// rows into a single per-company list. Untracked prospects (no
// company_id) become their own entry so the rep still sees them.
function groupByCompany(data: ContactByEmailData): GroupedCompany[] {
  const byId = new Map<string, GroupedCompany>()
  const orphaned: GroupedCompany[] = []

  for (const cc of data.companyContacts) {
    const key = cc.company_id
    const existing = byId.get(key)
    const entry: GroupedCompany = {
      companyId: key,
      label: cc.company_name ?? "(unnamed company)",
      role: existing?.role ?? cc.role,
      prospectSummary: existing?.prospectSummary ?? null,
    }
    byId.set(key, entry)
  }

  for (const p of data.prospects) {
    const summary = formatProspectSummary(p)
    if (!p.company_id) {
      orphaned.push({
        companyId: null,
        label: p.contact_name?.trim() || "(prospect without company)",
        role: null,
        prospectSummary: summary,
      })
      continue
    }
    const existing = byId.get(p.company_id)
    byId.set(p.company_id, {
      companyId: p.company_id,
      label: p.company_name ?? existing?.label ?? "(unnamed company)",
      role: existing?.role ?? null,
      prospectSummary: existing?.prospectSummary
        ? `${existing.prospectSummary} · ${summary}`
        : summary,
    })
  }

  return [...byId.values(), ...orphaned]
}

function formatProspectSummary(p: ContactByEmailData["prospects"][number]): string {
  const bits: string[] = []
  bits.push(`prospect: ${p.status}`)
  if (p.sequence_status && p.sequence_status !== "not_started") bits.push(p.sequence_status)
  if (p.emails_sent && p.emails_sent > 0) bits.push(`${p.emails_sent} email${p.emails_sent === 1 ? "" : "s"}`)
  if (p.source) bits.push(`via ${p.source}`)
  return bits.join(" · ")
}
