"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { runOutboundSync } from "./actions"
import type { OutboundSyncResult } from "@/lib/notion/outbound-sync"

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; result: OutboundSyncResult; durationMs: number; finishedAt: Date }
  | { kind: "error"; error: string; finishedAt: Date }

export function SyncButton() {
  const [state, setState] = useState<State>({ kind: "idle" })
  const [isPending, startTransition] = useTransition()

  function onClick() {
    setState({ kind: "running" })
    startTransition(async () => {
      const r = await runOutboundSync()
      if (r.ok) {
        setState({ kind: "ok", result: r.result, durationMs: r.durationMs, finishedAt: new Date() })
      } else {
        setState({ kind: "error", error: r.error, finishedAt: new Date() })
      }
    })
  }

  const running = state.kind === "running" || isPending

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={onClick} disabled={running}>
          {running ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      {state.kind === "running" && (
        <p className="text-sm text-[#6b6b68]">
          Pulling prospects + companies, writing to Notion. Typically 30–90s for a few dozen rows.
        </p>
      )}

      {state.kind === "ok" && (
        <div className="rounded-[3px] border border-[#e5e5e4] bg-white p-4">
          <p className="text-sm font-medium text-[#1c1c1a]">
            Sync completed in {(state.durationMs / 1000).toFixed(1)}s
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-[#6b6b68]">
            <dt>Prospects processed</dt>
            <dd className="text-[#1c1c1a]">{state.result.prospectsCount}</dd>
            <dt>Notion rows seen</dt>
            <dd className="text-[#1c1c1a]">{state.result.notionRowCount}</dd>
            <dt>Created</dt>
            <dd className="text-[#1c1c1a]">{state.result.created}</dd>
            <dt>Updated</dt>
            <dd className="text-[#1c1c1a]">{state.result.updated}</dd>
            <dt>Direct enriched</dt>
            <dd className="text-[#1c1c1a]">{state.result.directEnriched}</dd>
            <dt>Unmatched Notion rows</dt>
            <dd className="text-[#1c1c1a]">{state.result.unmatchedNotionRows}</dd>
            <dt>Errors</dt>
            <dd className={state.result.errors > 0 ? "text-[#c0392b]" : "text-[#1c1c1a]"}>
              {state.result.errors}
            </dd>
          </dl>
          {state.result.errorDetails.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-[#6b6b68]">
                {state.result.errorDetails.length} error
                {state.result.errorDetails.length === 1 ? "" : "s"} (click to expand)
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-[#c0392b]">
                {state.result.errorDetails.map((e, i) => (
                  <li key={i}>
                    <strong>{e.company}</strong>: {e.err}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="mt-3 text-xs text-[#6b6b68]">
            Last run: {state.finishedAt.toLocaleString()}
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-[3px] border border-[#c0392b] bg-[#fdf2f1] p-4">
          <p className="text-sm font-medium text-[#c0392b]">Sync failed</p>
          <p className="mt-1 text-sm text-[#c0392b]">{state.error}</p>
          <p className="mt-3 text-xs text-[#6b6b68]">
            Failed at: {state.finishedAt.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}
