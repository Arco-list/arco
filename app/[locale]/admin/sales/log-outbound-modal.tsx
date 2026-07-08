"use client"

import { useEffect, useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  logOutboundContact,
  updateOutboundLog,
  type OutboundKind,
  type OutboundOutcome,
} from "./log-outbound-actions"
import { logOutboundForCompanyContactAction } from "@/app/admin/companies/actions"

export type LogOutboundInitialValues = {
  logId: string
  kind: OutboundKind
  outcome: OutboundOutcome | null
  occurredAt: string // ISO
  body: string | null
  nextFollowUpAt: string | null // ISO
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** One of `prospectId` or `companyContactId` must be provided. Sales
   *  hits the prospects-side path (writes outbound_contact_log with
   *  prospect_id); Companies passes companyContactId, which routes to
   *  the company-side action that writes company_contact_id on the
   *  same table. Both share the outbound_contact_log row shape. */
  prospectId?: string
  companyContactId?: string
  contactLabel: string
  companyLabel: string
  contactEmail?: string | null
  contactPhone?: string | null
  contactAvatarUrl?: string | null
  /** When present, the modal switches to edit mode: title + submit label
   *  update, form fields prefill from the passed values, and Save calls
   *  updateOutboundLog against `initialValues.logId` instead of
   *  logOutboundContact. */
  initialValues?: LogOutboundInitialValues | null
  onLogged?: () => void
}

const KIND_OPTIONS: Array<{ value: OutboundKind; label: string }> = [
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "note", label: "Note" },
]

const OUTCOME_OPTIONS: Array<{ value: OutboundOutcome; label: string }> = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
  { value: "no_answer", label: "No answer" },
]

type FollowUpPreset = "tomorrow" | "in_3_days" | "in_1_week"
const FOLLOW_UP_PRESETS: Array<{ value: FollowUpPreset; label: string; days: number }> = [
  { value: "tomorrow", label: "Tomorrow", days: 1 },
  { value: "in_3_days", label: "In 3 days", days: 3 },
  { value: "in_1_week", label: "In 1 week", days: 7 },
]

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toDateInputValue(d)
}

function pillClass(selected: boolean): string {
  return [
    "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
    selected
      ? "bg-[#1c1c1a] text-white border-[#1c1c1a]"
      : "bg-white text-[#6b6b68] border-[#e5e5e4] hover:border-[#a1a1a0] hover:text-[#1c1c1a]",
  ].join(" ")
}

export function LogOutboundModal({
  open,
  onOpenChange,
  prospectId,
  companyContactId,
  contactLabel,
  companyLabel,
  contactEmail,
  contactPhone,
  contactAvatarUrl,
  initialValues,
  onLogged,
}: Props) {
  const isEdit = !!initialValues
  const [kind, setKind] = useState<OutboundKind>("call")
  const [outcome, setOutcome] = useState<OutboundOutcome>("positive")
  const [whenIsNow, setWhenIsNow] = useState(true)
  const [whenValue, setWhenValue] = useState(() => toLocalInputValue(new Date()))
  const [body, setBody] = useState("")
  const [nextFollowUp, setNextFollowUp] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // Tracks whether the current nextFollowUp value was set by the no_answer
  // auto-prefill so the rep can override it by clicking another preset or
  // typing a custom date without us re-applying it on next render.
  const [autoPrefilled, setAutoPrefilled] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initialValues) {
      // Edit mode: prefill from the existing log row + prospects
      // next_follow_up_at. `whenIsNow` off — otherwise the created_at we
      // just prefilled would get silently overwritten with the current
      // time on submit.
      setKind(initialValues.kind)
      setOutcome(initialValues.outcome ?? "positive")
      setWhenIsNow(false)
      setWhenValue(toLocalInputValue(new Date(initialValues.occurredAt)))
      setBody(initialValues.body ?? "")
      setNextFollowUp(initialValues.nextFollowUpAt ? toDateInputValue(new Date(initialValues.nextFollowUpAt)) : "")
    } else {
      setKind("call")
      setOutcome("positive")
      setWhenIsNow(true)
      setWhenValue(toLocalInputValue(new Date()))
      setBody("")
      setNextFollowUp("")
    }
    setAutoPrefilled(false)
    setError(null)
    // initialValues intentionally excluded — the modal is remounted per
    // target via `open`, so we key off `open` transitioning true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // no_answer auto-prefills next follow-up to tomorrow — but only when
  // the rep hasn't already picked something themselves.
  useEffect(() => {
    if (kind === "note") return
    if (outcome !== "no_answer") return
    if (nextFollowUp && !autoPrefilled) return
    setNextFollowUp(daysFromNow(1))
    setAutoPrefilled(true)
  }, [outcome, kind, nextFollowUp, autoPrefilled])

  const showOutcome = kind !== "note"
  const selectedPreset = FOLLOW_UP_PRESETS.find((p) => nextFollowUp === daysFromNow(p.days))?.value

  function setFollowUpPreset(p: FollowUpPreset | null) {
    if (p === null) {
      setNextFollowUp("")
    } else {
      const preset = FOLLOW_UP_PRESETS.find((x) => x.value === p)
      if (preset) setNextFollowUp(daysFromNow(preset.days))
    }
    setAutoPrefilled(false)
  }

  function onSubmit() {
    setError(null)
    const occurredAt = whenIsNow ? null : new Date(whenValue).toISOString()
    const nextIso = nextFollowUp ? new Date(`${nextFollowUp}T09:00`).toISOString() : null

    startTransition(async () => {
      // Route to the right create-side action based on which id we
      // were given. Sales → outbound_contact_log.prospect_id;
      // Companies → outbound_contact_log.company_contact_id. Edit
      // mode uses updateOutboundLog regardless (the log row is the
      // same table on either side). Normalise return shape so the
      // downstream `.ok` check works for both.
      let r: { ok: true } | { ok: false; error: string }
      if (isEdit && initialValues) {
        r = await updateOutboundLog({
          logId: initialValues.logId,
          kind,
          outcome: kind === "note" ? null : outcome,
          occurredAt: occurredAt ?? initialValues.occurredAt,
          body: body.trim() || null,
          nextFollowUpAt: nextIso,
        })
      } else if (prospectId) {
        const res = await logOutboundContact({
          prospectId,
          kind,
          outcome: kind === "note" ? null : outcome,
          occurredAt,
          body: body.trim() || null,
          nextFollowUpAt: nextIso,
        })
        r = res.ok ? { ok: true } : { ok: false, error: res.error }
      } else if (companyContactId) {
        const res = await logOutboundForCompanyContactAction({
          companyContactId,
          kind,
          outcome: kind === "note" ? null : outcome,
          occurredAt: occurredAt ?? undefined,
          body: body.trim() || null,
          nextFollowUpAt: nextIso,
        })
        r = res.success ? { ok: true } : { ok: false, error: res.error ?? "Failed to save" }
      } else {
        r = { ok: false, error: "Missing target — need prospectId or companyContactId" }
      }
      if (r.ok) {
        onOpenChange(false)
        onLogged?.()
      } else {
        setError("error" in r ? r.error : "Failed to save")
      }
    })
  }

  const initials = (contactLabel || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "?"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Suppress the default shadcn close (top-right XIcon) and use the
          popup-close ✕ styling to match the contact detail popup. */}
      <DialogContent className="max-w-md popup-card" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>{contactLabel}</DialogTitle>
        </DialogHeader>
        <div className="popup-header">
          <div className="min-w-0">
            <h3 className="arco-section-title truncate">{contactLabel}</h3>
            <div className="text-xs text-[#6b6b68] truncate">
              {companyLabel}
              {contactEmail && (
                <>
                  <span className="text-[#d4d4d3]"> · </span>
                  <span>{contactEmail}</span>
                </>
              )}
              {contactPhone && (
                <>
                  <span className="text-[#d4d4d3]"> · </span>
                  <span>{contactPhone}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className="popup-close"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Type — pill row */}
          <div className="flex flex-col gap-1.5">
            <label className="arco-eyebrow">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {KIND_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setKind(o.value)}
                  className={pillClass(kind === o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Outcome — pill row, hidden for notes */}
          {showOutcome && (
            <div className="flex flex-col gap-1.5">
              <label className="arco-eyebrow">Outcome</label>
              <div className="flex flex-wrap gap-1.5">
                {OUTCOME_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOutcome(o.value)}
                    className={pillClass(outcome === o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* When */}
          <div className="flex flex-col gap-1.5">
            <label className="arco-eyebrow">When</label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={whenValue}
                onChange={(e) => {
                  setWhenValue(e.target.value)
                  setWhenIsNow(false)
                }}
                disabled={whenIsNow}
                className="h-8 flex-1 rounded-[3px] border border-[#e5e5e4] bg-white px-2 text-sm disabled:bg-[#f5f5f4] disabled:text-[#a1a1a0]"
              />
              <label className="inline-flex items-center gap-1.5 text-xs text-[#6b6b68] whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={whenIsNow}
                  onChange={(e) => {
                    setWhenIsNow(e.target.checked)
                    if (e.target.checked) setWhenValue(toLocalInputValue(new Date()))
                  }}
                />
                Now
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="arco-eyebrow">Notes</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder={kind === "note" ? "What did you observe?" : "What happened? (optional)"}
              className="w-full rounded-[3px] border border-[#e5e5e4] bg-white px-2 py-1.5 text-sm placeholder:text-[#a1a1a0]"
            />
          </div>

          {/* Follow-up — preset pills + custom date */}
          <div className="flex flex-col gap-1.5">
            <label className="arco-eyebrow">Follow-up</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {FOLLOW_UP_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setFollowUpPreset(p.value)}
                  className={pillClass(selectedPreset === p.value)}
                >
                  {p.label}
                </button>
              ))}
              <input
                type="date"
                value={nextFollowUp}
                onChange={(e) => {
                  setNextFollowUp(e.target.value)
                  setAutoPrefilled(false)
                }}
                className="h-7 rounded-full border border-[#e5e5e4] bg-white px-2.5 text-xs text-[#6b6b68] hover:border-[#a1a1a0]"
              />
              {nextFollowUp && (
                <button
                  type="button"
                  onClick={() => setFollowUpPreset(null)}
                  className="text-xs text-[#6b6b68] hover:text-[#1c1c1a]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-[#c0392b]">{error}</p>}
        </div>

        <DialogFooter style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn-tertiary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onSubmit}
            disabled={isPending}
          >
            {isPending ? (isEdit ? "Saving…" : "Logging…") : (isEdit ? "Save" : "Log outbound")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
