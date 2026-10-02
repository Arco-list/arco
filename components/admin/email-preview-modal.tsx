"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { sendTestEmail } from "@/app/admin/emails/actions"
import { templateDisplayName } from "@/lib/emails/template-names"

/**
 * One preview popup for every surface that previews a mail.
 *
 * There were two. /emails had the full one — real subject line, locale
 * toggle, Send test — and the Contact Card timeline had a thinner copy
 * with no subject and no test send. Clicking the same template in two
 * places showed two different windows, and only one of them could
 * answer "what does this actually say in the subject line".
 *
 * The thin copy also had the better close behaviour (Escape), so that
 * came along rather than being dropped on the way.
 *
 * SEND TEST GOES TO THE ADMIN, never to the contact whose card this is
 * open on. It is the same server action /emails calls, addressed to the
 * signed-in user — worth stating because this popup now opens from a
 * screen that is all about one specific recipient.
 */
export function EmailPreviewModal({
  template,
  companyId,
  email,
  initialLang = "en",
  onClose,
}: {
  /** Template id. May be an abstract queue id (visitor-nudge,
   *  listed-professionals…) — the preview route resolves it. */
  template: string
  /** The recipient's company, when known. Lets the route resolve an
   *  abstract id to the variant this company would actually receive
   *  instead of falling back to the default one. */
  companyId?: string | null
  /** The recipient's address, for the same reason: two of the four
   *  builders branch on it. */
  email?: string | null
  initialLang?: "en" | "nl"
  onClose: () => void
}) {
  const { user } = useAuth()
  const [lang, setLang] = useState<"en" | "nl">(initialLang)
  const [subject, setSubject] = useState<string | null>(null)
  // What the route resolved the request to. Differs from `template`
  // only for the abstract queue ids, where naming the placeholder would
  // tell the admin less than naming the mail that will land.
  const [resolved, setResolved] = useState<string>(template)
  const [isPending, startTransition] = useTransition()

  const params = new URLSearchParams({ template, lang })
  if (companyId) params.set("companyId", companyId)
  if (email) params.set("email", email)
  const previewSrc = `/admin/emails/preview?${params.toString()}`

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Subject + resolved id in one round trip, re-fetched on every locale
  // flip because both the subject and (for locale-branching templates)
  // the renderer can differ per language.
  useEffect(() => {
    let cancelled = false
    setSubject(null)
    fetch(`${previewSrc}&meta=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setSubject(typeof data.subject === "string" ? data.subject : null)
        if (typeof data.template === "string") setResolved(data.template)
      })
      .catch(() => { /* header just stays without a subject */ })
    return () => { cancelled = true }
  }, [previewSrc])

  const handleSendTest = () => {
    if (!user?.email) { toast.error("No email address found"); return }
    startTransition(async () => {
      const result = await sendTestEmail(resolved, user.email!)
      if (result.success) toast.success(`Test email sent to ${user.email}`)
      else toast.error(result.error ?? "Failed to send test email")
    })
  }

  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 800 }}>
      <div
        className="popup-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, padding: 0, maxHeight: "85vh", display: "flex", flexDirection: "column" }}
      >
        <div style={{
          padding: "16px 24px", background: "var(--arco-off-white)",
          borderRadius: "12px 12px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span className="text-sm font-medium text-[#1c1c1a]">
              {templateDisplayName(resolved)}
              {/* The timeline row you clicked carries the QUEUE's name;
                  this popup names the variant that will actually be
                  sent. Without this suffix the header looks like it
                  opened a different mail. */}
              {resolved !== template && (
                <span className="text-[#a1a1a0]" style={{ fontWeight: 400 }}>
                  {" · variant of "}{templateDisplayName(template)}
                </span>
              )}
            </span>
            {subject && (
              <span
                className="text-xs text-[#6b6b68] truncate"
                style={{ marginTop: 2 }}
                title={subject}
              >
                {subject}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Locale toggle — affects only the iframe render.
                Test send still uses the resolver. */}
            <div style={{ display: "inline-flex", border: "1px solid var(--arco-rule)", borderRadius: 3, overflow: "hidden", fontSize: 11 }}>
              {(["en", "nl"] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLang(loc)}
                  style={{
                    padding: "4px 10px",
                    background: lang === loc ? "var(--arco-black)" : "transparent",
                    color: lang === loc ? "#fff" : "var(--arco-mid-grey)",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: lang === loc ? 500 : 400,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {loc}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={isPending}
              className="arco-nav-text h-7 px-3 rounded-[3px] text-xs"
              style={{ background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}
              title={user?.email ? `Send this template to ${user.email}` : undefined}
            >
              {isPending ? "Sending..." : "Send test"}
            </button>
            <button type="button" className="popup-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <iframe
          src={previewSrc}
          style={{ width: "100%", flex: 1, minHeight: 500, border: "none", background: "#f5f5f4" }}
          title="Email preview"
        />
      </div>
    </div>
  )
}
