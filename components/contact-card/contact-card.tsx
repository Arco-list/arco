"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { getContactByEmail, type ContactByEmailData } from "@/lib/contacts/get-contact-by-email"
import { updateProfileByEmail } from "@/lib/contacts/update-profile-by-email"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { ProspectTimelineFused } from "./prospect-timeline-fused"

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
              {/* Email lives in the Details section below; used to
                  double up as a subtitle here. */}
              <h3 className="arco-section-title" style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>
                {displayName}
              </h3>
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
  const primaryProspect = data.prospects[0] ?? null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <DetailsSection data={data} />

      <Section label="Companies">
        {companies.length === 0 ? (
          <p style={{ fontSize: 12, color: "#a1a1a0", margin: 0 }}>
            Not linked to any company yet.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {companies.map((c) => (
              <CompanyRow key={c.companyId ?? c.label} entry={c} data={data} />
            ))}
          </ul>
        )}
      </Section>

      {primaryProspect ? (
        // ProspectTimelineFused now emits its own Activity + Timeline
        // sections; contact-card just drops it into the body stream.
        <ProspectTimelineFused prospectId={primaryProspect.id} email={data.email} />
      ) : (
        <Section label="Timeline">
          <p style={{ fontSize: 12, color: "#a1a1a0", margin: 0 }}>
            No prospect record on this email — nothing to time-line yet.
          </p>
        </Section>
      )}
    </div>
  )
}

// ── Details section (was "Account") ───────────────────────────────────
//
// Renamed to Details because it now surfaces more than the linked auth
// profile — the user-type pill and the editable name/email/phone list
// apply whether or not this email has ever signed up. When there's no
// linked profile the fields fall back to the prospect row.

function DetailsSection({ data }: { data: ContactByEmailData }) {
  const profile = data.profile
  const primaryProspect = data.prospects[0] ?? null
  const displayName = pickDisplayName(data)
  // Phone falls back to the prospect row so Sales-only contacts still
  // see their number and can edit it via the prospect update path.
  const phone = profile?.phone ?? primaryProspect?.phone ?? null

  const userTypePill = pickUserTypePill(data)

  // Domain of the first linked company. Preferred over the person's
  // own email host — matches how /admin/companies surfaces the field.
  const primaryCompanyId =
    data.companyContacts[0]?.company_id ??
    data.prospects.find((p) => p.company_id)?.company_id ??
    null
  const primaryCompany = primaryCompanyId ? data.companiesById[primaryCompanyId] : undefined
  const domain = primaryCompany?.domain ?? null

  // Optimistic local copies of the two editable fields. On save we
  // call updateProfileByEmail; on success the local value stays,
  // on error we revert. Router doesn't need to refresh — the panel
  // will re-hydrate the next time it's opened.
  const [displayNameLocal, setDisplayNameLocal] = useState(displayName)
  const [phoneLocal, setPhoneLocal] = useState<string | null>(phone)
  useEffect(() => { setDisplayNameLocal(displayName) }, [displayName])
  useEffect(() => { setPhoneLocal(phone) }, [phone])

  // Editable whenever we have SOMETHING to write to. The server-side
  // action picks the target: profile if the email has an auth account,
  // else the primary prospect row.
  const canEdit = Boolean(profile || primaryProspect)

  const saveName = useCallback(async (next: string) => {
    const trimmed = next.trim()
    if (trimmed === displayNameLocal.trim()) return
    const result = await updateProfileByEmail({
      email: data.email,
      full_name: trimmed || null,
    })
    if (result.success) {
      setDisplayNameLocal(trimmed)
      toast.success("Name updated")
    } else {
      setDisplayNameLocal(displayName)
      toast.error(result.error)
    }
  }, [data.email, displayName, displayNameLocal])

  const savePhone = useCallback(async (next: string | null) => {
    const trimmed = next?.trim() || null
    if ((trimmed ?? "") === (phoneLocal ?? "")) return
    const result = await updateProfileByEmail({ email: data.email, phone: trimmed })
    if (result.success) {
      setPhoneLocal(trimmed)
      toast.success("Phone updated")
    } else {
      setPhoneLocal(phone)
      toast.error(result.error)
    }
  }, [data.email, phone, phoneLocal])

  // Domain lives on the primary linked company. Same inline pattern
  // /admin/companies uses in DomainCell — direct browser-client write
  // via RLS, no dedicated server action needed.
  const [domainLocal, setDomainLocal] = useState<string | null>(domain)
  useEffect(() => { setDomainLocal(domain) }, [domain])
  const canEditDomain = Boolean(primaryCompanyId)
  const saveDomain = useCallback(async (next: string | null) => {
    if (!primaryCompanyId) return
    const trimmed = next?.trim().toLowerCase() || null
    if ((trimmed ?? "") === (domainLocal ?? "")) return
    const supabase = getBrowserSupabaseClient()
    const { error } = await supabase
      .from("companies")
      .update({ domain: trimmed } as { domain: string | null })
      .eq("id", primaryCompanyId)
    if (error) {
      setDomainLocal(domain)
      toast.error(error.message)
      return
    }
    setDomainLocal(trimmed)
    toast.success("Domain updated")
  }, [primaryCompanyId, domain, domainLocal])

  return (
    <Section label="Details">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <DetailField
          label="Role"
          value={userTypePill ? capitalize(userTypePill.label) : null}
          suffix={
            profile?.is_active === false ? (
              <span style={{ fontSize: 12, color: "#b91c1c" }}>· inactive</span>
            ) : null
          }
        />
        <DetailField
          label="Name"
          value={displayNameLocal}
          editable={canEdit}
          onSave={saveName}
        />
        <DetailField
          label="Email"
          value={data.email}
        />
        <DetailField
          label="Phone"
          value={phoneLocal}
          editable={canEdit}
          onSave={savePhone}
          inputType="tel"
        />
        <DetailField
          label="Domain"
          value={domainLocal}
          editable={canEditDomain}
          onSave={saveDomain}
        />
        <DetailField
          label="Source"
          value={primaryProspect?.source ? capitalize(primaryProspect.source) : null}
        />
      </div>
    </Section>
  )
}

function DetailField({
  label,
  value,
  editable = false,
  onSave,
  inputType = "text",
  suffix,
}: {
  label: string
  value: string | null
  editable?: boolean
  onSave?: (next: string) => void | Promise<void>
  inputType?: "text" | "tel" | "email"
  /** Rendered next to the value in read mode — used for
   *  read-only annotations like "· inactive" on the Role row. */
  suffix?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { setDraft(value ?? "") }, [value])
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = useCallback(() => {
    setEditing(false)
    if (!onSave) return
    if ((draft ?? "").trim() === (value ?? "").trim()) return
    void onSave(draft)
  }, [draft, onSave, value])

  const cancel = useCallback(() => {
    setDraft(value ?? "")
    setEditing(false)
  }, [value])

  return (
    <div
      className="grid items-baseline gap-2"
      style={{ gridTemplateColumns: "70px 1fr" }}
    >
      <span style={{ fontSize: 11, color: "#a1a1a0" }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            type={inputType}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") cancel()
            }}
            /* Mirrors DomainCell on /admin/companies: teal underline,
               transparent background, no border box. Padding, line
               height and border thickness are byte-for-byte the same
               as the read state below so the row doesn't jump when
               switching modes — only the border color changes. */
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              lineHeight: 1.5,
              color: "#1c1c1a",
              padding: 0,
              border: "none",
              borderBottom: "1px solid #016D75",
              borderRadius: 0,
              background: "transparent",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        ) : editable ? (
          /* Read state carries a transparent border-bottom of the same
             width so the box takes the same vertical space as the
             edit input. On hover the border tints subtly to hint the
             row is editable. */
          <button
            type="button"
            onClick={() => setEditing(true)}
            title={`Edit ${label.toLowerCase()}`}
            className="contact-card-editable"
            style={{
              flex: 1,
              minWidth: 0,
              display: "inline-flex",
              alignItems: "baseline",
              gap: 6,
              background: "transparent",
              border: "none",
              borderBottom: "1px solid transparent",
              borderRadius: 0,
              padding: 0,
              margin: 0,
              cursor: "pointer",
              textAlign: "left",
              fontSize: 12,
              lineHeight: 1.5,
              color: value ? "#1c1c1a" : "#a1a1a0",
              wordBreak: "break-all",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              {value ?? <span style={{ color: "#a1a1a0", fontStyle: "italic" }}>Add {label.toLowerCase()}…</span>}
              {suffix && <> {suffix}</>}
            </span>
            <span
              aria-hidden
              style={{ color: "#a1a1a0", lineHeight: 1, flexShrink: 0, display: "inline-flex" }}
            >
              <PencilIcon />
            </span>
          </button>
        ) : (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              lineHeight: 1.5,
              color: value ? "#1c1c1a" : "#a1a1a0",
              wordBreak: "break-all",
            }}
          >
            {value ?? "—"}
            {suffix && <> {suffix}</>}
          </span>
        )}
      </span>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Company row (styled like a mini profile card) ─────────────────────

function CompanyRow({ entry, data }: { entry: GroupedCompany; data: ContactByEmailData }) {
  const enriched = entry.companyId ? data.companiesById[entry.companyId] : undefined
  const label = enriched?.name ?? entry.label
  const logoUrl = enriched?.logo_url ?? null
  const initial = label.charAt(0).toUpperCase() || "?"
  const subtitleParts = [enriched?.primary_service_name ?? entry.role, enriched?.city].filter(Boolean)
  const subtitle = subtitleParts.join(" · ")
  const inner = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "#f5f5f4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" width={34} height={34} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 500, color: "#1c1c1a" }}>{initial}</span>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#1c1c1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: "#6b6b68", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
  return (
    <li>
      {entry.companyId ? (
        <Link
          href={`/admin/companies?company_id=${entry.companyId}`}
          style={{ display: "block", padding: 8, borderRadius: 6, textDecoration: "none" }}
        >
          {inner}
        </Link>
      ) : (
        <div style={{ padding: 8 }}>{inner}</div>
      )}
    </li>
  )
}

// ── User-type derivation ──────────────────────────────────────────────

function pickUserTypePill(data: ContactByEmailData): { label: string; dot: string } | null {
  const profile = data.profile
  const cc = data.companyContacts[0] ?? null
  // profile.admin_role wins — it names the tier explicitly.
  if (profile?.admin_role) {
    return { label: profile.admin_role.replace(/_/g, " "), dot: "bg-[#7c3aed]" }
  }
  // Otherwise, the most specific company-scoped role.
  if (cc?.role) {
    if (cc.role === "owner") return { label: "owner", dot: "bg-[#2563eb]" }
    if (cc.role === "admin") return { label: "company admin", dot: "bg-[#2563eb]" }
    if (cc.role === "member") return { label: "team member", dot: "bg-[#2563eb]" }
    if (cc.role === "contact") return { label: "contact", dot: "bg-[#f59e0b]" }
  }
  // No company role — if there's a profile at all they're at least a user.
  if (profile) {
    const types = profile.user_types ?? []
    if (types.includes("professional")) return { label: "professional", dot: "bg-[#2563eb]" }
    if (types.includes("client")) return { label: "homeowner", dot: "bg-[#2563eb]" }
    return { label: "user", dot: "bg-[#2563eb]" }
  }
  // Prospect only — no auth account, not on any team.
  if (data.prospects.length > 0) return { label: "prospect", dot: "bg-[#f59e0b]" }
  return null
}

function Section({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
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
        {action}
      </div>
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
