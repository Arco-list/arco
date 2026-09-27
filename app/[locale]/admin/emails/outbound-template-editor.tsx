"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  EDITOR_CHANNELS,
  EDITOR_STATUSES,
  LINK_MARKER,
  OUTBOUND_SITUATIONS,
  situationsFor,
  statusNeedsChannel,
  type EditorChannel,
  type EditorStatus,
  type OutboundSituationId,
} from "@/lib/outbound/templates"
import { PROSPECT_STATUS_CONFIG } from "@/lib/sales/prospect-status"
import {
  getOutboundTemplateAction,
  resetOutboundTemplateAction,
  saveOutboundTemplateAction,
} from "./outbound-template-actions"

/**
 * The copy behind the Outbound popup, browsable by the state it is
 * sent to.
 *
 * NAVIGATE THE WAY THE FUNNEL THINKS. You do not look for "template
 * four", you look for "what does a listed firm get when I want more
 * projects" — so the path is status, then channel where channel
 * changes the answer, then the ask where the state leaves a choice.
 * Every path lands on one of the situation ids the resolver produces,
 * so what you edit here is exactly what that contact receives.
 *
 * SAVING STORES THE MAIL, not a brief. The Outbound popup opens with
 * this text verbatim, placeholders filled; Regenerate is still there
 * for when a particular recipient wants something else. Deleting the
 * override (Reset) falls back to the copy that ships in code, which is
 * why an empty table is a working state rather than a broken one.
 */


export function OutboundTemplateEditor({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<EditorStatus | null>(null)
  const [channel, setChannel] = useState<EditorChannel | null>(null)
  const [situationId, setSituationId] = useState<OutboundSituationId | null>(null)

  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isOverride, setIsOverride] = useState(false)

  const options = status ? situationsFor(status, channel) : []
  const needsChannel = status ? statusNeedsChannel(status) : false

  // One option means the path already decided; select it rather than
  // asking for a click that has only one answer.
  useEffect(() => {
    if (options.length === 1 && situationId !== options[0]) setSituationId(options[0])
    if (options.length === 0) setSituationId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, channel, options.length])

  useEffect(() => {
    if (!situationId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      const { template, error } = await getOutboundTemplateAction(situationId)
      if (cancelled) return
      setLoading(false)
      if (error || !template) {
        toast.error(error ?? "Kon de template niet laden")
        return
      }
      setSubject(template.subject)
      // No saved body yet: show the copy that ships in code. It becomes
      // an override the moment it is saved, and Reset deletes the row
      // to come back here.
      setBody(template.body ?? defaultBodyFor(situationId))
      setIsOverride(template.body !== null)
    })()
    return () => { cancelled = true }
  }, [situationId])

  const handleSave = async () => {
    if (!situationId) return
    setSaving(true)
    const result = await saveOutboundTemplateAction({ situationId, subject, body })
    setSaving(false)
    if (result.success) {
      setIsOverride(true)
      toast.success("Template opgeslagen")
    } else {
      toast.error(result.error ?? "Opslaan mislukt")
    }
  }

  const handleReset = async () => {
    if (!situationId) return
    if (!confirm("Terug naar de standaardtekst? Je bewerking gaat verloren.")) return
    setSaving(true)
    const result = await resetOutboundTemplateAction(situationId)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error ?? "Reset mislukt")
      return
    }
    setIsOverride(false)
    setBody(defaultBodyFor(situationId))
    setSubject(OUTBOUND_SITUATIONS[situationId].subject)
    toast.success("Terug naar de standaardtekst")
  }

  const pill = (label: string, on: boolean, onClick: () => void, dotHex?: string) => (
    <button
      key={label}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`service-pill service-pill--bare${on ? " service-pill--on" : ""}`}
      style={{ fontSize: 12, padding: "5px 12px" }}
    >
      {dotHex && (
        <span
          style={{ width: 7, height: 7, borderRadius: "50%", background: dotHex, marginRight: 7, display: "inline-block" }}
        />
      )}
      {label}
    </button>
  )

  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 900 }}>
      <div
        className="popup-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 680, width: "calc(100vw - 48px)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <div className="popup-header">
          <div className="min-w-0 flex-1">
            <h3 className="arco-section-title">Outreach emails</h3>
            <p className="text-xs text-[#6b6b68] mt-0.5">
              De tekst achter de Outbound pop-up. Kies een status om te beginnen.
            </p>
          </div>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, paddingRight: 2 }}>
          {/* Status */}
          <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 10 }}>
            {EDITOR_STATUSES.map((s) =>
              pill(
                s.label,
                status === s.id,
                () => {
                  setStatus(s.id)
                  setChannel(null)
                  setSituationId(null)
                },
                PROSPECT_STATUS_CONFIG[s.id === "owned" ? "owned" : s.id === "listed" ? "active" : s.id]?.dotHex,
              ),
            )}
          </div>

          {/* Channel — only where it changes which mail is sent. */}
          {status && needsChannel && (
            <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 10 }}>
              {EDITOR_CHANNELS.map((c) =>
                pill(c.label, channel === c.id, () => { setChannel(c.id); setSituationId(null) }),
              )}
            </div>
          )}

          {/* The ask, where the state leaves more than one. */}
          {options.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 10 }}>
              {options.map((id) =>
                pill(OUTBOUND_SITUATIONS[id].label, situationId === id, () => setSituationId(id)),
              )}
            </div>
          )}

          {!situationId && (
            <p className="text-xs text-[#a1a1a0]" style={{ marginTop: 18 }}>
              {status && needsChannel && !channel
                ? "Kies een kanaal om de mail te zien."
                : "Kies een status om de mail te zien."}
            </p>
          )}

          {situationId && (
            <div style={{ marginTop: 16 }}>
              <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
                <label className="form-label" htmlFor="tpl-subject" style={{ marginBottom: 0 }}>
                  Subject
                </label>
                <span className="text-[11px] text-[#a1a1a0]">
                  {loading ? "laden…" : isOverride ? "aangepast" : "standaardtekst"}
                </span>
              </div>
              <input
                id="tpl-subject"
                className="form-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loading || saving}
                style={{ marginBottom: 14 }}
              />

              <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
                <label className="form-label" htmlFor="tpl-body" style={{ marginBottom: 0 }}>Email</label>
                <span className="text-[11px] text-[#a1a1a0]">
                  {"{{voornaam}} · {{bedrijf}} · "}
                  <span style={{ color: "var(--primary, #016D75)" }}>{LINK_MARKER}</span>
                  {" = de link"}
                </span>
              </div>
              <textarea
                id="tpl-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={loading || saving}
                style={{
                  width: "100%",
                  minHeight: 260,
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
            </div>
          )}
        </div>

        {situationId && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || !isOverride}
              className="text-[11px] text-[#a1a1a0] hover:text-[#6b6b68] hover:underline disabled:opacity-40"
            >
              Terug naar standaardtekst
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
              >
                Sluiten
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading || !subject.trim() || !body.trim()}
                className="h-9 px-4 text-xs font-medium rounded-[3px] text-white transition-colors disabled:opacity-50"
                style={{ background: "var(--primary, #016D75)" }}
              >
                {saving ? "Opslaan…" : "Opslaan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** No override saved: show the copy that ships in code. */
function defaultBodyFor(id: OutboundSituationId): string {
  return OUTBOUND_SITUATIONS[id].body
}
