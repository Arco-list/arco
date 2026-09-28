"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  LINK_MARKER,
  OUTBOUND_SITUATIONS,
  TONE_INTENT,
  TONE_LABEL,
  outboundSituation,
  fillPlaceholders,
  type OutboundSituationId,
  type OutboundTone,
} from "@/lib/outbound/templates"
import type { OutboundSituationResolution } from "@/lib/outbound/resolve-situation"
import { COMPANY_STATUS_DOT_HEX, PROSPECT_STATUS_CONFIG } from "@/lib/sales/prospect-status"
import {
  previewOutboundLinkAction,
  resolveOutboundSituationAction,
  generateComposeDraft,
  generateReplyDraft,
  getContactEmailThread,
  sendContactEmail,
  type ContactThreadItem,
} from "@/app/admin/inbox/actions"

/**
 * The Outbound popup on the contact card. One popup, one motion.
 *
 * This used to be two: a Log popup that recorded an outbound touch
 * (type, outcome, when, notes, follow-up) and an Email popup that sent
 * one. Every field on the Log form asked the admin to describe by hand
 * something the product could already see. Sending the mail from here
 * IS the log — kind, outcome and timestamp are facts of the send, and
 * the mail itself is a better note than any note.
 *
 * WHY THIS IS THE ONLY WAY OUTBOUND GETS MEASURED. A template's CTA is
 * a claim link minted with channel 'outbound', so a click lands on
 * /claim and the funnel can follow Contacted → Pro Visitors → New Pros.
 * That chain exists only for mail sent through this popup; the same
 * words pasted into a personal mailbox arrive untracked and land in
 * Direct. Logging a call by hand recorded the touch and nothing after
 * it, which is why Outbound was a dead end in the funnel.
 *
 * Two modes, decided by whether the contact has an inbound thread:
 *
 *   thread   — AI-drafted reply (generateReplyDraft, cached + Regenerate),
 *              previous emails under a disclosure, send goes through
 *              sendReply semantics (threaded, marks the row replied).
 *   fresh    — template-steered draft via generateComposeDraft (model
 *              also proposes the subject); sent unthreaded via Gmail.
 *
 * Both log the send and both carry the CTA.
 */
/** The claim funnel this company qualifies for. Named as the rest of
 *  the admin names them, not as the enum spells them. */
const CHANNEL_LABEL: Record<"invite" | "showcase" | "outreach", string> = {
  invite: "Invite",
  showcase: "Showcase",
  outreach: "Outreach",
}

export function EmailComposeModal({
  email,
  emails,
  contactLabel,
  companyLabel,
  companyId,
  prospectId,
  companyContactId,
  onClose,
  onSent,
}: {
  email: string
  /** Full address set (primary + aliases) — thread detection covers all. */
  emails?: string[]
  contactLabel?: string | null
  companyLabel?: string | null
  /** The page the CTA points at. Without it a template sends untracked. */
  companyId?: string | null
  prospectId?: string | null
  /** Fallback log target for contacts with no prospect row. */
  companyContactId?: string | null
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
  const [resolution, setResolution] = useState<OutboundSituationResolution | null>(null)
  const [situationId, setSituationId] = useState<OutboundSituationId | null>(null)
  const [tone, setTone] = useState<OutboundTone>("cold")
  const template = outboundSituation(situationId)

  // Every ask this company's state allows. One entry means nothing to
  // choose, so the popup shows no pills at all — the common case.
  const choices: OutboundSituationId[] = resolution
    ? [resolution.situation, ...resolution.alternatives]
    : []

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // The company's state and the thread are independent questions;
      // ask them together so the draft waits on one round-trip, not two.
      const [result, resolved] = await Promise.all([
        getContactEmailThread(emails && emails.length > 0 ? emails : email),
        resolveOutboundSituationAction(companyId, email, prospectId),
      ])
      if (cancelled) return
      setThread(result.items)
      setLatestInboundId(result.latestInboundId)
      setThreadLoaded(true)
      setResolution(resolved)
      const picked = resolved ? outboundSituation(resolved.situation) : null
      if (picked) setSituationId(picked.id)
      setGenerating(true)

      if (result.latestInboundId) {
        const draft = await generateReplyDraft(result.latestInboundId)
        if (cancelled) return
        setGenerating(false)
        if (draft.success && draft.draft) {
          const next = picked ? ensureMarker(draft.draft) : draft.draft
          setAiDraft(next)
          setBody(next)
        }
      } else {
        // Fresh compose, written for the situation the state resolved
        // to. Without a company there is nothing to resolve, so the
        // model gets no brief and the mail simply goes out untracked.
        // Admin-written copy wins. The AI exists for situations nobody
        // has written yet, and for the Regenerate button — not to
        // overwrite a mail someone deliberately curated.
        if (picked && resolved) {
          setSubject(resolved.storedSubject ?? picked.subject)
          const filled = fillPlaceholders(resolved.storedBody, {
            voornaam: firstName,
            bedrijf: companyLabel ?? resolved.companyName ?? "je bedrijf",
          })
          setAiDraft(filled)
          setBody(ensureMarker(filled))
          setGenerating(false)
          return
        }
        if (picked) setSubject(picked.subject)
        const draft = await generateComposeDraft({
          email,
          prospectId,
          subject: picked?.subject,
          intent: picked ? `${TONE_INTENT["cold"]}\n\n${picked.intent}` : undefined,
        })
        if (cancelled) return
        setGenerating(false)
        if (draft.success && draft.draft) {
          const next = picked ? ensureMarker(draft.draft) : draft.draft
          setAiDraft(next)
          setBody(next)
          if (!picked && draft.suggestedSubject) setSubject(draft.suggestedSubject)
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, emails?.join("|"), companyId])

  // The body stays ONE string; the marker only decides where it is cut
  // for display. Two textareas writing into one value keeps the link's
  // position editable (move the paragraphs, the link moves with them)
  // without ever letting the link itself be typed over.
  // Paragraphs are what the link can sit BETWEEN, so they are the unit
  // a drag moves it across. Derived from the body on every render —
  // there is no second copy of the mail's structure to keep in step.
  const paragraphs = body.split(/\n\s*\n/)
  const markerBlock = paragraphs.findIndex((b) => b.trim() === LINK_MARKER)
  const proseParagraphs = paragraphs.filter((b) => b.trim() !== LINK_MARKER)
  const moveMarkerTo = (slot: number) => {
    const next = [...proseParagraphs]
    next.splice(slot, 0, LINK_MARKER)
    setBody(next.join("\n\n"))
  }

  const markerAt = body.indexOf(LINK_MARKER)
  const showLink = Boolean(template) && markerAt !== -1
  // Eat EXACTLY the paragraph break that separates the marker, never
  // more. The layout already puts air around the link row, so the
  // default \n\n must not show up as an empty line — but a blank line
  // the admin typed themselves is content, and stripping /\n+/ swallowed
  // it on the very next render, which made Enter look broken.
  const bodyBefore = showLink ? body.slice(0, markerAt).replace(/\n{1,2}$/, "") : body
  const bodyAfter = showLink ? body.slice(markerAt + LINK_MARKER.length).replace(/^\n{1,2}/, "") : ""
  const setSplit = (before: string, after: string) =>
    setBody(`${before}\n\n${LINK_MARKER}\n\n${after}`)

  // A ref callback fires on mount, not when a draft arrives from the
  // model — so without this the box stays one line tall around a
  // six-line mail, which is how an auto-growing field usually breaks.
  useLayoutEffect(() => {
    autoGrow(beforeRef.current)
    autoGrow(afterRef.current)
  })

  const hasThread = Boolean(latestInboundId)
  const firstName = (contactLabel?.trim().split(/\s+/)[0]) || email.split("@")[0]
  const hasEdited = body.trim().length > 0 && body.trim() !== aiDraft.trim()

  /**
   * A template always has a link, so the body always has somewhere to
   * put it. The model is asked to place the marker mid-mail; when it
   * does not, the end is the honest fallback — and pinning it here
   * rather than at send means the admin still SEES the link either way.
   */
  /**
   * Grow to fit, never scroll on your own. The body is one mail split
   * across two boxes with a fixed link between them; if each box kept
   * its own scrollbar the reader would be paging through three windows
   * to read one message. The wrapper below scrolls instead.
   */
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }
  const beforeRef = useRef<HTMLTextAreaElement | null>(null)
  const afterRef = useRef<HTMLTextAreaElement | null>(null)
  // While a drag is in flight the editor shows blocks instead of boxes.
  // Editing and dragging want different shapes — a textarea has no gaps
  // to aim at — and nobody types mid-drag, so the two never overlap.
  const [dragging, setDragging] = useState(false)
  const [dropSlot, setDropSlot] = useState<number | null>(null)

  // dragend fires on the SOURCE element, which the block view has just
  // unmounted — so it never reaches us. Without a global listener a drop
  // outside any slot would leave the editor stuck in block view, showing
  // a mail nobody can type in.
  useEffect(() => {
    if (!dragging) return
    const end = () => { setDragging(false); setDropSlot(null) }
    window.addEventListener("dragend", end)
    window.addEventListener("drop", end)
    return () => {
      window.removeEventListener("dragend", end)
      window.removeEventListener("drop", end)
    }
  }, [dragging])

  /**
   * Open where this link lands, in a new tab.
   *
   * The tab is opened SYNCHRONOUSLY and pointed afterwards: minting the
   * token is a round-trip, and a window.open that happens after an
   * await is a popup the browser blocks.
   */
  const handlePreview = async () => {
    if (!template || !companyId) return
    const tab = window.open("", "_blank", "noopener")
    const result = await previewOutboundLinkAction({
      companyId,
      email,
      situationId: template.id,
      creditId: resolution?.creditId ?? null,
    })
    if (result.url) {
      if (tab) tab.location.href = result.url
      else window.open(result.url, "_blank", "noopener")
    } else {
      tab?.close()
      toast.error(result.error ?? "Kon de link niet openen")
    }
  }

  /** The link itself — same row whether it sits between the two boxes
   *  or between two blocks mid-drag, so it cannot drift into two looks. */
  const linkRow = (grabbable: boolean) => (
    <div
      draggable={grabbable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        // Firefox refuses to start a drag without payload.
        e.dataTransfer.setData("text/plain", LINK_MARKER)
        // AFTER the current task, not during it. Switching to the block
        // view unmounts this element, and a drag source torn down inside
        // its own dragstart cancels the drag before it begins. By the
        // next tick the browser has its drag image and is committed.
        setTimeout(() => setDragging(true), 0)
      }}
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        padding: "6px 12px",
        fontSize: 13,
        lineHeight: 1.6,
        fontFamily: "var(--font-sans)",
        cursor: grabbable ? "grab" : "default",
        borderRadius: 3,
        background: dragging ? "rgba(1,109,117,0.06)" : "transparent",
      }}
      title={grabbable ? "Sleep de link tussen twee alinea's" : undefined}
    >
      {grabbable && (
        <span aria-hidden style={{ color: "#d4d4d3", fontSize: 11, letterSpacing: -1, lineHeight: 1 }}>⣿</span>
      )}
      <span>
        <a
          href="#"
          // The browser's own link-drag would fight the row's. Let the
          // grip and the row own dragging; this owns the click.
          draggable={false}
          onClick={(e) => { e.preventDefault(); void handlePreview() }}
          title={companyId ? "Open waar deze link heen gaat (telt niet mee)" : undefined}
          style={{
            color: "var(--primary, #016D75)",
            textDecoration: "underline",
            cursor: companyId ? "pointer" : "default",
          }}
        >
          {template?.cta}
        </a>
        {companyId ? (
          <span className="text-[11px] text-[#a1a1a0]" style={{ marginLeft: 8 }}>added on send</span>
        ) : (
          <span className="text-[11px] text-[#b45309]" style={{ marginLeft: 8 }}>
            geen company — deze mail gaat zonder link en telt niet als Outbound
          </span>
        )}
      </span>
    </div>
  )

  /** A gap the link can be dropped into. */
  const dropSlotAt = (slot: number) => (
    <div
      key={`slot-${slot}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropSlot(slot) }}
      onDragLeave={() => setDropSlot((cur) => (cur === slot ? null : cur))}
      onDrop={(e) => { e.preventDefault(); moveMarkerTo(slot); setDragging(false); setDropSlot(null) }}
      style={{
        height: 18,
        margin: "0 12px",
        borderTop: `2px solid ${dropSlot === slot ? "var(--primary, #016D75)" : "transparent"}`,
        transition: "border-color 0.12s",
      }}
    />
  )

  const ensureMarker = (text: string) => {
    if (text.includes(LINK_MARKER)) return text
    const blocks = text.replace(/\n+$/, "").split(/\n\s*\n/)
    // Land BEFORE the sign-off, not after it. A link under "Niek" reads
    // as a footer, which is the one place this link must never look
    // like it belongs.
    const at = blocks.length > 1 && /^Niek\b/i.test(blocks[blocks.length - 1]) ? blocks.length - 1 : blocks.length
    blocks.splice(at, 0, LINK_MARKER)
    return blocks.join("\n\n")
  }

  /**
   * Picking a template rewrites the mail. The subject is prefilled and
   * the body is redrafted against the template's brief — the point of a
   * template here is the purpose it gives the drafter, so keeping a
   * body written for another purpose would defeat it. An admin who has
   * already edited keeps their text: the pill only sets the subject.
   */
  const handlePickTemplate = async (id: OutboundSituationId, nextTone?: OutboundTone) => {
    const picked = outboundSituation(id)
    if (!picked) return
    const useTone = nextTone ?? tone
    setSituationId(id)
    if (hasEdited) { setSubject(picked.subject); return }

    // Switching the ask swaps in that situation's written mail. Tone
    // does NOT rewrite it — a curated mail is not something to throw
    // away on a toggle; it steers Regenerate, which is the button that
    // exists for asking the model for something else.
    if (id !== situationId) {
      setSubject(picked.subject)
      const filled = fillPlaceholders(picked.body, {
        voornaam: firstName,
        bedrijf: companyLabel ?? resolution?.companyName ?? "je bedrijf",
      })
      setAiDraft(filled)
      setBody(ensureMarker(filled))
      return
    }
    setSubject(picked.subject)
    setGenerating(true)
    setError(null)
    const draft = await generateComposeDraft({
      email, prospectId, subject: picked.subject,
      intent: `${TONE_INTENT[useTone]}\n\n${picked.intent}`,
    })
    setGenerating(false)
    if (draft.success && draft.draft) {
      const next = ensureMarker(draft.draft)
      setAiDraft(next)
      setBody(next)
    } else if (draft.error) {
      setError(draft.error)
    }
  }

  const handleRegenerate = async () => {
    setGenerating(true)
    setError(null)
    const draft = latestInboundId
      ? await generateReplyDraft(latestInboundId, { force: true, userEdit: hasEdited ? body : undefined })
      : await generateComposeDraft({
          email, prospectId, subject,
          intent: template ? `${TONE_INTENT[tone]}\n\n${template.intent}` : undefined,
          userEdit: hasEdited ? body : undefined,
        })
    setGenerating(false)
    if (draft.success && draft.draft) {
      const next = template ? ensureMarker(draft.draft) : draft.draft
      setAiDraft(next)
      setBody(next)
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
    const result = await sendContactEmail({
      email, contactEmails: emails, prospectId, subject, bodyText: body,
      situationId, tone, creditId: resolution?.creditId ?? null,
      companyId, companyContactId,
    })
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
              {companyLabel ? <>{companyLabel} <span className="text-[#d4d4d3]">·</span> </> : null}
              <span className="text-[#a1a1a0]">{email}</span>
            </p>
            {/* The two facts the mail is built from. Shown because a
                resolver that reads state silently is a resolver nobody
                can check — and the cost of a wrong read is a mail that
                asks an owner to claim their own page. */}
            {resolution && (
              <div className="flex items-center gap-1.5" style={{ marginTop: 7 }}>
                {resolution.status && (() => {
                  // Sales' own label and colour when the stage came from
                  // a prospect row, so the pill matches the funnel the
                  // admin was just looking at.
                  const cfg = resolution.statusIsProspect
                    ? PROSPECT_STATUS_CONFIG[resolution.status as keyof typeof PROSPECT_STATUS_CONFIG]
                    : null
                  const label = cfg?.label ?? resolution.status.charAt(0).toUpperCase() + resolution.status.slice(1)
                  const hex = cfg?.dotHex ?? COMPANY_STATUS_DOT_HEX[resolution.status] ?? "#a1a1a0"
                  return (
                    <span className="status-pill">
                      <span className="status-pill-dot" style={{ background: hex }} />
                      {label}
                    </span>
                  )
                })()}
                <span className="status-pill">{CHANNEL_LABEL[resolution.channel]}</span>
              </div>
            )}
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

        {threadLoaded && resolution && (
          <div style={{ marginBottom: 14 }}>
            {/* Did we speak? The one fact no query answers, so the one
                control that is always here. */}
            <div className="flex items-center gap-1.5" style={{ marginBottom: choices.length > 1 ? 8 : 0 }}>
              {(["called", "cold"] as OutboundTone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tone === t}
                  disabled={generating || sending}
                  // Tone is carried into Regenerate; it does not rewrite
                  // a mail already on screen.
                  onClick={() => setTone(t)}
                  className={`service-pill service-pill--bare${tone === t ? " service-pill--on" : ""}`}
                  style={{ fontSize: 12, padding: "5px 12px" }}
                >
                  {TONE_LABEL[t]}
                </button>
              ))}
            </div>

            {/* Only where the state leaves a real choice. */}
            {choices.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {choices.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={situationId === id}
                    disabled={generating || sending}
                    onClick={() => { if (id !== situationId) void handlePickTemplate(id) }}
                    className={`service-pill service-pill--bare${situationId === id ? " service-pill--on" : ""}`}
                    style={{ fontSize: 12, padding: "5px 12px" }}
                  >
                    {OUTBOUND_SITUATIONS[id].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {threadLoaded && !hasThread && (
          <>
            <label className="form-label" htmlFor="outbound-subject">Subject</label>
            <input
              id="outbound-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Waar gaat de mail over?"
              disabled={sending}
              className="form-input"
              style={{ marginBottom: 14 }}
            />
          </>
        )}

        {threadLoaded && (
          <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
            <label className="form-label" htmlFor="outbound-body" style={{ marginBottom: 0 }}>
              {hasThread ? "Reply" : "Email"}
              <span className="text-[11px] font-normal text-[#a1a1a0]" style={{ marginLeft: 6 }}>
                {generating ? "genereren…" : hasEdited ? "bewerkt" : "AI-concept"}
              </span>
            </label>
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

        {/* One scrolling surface. The link is a fixed row inside the
            flow rather than a panel beside it: it scrolls with the
            paragraphs around it because it IS one of them — the only
            one you cannot type over. */}
        <div
          style={{
            flex: 1,
            minHeight: 200,
            overflowY: "auto",
            border: "1px solid var(--arco-rule, #e5e5e4)",
            borderRadius: 3,
            background: "#fff",
          }}
        >
          {dragging ? (
            // Mid-drag: the mail as blocks, with a slot in every gap.
            // Read-only on purpose — this view exists to be aimed at.
            <div style={{ padding: "6px 0 12px" }}>
              {dropSlotAt(0)}
              {proseParagraphs.map((para, i) => (
                <div key={i}>
                  <div
                    style={{
                      padding: "0 12px",
                      fontSize: 13,
                      lineHeight: 1.6,
                      fontFamily: "var(--font-sans)",
                      color: "#1c1c1a",
                      whiteSpace: "pre-wrap",
                      opacity: 0.55,
                    }}
                  >
                    {para}
                  </div>
                  {dropSlotAt(i + 1)}
                </div>
              ))}
            </div>
          ) : (
            <>
              <textarea
                id="outbound-body"
                ref={beforeRef}
                value={bodyBefore}
                onChange={(e) => {
                  autoGrow(e.target)
                  if (showLink) setSplit(e.target.value, bodyAfter)
                  else setBody(e.target.value)
                }}
                disabled={generating || sending}
                placeholder={generating ? "Drafting in Niek's voice…" : "Write your email…"}
                style={{
                  display: "block",
                  width: "100%",
                  padding: showLink ? "12px 12px 0" : 12,
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontFamily: "var(--font-sans)",
                  color: "#1c1c1a",
                  border: "none",
                  background: "transparent",
                  resize: "none",
                  overflow: "hidden",
                  outline: "none",
                }}
              />

              {showLink && (
                <>
                  {linkRow(true)}
                  <textarea
                    ref={afterRef}
                    value={bodyAfter}
                    onChange={(e) => { autoGrow(e.target); setSplit(bodyBefore, e.target.value) }}
                    disabled={generating || sending}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "0 12px 12px",
                      fontSize: 13,
                      lineHeight: 1.6,
                      fontFamily: "var(--font-sans)",
                      color: "#1c1c1a",
                      border: "none",
                      background: "transparent",
                      resize: "none",
                      overflow: "hidden",
                      outline: "none",
                    }}
                  />
                </>
              )}
            </>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-red-700 break-all">{error}</p>}

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-[10px] text-[#a1a1a0]">
            {hasThread
              ? "Sends via Gmail, threaded to the original conversation."
              : "Sends from niek@arcolist.com via Gmail."}
            {!template && " Pick a template to add a tracked claim link."}
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
