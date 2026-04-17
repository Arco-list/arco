"use client"

import { useEffect, useRef, useState } from "react"
import { Check, X } from "lucide-react"
import { batchScrapeProducts } from "@/app/admin/brands/actions"

type StepStatus = "pending" | "active" | "done" | "error"

type Item = {
  url: string
  name: string
}

type ItemResult =
  | { url: string; name: string; productId: string; status: "success" }
  | { url: string; name: string; error: string; status: "error" }

interface ProductsImportModalProps {
  items: Item[]
  brandId: string
  onClose: (didImport: boolean) => void
}

// Estimated pacing used to animate the status indicator per product while
// the server action runs. The action processes sequentially with a 1.5s
// gap + per-scrape work (~6-10s), so ~8s per product is a safe budget.
const ESTIMATED_MS_PER_PRODUCT = 8000

export function ProductsImportModal({ items, brandId, onClose }: ProductsImportModalProps) {
  const calledRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [statuses, setStatuses] = useState<StepStatus[]>(
    () => items.map((_, i) => (i === 0 ? "active" : "pending")),
  )
  const [results, setResults] = useState<ItemResult[] | null>(null)

  const isDone = results !== null
  const successCount = results?.filter((r) => r.status === "success").length ?? 0
  const failureCount = results?.filter((r) => r.status === "error").length ?? 0

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    const timers: ReturnType<typeof setTimeout>[] = []

    // Walk the active indicator forward on a timer while the action runs.
    // The server returns only when everything's finished, so we can't
    // match real progress — this just keeps the UI from looking frozen.
    for (let i = 1; i < items.length; i++) {
      timers.push(
        setTimeout(() => {
          setStatuses((prev) => {
            const next = [...prev]
            next[i - 1] = "done"
            next[i] = "active"
            return next
          })
          setActiveIndex(i)
        }, i * ESTIMATED_MS_PER_PRODUCT),
      )
    }

    const urls = items.map((i) => i.url)
    batchScrapeProducts(urls, brandId).then((res) => {
      timers.forEach(clearTimeout)
      // Stitch server results back to our items (match by URL).
      const byUrl = new Map<string, typeof res.results[number]>()
      for (const r of res.results) byUrl.set(r.url, r)

      const mapped: ItemResult[] = items.map((item) => {
        const r = byUrl.get(item.url)
        if (!r) return { url: item.url, name: item.name, error: "No response", status: "error" }
        if ("error" in r) return { url: item.url, name: item.name, error: r.error, status: "error" }
        return { url: item.url, name: r.name || item.name, productId: r.productId, status: "success" }
      })

      setStatuses(
        mapped.map((m) => (m.status === "success" ? "done" : "error")),
      )
      setResults(mapped)
    })

    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = () => {
    if (!isDone) return
    onClose(successCount > 0)
  }

  const headerTitle = !isDone
    ? `Importing ${items.length} product${items.length === 1 ? "" : "s"}…`
    : failureCount === 0
      ? `Imported ${successCount} product${successCount === 1 ? "" : "s"}`
      : successCount === 0
        ? "Import failed"
        : `Imported ${successCount} of ${items.length} products`

  // Progress bar width — walks from 15% → 90% as items complete, jumps to
  // 100% when done. We don't report real per-step progress.
  const progressPct = isDone
    ? 100
    : Math.max(15, Math.round(((activeIndex + 0.5) / items.length) * 90))

  return (
    <div className="popup-overlay" onClick={isDone ? handleClose : undefined}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="popup-header">
          <h3 className="arco-section-title">{headerTitle}</h3>
          {isDone && (
            <button type="button" className="popup-close" onClick={handleClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>

        {/* Per-item status list — scrolls if many products */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto", margin: "4px 0 20px" }}>
          {items.map((item, i) => {
            const status = statuses[i]
            const result = results?.[i]
            return (
              <div key={item.url} className="scrape-step" style={{ alignItems: "flex-start" }}>
                <span style={{ marginTop: 3 }}>
                  <StepIcon status={status} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={`scrape-step-label scrape-step-label--${status}`} style={{ fontWeight: 500 }}>
                    {result && result.status === "success" ? result.name : item.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {result && result.status === "error" ? result.error : item.url}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress bar while running */}
        {!isDone && (
          <div className="scrape-progress-track">
            <div className="scrape-progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
        )}

        {/* Actions */}
        {isDone && (
          <div className="popup-actions">
            <button type="button" className="btn-secondary" onClick={handleClose} style={{ flex: 1 }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="scrape-step-icon scrape-step-icon--done">
        <Check size={10} color="white" strokeWidth={2.5} />
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="scrape-step-icon scrape-step-icon--error">
        <X size={10} color="white" strokeWidth={2.5} />
      </span>
    )
  }
  if (status === "active") {
    return <span className="scrape-step-icon scrape-step-icon--active" />
  }
  return <span className="scrape-step-icon scrape-step-icon--pending" />
}
