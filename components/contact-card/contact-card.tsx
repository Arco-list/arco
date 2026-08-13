"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import { toast } from "sonner"
import { getContactByEmail, type ContactByEmailData } from "@/lib/contacts/get-contact-by-email"
import { getContactByProspectId } from "@/lib/contacts/get-contact-by-prospect"
import { updateProfileByEmail } from "@/lib/contacts/update-profile-by-email"
import { updateProspectById } from "@/lib/contacts/update-prospect-by-id"
import { removeProspectFromFunnel } from "@/app/admin/sales/actions"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { ProspectTimelineFused, TransactionalOnlyTimeline } from "./prospect-timeline-fused"
import { LogOutboundModal } from "@/app/admin/sales/log-outbound-modal"

/**
 * Shared Contact Card — right-anchored slide-over. The single detail
 * surface for a contact on /admin/sales: row clicks, contact clicks
 * and the +N-more picker all open this panel (the old center-modal
 * was retired). Per-contact actions live here too: Log outbound,
 * sequence transitions, and Remove from funnel (bottom link).
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
  /** Alternative to email — opens the panel keyed on a prospect_id
   *  when the row has no email yet (Sales rows for Showcase prospects
   *  inserted with an empty-string email placeholder). Card lets the
   *  rep add the address in place; on save, parent flips the URL. */
  prospectId?: string | null
  /** Called when the panel just wrote an email onto a prospect that
   *  previously had none. Parent should swap the URL from
   *  ?contact=prospect:<id> to ?contact=<newEmail> so the card
   *  re-hydrates via the email discovery layer. */
  onEmailAssigned?: (newEmail: string) => void
  /** Called after the contact's prospect row was removed from the sales
   *  funnel via the panel's bottom link. Parent should close the panel
   *  and refresh its list so the row disappears. */
  onRemoved?: () => void
  /** When provided AND the contact has a linked auth profile, the
   *  footer shows a "Delete user" link that hands the profile id back
   *  to the host page — /admin/users passes its existing
   *  check-requirements + confirm-dialog flow here. Deletion itself
   *  never runs from inside the card. */
  onDeleteUser?: (userId: string) => void
  onClose: () => void
}

export function ContactCard({ email, prospectId, onEmailAssigned, onRemoved, onDeleteUser, onClose }: Props) {
  const [state, setState] = useState<{
    kind: "idle" | "loading" | "error" | "ready"
    data?: ContactByEmailData
    error?: string
  }>({ kind: "idle" })

  const isOpen = Boolean(email || prospectId)

  useEffect(() => {
    if (!isOpen) {
      setState({ kind: "idle" })
      return
    }
    let cancelled = false
    setState({ kind: "loading" })
    const load = email
      ? getContactByEmail(email)
      : getContactByProspectId(prospectId!)
    load.then((result) => {
      if (cancelled) return
      if (result.success) setState({ kind: "ready", data: result.data })
      else setState({ kind: "error", error: result.error })
    })
    return () => { cancelled = true }
  }, [email, prospectId, isOpen])

  // Esc closes; also traps double-close in prod. Registered only when
  // the panel is actually open so it doesn't fight with other keyboard
  // shortcuts on the underlying page.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

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
        aria-label={`Contact ${email ?? prospectId ?? ""}`}
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
          {state.kind === "ready" && data && (
            <CardBody
              data={data}
              prospectIdFromUrl={prospectId ?? null}
              onEmailAssigned={onEmailAssigned}
              onRemoved={onRemoved}
              onDeleteUser={onDeleteUser}
            />
          )}
        </div>
      </aside>
    </>
  )
}

function CardBody({
  data,
  prospectIdFromUrl,
  onEmailAssigned,
  onRemoved,
  onDeleteUser,
}: {
  data: ContactByEmailData
  prospectIdFromUrl: string | null
  onEmailAssigned?: (newEmail: string) => void
  onRemoved?: () => void
  onDeleteUser?: (userId: string) => void
}) {
  const companies = groupByCompany(data)
  const primaryProspect = data.prospects[0] ?? null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <DetailsSection
        data={data}
        prospectIdFromUrl={prospectIdFromUrl}
        onEmailAssigned={onEmailAssigned}
      />

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
        // Pass contact + company + phone through so LogOutboundModal
        // (rendered inside Fused) doesn't need to refetch them.
        <ProspectTimelineFused
          prospectId={primaryProspect.id}
          email={data.email}
          emails={[data.email, ...data.aliases]}
          contactLabel={pickDisplayName(data)}
          companyLabel={primaryProspect.company_name ?? data.companiesById[primaryProspect.company_id ?? ""]?.name ?? null}
          contactPhone={data.profile?.phone ?? primaryProspect.phone ?? null}
        />
      ) : (
        // No prospect record — still show transactional sends (magic
        // links, project status, welcome…) so signed-up users who never
        // went through the funnel get a timeline too. Log outbound stays
        // available via the company-contact path when one exists.
        <NoProspectTimeline data={data} />
      )}

      <CardFooter
        prospectId={primaryProspect?.id ?? null}
        profileId={data.profile?.id ?? null}
        onRemoved={onRemoved}
        onDeleteUser={onDeleteUser}
      />
    </div>
  )
}

/** Role-specific removal footer.
 *
 *  Prospect in the sales funnel → "Remove from funnel": one-click soft
 *  removal (prospect row → status removed; a linked auth profile is
 *  untouched).
 *
 *  Linked auth profile → "Delete user": only rendered when the host
 *  page supplies onDeleteUser. The link just hands the profile id back;
 *  /admin/users runs its existing deletion-requirements check + confirm
 *  dialog. Pages without that flow (Sales) don't pass the handler, so
 *  the link doesn't render there. */
function CardFooter({
  prospectId,
  profileId,
  onRemoved,
  onDeleteUser,
}: {
  prospectId: string | null
  profileId: string | null
  onRemoved?: () => void
  onDeleteUser?: (userId: string) => void
}) {
  const [pending, setPending] = useState(false)
  const showRemove = Boolean(prospectId)
  const showDelete = Boolean(profileId && onDeleteUser)
  if (!showRemove && !showDelete) return null

  const linkStyle = (disabled: boolean): CSSProperties => ({
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 12,
    color: "#dc2626",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  })

  return (
    <div
      style={{
        borderTop: "1px solid #eeeeed",
        paddingTop: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      {showRemove && prospectId && (
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true)
            const result = await removeProspectFromFunnel(prospectId)
            setPending(false)
            if (result.success) {
              toast.success("Contact removed from funnel")
              onRemoved?.()
            } else {
              toast.error(result.error ?? "Failed to remove contact")
            }
          }}
          style={linkStyle(pending)}
        >
          {pending ? "Removing…" : "Remove from funnel"}
        </button>
      )}
      {showDelete && profileId && onDeleteUser && (
        <button
          type="button"
          onClick={() => onDeleteUser(profileId)}
          style={linkStyle(false)}
        >
          Delete user
        </button>
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

function DetailsSection({
  data,
  prospectIdFromUrl,
  onEmailAssigned,
}: {
  data: ContactByEmailData
  prospectIdFromUrl: string | null
  onEmailAssigned?: (newEmail: string) => void
}) {
  const profile = data.profile
  const primaryProspect = data.prospects[0] ?? null
  const displayName = pickDisplayName(data)
  // Phone falls back to the prospect row so Sales-only contacts still
  // see their number and can edit it via the prospect update path.
  const phone = profile?.phone ?? primaryProspect?.phone ?? null

  // Email is editable for prospect-only contacts: the add-in-place flow
  // (opened by prospect_id, no email yet) AND correcting a wrong or
  // bounced address on an existing prospect. Never editable once the
  // contact has an auth profile — that email is their login identity.
  // Saving a changed address clears the prospect's bounce stamp server-
  // side (see updateProspectById), so the rep can correct + Restart the
  // sequence in one motion. Once saved, the parent flips the URL and
  // the card re-hydrates.
  const editProspectId = primaryProspect?.id ?? prospectIdFromUrl
  const canEditEmail = Boolean(editProspectId && !profile)
  const [emailLocal, setEmailLocal] = useState<string | null>(data.email || null)
  useEffect(() => { setEmailLocal(data.email || null) }, [data.email])

  const saveEmail = useCallback(async (next: string | null) => {
    const trimmed = next?.trim().toLowerCase() || null
    if ((trimmed ?? "") === (emailLocal ?? "").toLowerCase()) return
    if (!trimmed) {
      toast.error("Email required")
      return
    }
    if (!editProspectId) return
    const result = await updateProspectById({ prospectId: editProspectId, email: trimmed })
    if (result.success) {
      setEmailLocal(trimmed)
      toast.success("Email saved")
      onEmailAssigned?.(trimmed)
    } else {
      setEmailLocal(data.email || null)
      toast.error(result.error)
    }
  }, [data.email, emailLocal, onEmailAssigned, editProspectId])

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
          value={emailLocal}
          editable={canEditEmail}
          onSave={saveEmail}
          inputType="email"
        />
        <DetailField
          label="Phone"
          value={phoneLocal}
          editable={canEdit}
          onSave={savePhone}
          inputType="tel"
          suffix={
            phoneLocal ? (
              // tel: on macOS hands off to FaceTime, which relays the
              // call through a paired iPhone — one click from panel to
              // dial tone. Strip everything but digits and the leading +.
              <a
                href={`tel:${phoneLocal.replace(/[^+\d]/g, "")}`}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 rounded-full border border-[#016D75] text-[#016D75] text-[10px] font-medium px-2 py-0.5 leading-4 cursor-pointer hover:bg-[#f0f7f6] transition-colors no-underline"
              >
                Call
              </a>
            ) : null
          }
        />
        <DetailField
          label="Domain"
          value={domainLocal}
          editable={canEditDomain}
          onSave={saveDomain}
        />
        {data.aliases.length > 0 && (
          <div
            className="grid items-baseline gap-2"
            style={{ gridTemplateColumns: "70px 1fr" }}
          >
            <span style={{ fontSize: 11, color: "#a1a1a0" }}>Aliases</span>
            <span style={{ fontSize: 12, lineHeight: 1.5, color: "#1c1c1a", minWidth: 0, display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
              {data.aliases.map((alias) => (
                <a
                  key={alias}
                  href={`?contact=${encodeURIComponent(alias)}`}
                  style={{ color: "#016D75", textDecoration: "none", wordBreak: "break-all" }}
                  title={`Open card for ${alias}`}
                >
                  {alias}
                </a>
              ))}
            </span>
          </div>
        )}
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
  const router = useRouter()
  const enriched = entry.companyId ? data.companiesById[entry.companyId] : undefined
  const label = enriched?.name ?? entry.label
  const logoUrl = enriched?.logo_url ?? null
  const initial = label.charAt(0).toUpperCase() || "?"
  const subtitleParts = [enriched?.primary_service_name ?? entry.role, enriched?.city].filter(Boolean)
  const subtitle = subtitleParts.join(" · ")
  // Same link logic as the Sales/Companies tables: name → Arco company
  // page, arrow → external website (website first, domain fallback).
  const slug = enriched?.slug ?? null
  const externalRaw = enriched?.website ?? enriched?.domain ?? null
  const externalHref = externalRaw
    ? /^https?:\/\//i.test(externalRaw) ? externalRaw : `https://${externalRaw}`
    : null
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
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          {slug ? (
            <a
              href={`/professionals/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:underline"
              style={{ fontSize: 13, fontWeight: 500, color: "#1c1c1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}
            >
              {label}
            </a>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 500, color: "#1c1c1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {label}
            </span>
          )}
          {externalHref && (
            <a
              href={externalHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={externalHref}
              className="shrink-0 text-[#a2a29f] hover:text-[#016D75] transition-colors"
            >
              <ArrowUpRight size={13} />
            </a>
          )}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: "#6b6b68", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </div>
        )}
      </div>
      {entry.relationship && (
        <span style={{ fontSize: 11, color: "#6b6b68", flexShrink: 0 }}>
          {entry.relationship}
        </span>
      )}
    </div>
  )
  return (
    <li>
      {entry.companyId ? (
        // Click-div instead of a Link: the name and arrow inside are
        // real anchors now, and anchors can't nest.
        <div
          role="link"
          tabIndex={0}
          onClick={() => router.push(`/admin/companies?company_id=${entry.companyId}`)}
          onKeyDown={(e) => { if (e.key === "Enter") router.push(`/admin/companies?company_id=${entry.companyId}`) }}
          style={{ display: "block", padding: 8, borderRadius: 6, cursor: "pointer" }}
        >
          {inner}
        </div>
      ) : (
        <div style={{ padding: 8 }}>{inner}</div>
      )}
    </li>
  )
}

// ── Timeline for contacts without a prospect record ───────────────────
// The Log pill on Sales panels comes from ProspectTimelineFused, which
// needs a prospect. Contacts opened from Users/Companies without one
// (direct signups) log against their company_contacts row instead —
// LogOutboundModal already supports that path.
function NoProspectTimeline({ data }: { data: ContactByEmailData }) {
  const [logOpen, setLogOpen] = useState(false)
  const companyContact = data.companyContacts[0] ?? null
  const companyName = companyContact
    ? data.companiesById[companyContact.company_id]?.name ?? null
    : null
  return (
    <>
      <Section
        label="Timeline"
        action={
          companyContact ? (
            <button
              type="button"
              onClick={() => setLogOpen(true)}
              className="shrink-0 rounded-full border border-[#016D75] text-[#016D75] text-[10px] font-medium px-2 py-0.5 leading-4 cursor-pointer hover:bg-[#f0f7f6] transition-colors"
              title="Log outbound"
            >
              Log
            </button>
          ) : undefined
        }
      >
        <TransactionalOnlyTimeline emails={[data.email, ...data.aliases]} />
      </Section>
      {companyContact && (
        <LogOutboundModal
          open={logOpen}
          onOpenChange={setLogOpen}
          companyContactId={companyContact.id}
          contactLabel={pickDisplayName(data)}
          companyLabel={companyName ?? ""}
          contactEmail={data.email}
          contactPhone={data.profile?.phone ?? null}
        />
      )}
    </>
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
  /** How this person relates to the company — "Owner" / "Team member"
   *  (real membership, what /admin/users shows) vs "Contact" /
   *  "Prospect" (sales-side link only). Strongest relationship wins. */
  relationship: string | null
  prospectSummary: string | null
}

function contactRoleLabel(role: string): string {
  if (role === "owner") return "Owner"
  if (role === "admin") return "Company admin"
  if (role === "member") return "Team member"
  if (role === "contact") return "Contact"
  return capitalize(role)
}

// Merges membership rows (professionals / owner_id), company_contacts
// and prospect rows into a single per-company list. Membership is the
// strongest relationship and wins the label; sales-side links only
// label companies the person doesn't actually belong to. Untracked
// prospects (no company_id) become their own entry so the rep still
// sees them.
function groupByCompany(data: ContactByEmailData): GroupedCompany[] {
  const byId = new Map<string, GroupedCompany>()
  const orphaned: GroupedCompany[] = []

  for (const m of data.memberships) {
    byId.set(m.company_id, {
      companyId: m.company_id,
      label: m.company_name ?? "(unnamed company)",
      role: null,
      relationship: m.kind === "owner" ? "Owner" : "Team member",
      prospectSummary: null,
    })
  }

  for (const cc of data.companyContacts) {
    const key = cc.company_id
    const existing = byId.get(key)
    byId.set(key, {
      companyId: key,
      label: existing?.label ?? cc.company_name ?? "(unnamed company)",
      role: existing?.role ?? cc.role,
      relationship: existing?.relationship ?? contactRoleLabel(cc.role),
      prospectSummary: existing?.prospectSummary ?? null,
    })
  }

  for (const p of data.prospects) {
    const summary = formatProspectSummary(p)
    if (!p.company_id) {
      orphaned.push({
        companyId: null,
        label: p.contact_name?.trim() || "(prospect without company)",
        role: null,
        relationship: "Prospect",
        prospectSummary: summary,
      })
      continue
    }
    const existing = byId.get(p.company_id)
    byId.set(p.company_id, {
      companyId: p.company_id,
      label: existing?.label ?? p.company_name ?? "(unnamed company)",
      role: existing?.role ?? null,
      relationship: existing?.relationship ?? "Prospect",
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
