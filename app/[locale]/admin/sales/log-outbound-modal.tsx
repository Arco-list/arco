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
  type OutboundKind,
  type OutboundOutcome,
} from "./log-outbound-actions"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prospectId: string
  contactLabel: string
  companyLabel: string
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
  contactLabel,
  companyLabel,
  onLogged,
}: Props) {
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
    setKind("call")
    setOutcome("positive")
    setWhenIsNow(true)
    setWhenValue(toLocalInputValue(new Date()))
    setBody("")
    setNextFollowUp("")
    setAutoPrefilled(false)
    setError(null)
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
      const r = await logOutboundContact({
        prospectId,
        kind,
        outcome: kind === "note" ? null : outcome,
        occurredAt,
        body: body.trim() || null,
        nextFollowUpAt: nextIso,
      })
      if (r.ok) {
        onOpenChange(false)
        onLogged?.()
      } else {
        setError(r.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log outbound</DialogTitle>
          <p className="text-xs text-[#6b6b68]">
            {contactLabel} · {companyLabel}
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Type — pill row */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#6b6b68]">Type</label>
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
              <label className="text-xs text-[#6b6b68]">Outcome</label>
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
            <label className="text-xs text-[#6b6b68]">When</label>
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
            <label className="text-xs text-[#6b6b68]">Notes</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder={kind === "note" ? "What did you observe?" : "What happened? (optional)"}
              className="w-full rounded-[3px] border border-[#e5e5e4] bg-white px-2 py-1.5 text-sm placeholder:text-[#a1a1a0]"
            />
          </div>

          {/* Next follow-up — preset pills + custom date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#6b6b68]">Next follow-up</label>
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

        <DialogFooter>
          <button
            type="button"
            className="arco-nav-text px-[18px] py-[7px] rounded-[3px] border border-[#e5e5e4] hover:bg-[#f5f5f4] transition-colors disabled:opacity-50"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="arco-nav-text px-[18px] py-[7px] rounded-[3px] btn-scrolled disabled:opacity-50"
            onClick={onSubmit}
            disabled={isPending}
          >
            {isPending ? "Logging…" : "Log outbound"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
