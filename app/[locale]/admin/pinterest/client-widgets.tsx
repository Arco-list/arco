"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  updateBoardIdAction,
  enqueueBackfillAction,
  disconnectPinterestAction,
  createMissingBoardsAction,
} from "./actions"

/** Two-part input pair: text field + Save button; the sibling row in the
 *  table renders a matching status pill. Keeping the input state local
 *  lets the admin paste multiple ids in a row without any of them
 *  triggering a full server round-trip until they click Save. */
export function BoardIdInput({ boardRowId, initialValue }: { boardRowId: string; initialValue: string }) {
  const [value, setValue] = useState(initialValue)
  return (
    <input
      className="input-base input-default"
      style={{ width: "100%", fontSize: 12 }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="e.g. 1234567890123456789"
      data-board-input={boardRowId}
    />
  )
}

export function RowActions({ boardRowId, initialValue }: { boardRowId: string; initialValue: string }) {
  const [isPending, startTransition] = useTransition()
  const save = () => {
    const el = document.querySelector<HTMLInputElement>(`input[data-board-input="${boardRowId}"]`)
    const next = el?.value ?? initialValue
    startTransition(async () => {
      const res = await updateBoardIdAction(boardRowId, next)
      if (res.success) toast.success("Saved")
      else toast.error(res.error ?? "Save failed")
    })
  }
  return (
    <button
      type="button"
      className="btn-tertiary"
      style={{ padding: "6px 10px", fontSize: 12 }}
      onClick={save}
      disabled={isPending}
    >
      {isPending ? "Saving…" : "Save"}
    </button>
  )
}

export function BackfillButton() {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => {
        if (!confirm("Enqueue publish for every currently published project + eligible feature? Existing pins will be re-created after the pending queue drains.")) return
        startTransition(async () => {
          const res = await enqueueBackfillAction()
          if (res.success) toast.success(`Enqueued ${res.enqueued} row(s)`)
          else toast.error(res.error ?? "Backfill failed")
        })
      }}
      disabled={isPending}
    >
      {isPending ? "Enqueueing…" : "Backfill all published projects"}
    </button>
  )
}

export function CreateMissingBoardsButton() {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      type="button"
      className="btn-tertiary"
      onClick={() => {
        if (!confirm("Create every board that's still missing on Pinterest? Uses the seeded name for each (space or category). Existing boards on the account with the same name will fail with a 409 — paste those ids manually.")) return
        startTransition(async () => {
          const res = await createMissingBoardsAction()
          if (!res.success) {
            toast.error(res.error ?? "Board creation failed")
            return
          }
          const summary = `Created ${res.created}, adopted ${res.adopted}, skipped ${res.skipped}`
          if (res.failures.length > 0) {
            const firstFew = res.failures.slice(0, 3).map((f) => `${f.name}: ${f.reason}`).join(" · ")
            toast.warning(`${summary}, ${res.failures.length} failed. ${firstFew}`)
          } else {
            toast.success(summary)
          }
        })
      }}
      disabled={isPending}
    >
      {isPending ? "Creating…" : "Create missing boards"}
    </button>
  )
}

export function DisconnectButton() {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      type="button"
      className="btn-tertiary"
      onClick={() => {
        if (!confirm("Clear the stored Pinterest tokens? The cron will stop working until you reconnect.")) return
        startTransition(async () => {
          const res = await disconnectPinterestAction()
          if (res.success) toast.success("Disconnected")
          else toast.error(res.error ?? "Disconnect failed")
        })
      }}
      disabled={isPending}
    >
      {isPending ? "Disconnecting…" : "Disconnect"}
    </button>
  )
}
