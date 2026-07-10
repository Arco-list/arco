"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  updateBoardIdAction,
  enqueueBackfillAction,
  disconnectPinterestAction,
  createMissingBoardsAction,
} from "./actions"

// ── Shared branded confirm dialog ────────────────────────────────────────
// Replaces native window.confirm() so the buttons on this admin page use
// the same .popup-card shell as the rest of the app. Renders nothing when
// open=false so the DOM stays clean.
function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  confirmVariant = "primary",
  onConfirm,
  onCancel,
  isPending,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  confirmVariant?: "primary" | "danger"
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
}) {
  if (!open) return null
  return (
    <div className="popup-overlay" onClick={onCancel}>
      <div
        className="popup-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <div className="popup-header">
          <h3 className="arco-section-title">{title}</h3>
          <button
            type="button"
            className="popup-close"
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="arco-body-text" style={{ marginBottom: 24 }}>{body}</p>
        <div className="popup-actions">
          <button
            type="button"
            className="btn-tertiary"
            onClick={onCancel}
            style={{ flex: 1 }}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className={confirmVariant === "danger" ? "btn-primary" : "btn-secondary"}
            onClick={onConfirm}
            style={{
              flex: 1,
              ...(confirmVariant === "danger" ? { background: "#dc2626", color: "#fff" } : undefined),
            }}
            disabled={isPending}
          >
            {isPending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {isPending ? "Enqueueing…" : "Backfill all published projects"}
      </button>
      <ConfirmDialog
        open={open}
        title="Backfill Pinterest queue"
        body="Enqueue publish for every currently published project and every eligible space feature. Existing pins will be re-created once the pending queue drains — engagement stats on those pins will reset."
        confirmLabel="Enqueue backfill"
        isPending={isPending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            const res = await enqueueBackfillAction()
            setOpen(false)
            if (res.success) toast.success(`Enqueued ${res.enqueued} row(s)`)
            else toast.error(res.error ?? "Backfill failed")
          })
        }}
      />
    </>
  )
}

export function CreateMissingBoardsButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  return (
    <>
      <button
        type="button"
        className="btn-tertiary"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {isPending ? "Creating…" : "Create missing boards"}
      </button>
      <ConfirmDialog
        open={open}
        title="Create missing boards"
        body="Any Arco board that hasn't been mapped yet will be created on Pinterest. Boards that already exist on the account under the same name will be adopted by their existing id."
        confirmLabel="Create & adopt"
        isPending={isPending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            const res = await createMissingBoardsAction()
            setOpen(false)
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
      />
    </>
  )
}

export function DisconnectButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  return (
    <>
      <button
        type="button"
        className="btn-tertiary"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {isPending ? "Disconnecting…" : "Disconnect"}
      </button>
      <ConfirmDialog
        open={open}
        title="Disconnect Pinterest"
        body="Clear the stored Pinterest access + refresh tokens. The cron will stop publishing pins until you reconnect from this page."
        confirmLabel="Disconnect"
        confirmVariant="danger"
        isPending={isPending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            const res = await disconnectPinterestAction()
            setOpen(false)
            if (res.success) toast.success("Disconnected")
            else toast.error(res.error ?? "Disconnect failed")
          })
        }}
      />
    </>
  )
}
