"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  logOutboundContact,
  type OutboundKind,
  type OutboundOutcome,
} from "./log-outbound-actions"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prospectId: string
  contactLabel: string // e.g. "Niek Van Leeuwen"
  companyLabel: string // e.g. "Lucen"
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

// Format a Date as the local-tz string that <input type="datetime-local"> expects.
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function tomorrowAt9am(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d
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

  // Reset state on open/close — modal state shouldn't leak between rows.
  useEffect(() => {
    if (!open) return
    setKind("call")
    setOutcome("positive")
    setWhenIsNow(true)
    setWhenValue(toLocalInputValue(new Date()))
    setBody("")
    setNextFollowUp("")
    setError(null)
  }, [open])

  // no_answer auto-prefills next follow-up to tomorrow 9am unless the
  // rep has already set their own value.
  const lastAutoNextRef = useMemo(() => ({ value: "" }), [])
  useEffect(() => {
    if (kind === "note") return
    if (outcome !== "no_answer") return
    const auto = toDateInputValue(tomorrowAt9am())
    if (nextFollowUp && nextFollowUp !== lastAutoNextRef.value) return
    setNextFollowUp(auto)
    lastAutoNextRef.value = auto
  }, [outcome, kind, nextFollowUp, lastAutoNextRef])

  const showOutcome = kind !== "note"

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

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <label className="text-xs text-[#6b6b68]">Type</label>
            <Select value={kind} onValueChange={(v) => setKind(v as OutboundKind)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showOutcome && (
            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <label className="text-xs text-[#6b6b68]">Outcome</label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as OutboundOutcome)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOME_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
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

          <div className="grid grid-cols-[80px_1fr] items-start gap-2">
            <label className="text-xs text-[#6b6b68] pt-1.5">Notes</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder={kind === "note" ? "What did you observe?" : "What happened? (optional)"}
              className="w-full rounded-[3px] border border-[#e5e5e4] bg-white px-2 py-1.5 text-sm placeholder:text-[#a1a1a0]"
            />
          </div>

          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <label className="text-xs text-[#6b6b68]">Next follow-up</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                className="h-8 flex-1 rounded-[3px] border border-[#e5e5e4] bg-white px-2 text-sm"
              />
              {nextFollowUp && (
                <button
                  type="button"
                  onClick={() => setNextFollowUp("")}
                  className="text-xs text-[#6b6b68] hover:text-[#1c1c1a]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-[#c0392b]">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? "Logging…" : "Log outbound"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
