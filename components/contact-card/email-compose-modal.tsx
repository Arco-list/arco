"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  generateComposeDraft,
  generateReplyDraft,
  getContactEmailThread,
  sendContactEmail,
  type ContactThreadItem,
} from "@/app/admin/inbox/actions"

/**
 * Email compose popup on the contact card — the inbox Respond popup's
 * design and machinery, reachable from Sales. Two modes, decided by
 * whether the contact has an inbound thread:
 *
 *   thread   — AI-drafted reply (generateReplyDraft, cached + Regenerate),
 *              previous emails under a disclosure, send goes through
 *              sendReply semantics (threaded, marks the row replied).
 *   fresh    — first-touch draft via generateComposeDraft (model also
 *              proposes the subject); sent unthreaded via Gmail and
 *              logged onto the prospect timeline as a manual compose.
 */
export function EmailComposeModal({
  email,
  emails,
  contactLabel,
  prospectId,
  onClose,
  onSent,
}: {
  email: string
  /** Full address set (primary + aliases) — thread detection covers all. */
  emails?: string[]
  contactLabel?: string | null
  prospectId?: string | null
  onClose: () => void
  onSent?: () => void
}) {
  const [thread, setThread] = useState<ContactThreadItem[]>([])
  const [latestInboundId, setLatestInboundId] = useState<string | null>(null)
  const [threadLoaded, setThreadLoaded] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [aiDraft, setAiDraft] = useState("")
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await getContactEmailThread(emails && emails.length > 0 ? emails : email)
      if (cancelled) return
      setThread(result.items)
      setLatestInboundId(result.latestInboundId)
      setThreadLoaded(true)
      setGenerating(true)
      if (result.latestInboundId) {
        const draft = await generateReplyDraft(result.latestInboundId)
        if (cancelled) return
        setGenerating(false)
        if (draft.success && draft.draft) {
          setAiDraft(draft.draft)
          setBody(draft.draft)
        }
      } else {
        // Fresh compose — draft a first-touch email and let the model
        // propose a subject.
        const draft = await generateComposeDraft({ email, prospectId })
        if (cancelled) return
        setGenerating(false)
        if (draft.success && draft.draft) {
          setAiDraft(draft.draft)
          setBody(draft.draft)
          if (draft.suggestedSubject) setSubject(draft.suggestedSubject)
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, emails?.join("|")])

  const hasThread = Boolean(latestInboundId)
  const firstName = (contactLabel?.trim().split(/\s+/)[0]) || email.split("@")[0]
  const hasEdited = body.trim().length > 0 && body.trim() !== aiDraft.trim()

  const handleRegenerate = async () => {
    setGenerating(true)
    setError(null)
    const draft = latestInboundId
      ? await generateReplyDraft(latestInboundId, { force: true, userEdit: hasEdited ? body : undefined })
      : await generateComposeDraft({ email, prospectId, subject, userEdit: hasEdited ? body : undefined })
    setGenerating(false)
    if (draft.success && draft.draft) {
      setAiDraft(draft.draft)
      setBody(draft.draft)
      if (!latestInboundId && !subject.trim() && (draft as { suggestedSubject?: string }).suggestedSubject) {
        setSubject((draft as { suggestedSubject?: string }).suggestedSubject!)
      }
    } else if (draft.error) {
      setError(draft.error)
    }
  }

  const handleSend = async () => {
    setSending(true)
    setError(null)
    const result = await sendContactEmail({ email, contactEmails: emails, prospectId, subject, bodyText: body })
    setSending(false)
    if (result.success) {
      toast.success("Email sent")
      onSent?.()
      onClose()
    } else {
      setError(result.error ?? "Send failed")
    }
  }

  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 900 }}>
      <div
        className="popup-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, width: "calc(100vw - 48px)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <div className="popup-header">
          <div className="min-w-0 flex-1">
            <h3 className="arco-section-title">Email {firstName}</h3>
            <p className="text-xs text-[#6b6b68] mt-0.5 truncate">
              <span className="text-[#a1a1a0]">{email}</span>
            </p>
          </div>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close" disabled={sending}>✕</button>
        </div>

        {thread.length > 0 && (
          <details className="mb-3 text-xs text-[#6b6b68]">
            <summary className="cursor-pointer text-[#016D75] hover:underline">
              Previous emails ({thread.length})
            </summary>
            <div
              className="mt-1.5 border border-[#e5e5e4] rounded-[3px]"
              style={{ maxHeight: 240, overflowY: "auto" }}
            >
              {thread.map((item, i) => (
                <div key={i} className="p-3 border-b border-[#eeeeed] last:border-b-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: item.direction === "out" ? "#016D75" : "#a1a1a0" }}>
                      {item.direction === "out" ? "Sent" : "Received"}
                      {item.subject ? ` · ${item.subject}` : ""}
                    </span>
                    <span className="text-[10px] text-[#a1a1a0] shrink-0 pl-2">
                      {new Date(item.at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap" style={{ lineHeight: 1.55, maxHeight: 120, overflowY: "auto" }}>
                    {item.body}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {threadLoaded && !hasThread && (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject…"
            disabled={sending}
            className="form-input"
            style={{ marginBottom: 10 }}
          />
        )}

        {threadLoaded && (
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">
              {hasThread ? "Your reply" : "Your email"} {generating ? "(generating…)" : hasEdited ? "(edited — refine will incorporate your changes)" : "(AI-drafted, edit before sending)"}
            </span>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={generating || sending}
              className="text-[11px] text-[#016D75] hover:underline disabled:opacity-50"
            >
              {generating ? (hasEdited ? "Refining…" : "Generating…") : hasEdited ? "Refine with my edits" : "Regenerate"}
            </button>
          </div>
        )}

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={generating || sending}
          placeholder={generating ? "Drafting reply in Niek's voice…" : "Write your email…"}
          style={{
            flex: 1,
            minHeight: 220,
            width: "100%",
            padding: 12,
            fontSize: 13,
            lineHeight: 1.6,
            fontFamily: "var(--font-sans)",
            color: "#1c1c1a",
            border: "1px solid var(--arco-rule, #e5e5e4)",
            borderRadius: 3,
            resize: "vertical",
            outline: "none",
          }}
        />

        {error && <p className="mt-2 text-xs text-red-700 break-all">{error}</p>}

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-[10px] text-[#a1a1a0]">
            {hasThread
              ? "Sends via Gmail, threaded to the original conversation. Signature added automatically."
              : "Sends from niek@arcolist.com via Gmail as a new conversation. Signature added automatically."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="h-9 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={generating || sending || !body.trim() || (!hasThread && !subject.trim())}
              className="h-9 px-4 text-xs font-medium rounded-[3px] text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--primary, #016D75)" }}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
