"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, X } from "lucide-react"
import { scrapeAndCreateProject } from "@/app/new-project/import/actions"

type StepStatus = "pending" | "active" | "done" | "error"

const STEPS = [
  "Fetching page",
  "Extracting content",
  "Creating your project",
]

// Delay after which each step becomes "active" while waiting for the action
const STEP_DELAYS_MS = [0, 1200, 2800]

interface ScrapeModalProps {
  url: string
  onClose: () => void
}

export function ScrapeModal({ url, onClose }: ScrapeModalProps) {
  const router = useRouter()
  const calledRef = useRef(false)
  const [statuses, setStatuses] = useState<StepStatus[]>(["active", "pending", "pending"])
  const [error, setError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const isDone = projectId !== null
  const isFailed = error !== null

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    const timers: ReturnType<typeof setTimeout>[] = []

    // Advance step indicators while the action runs
    timers.push(setTimeout(() => {
      setStatuses(["done", "active", "pending"])
    }, STEP_DELAYS_MS[1]))

    timers.push(setTimeout(() => {
      setStatuses(["done", "done", "active"])
    }, STEP_DELAYS_MS[2]))

    scrapeAndCreateProject(url).then((result) => {
      // Clear pending timers — action resolved (fast or slow)
      timers.forEach(clearTimeout)
      if ("error" in result) {
        setStatuses(["error", "pending", "pending"])
        setError(result.error)
      } else {
        setStatuses(["done", "done", "done"])
        setProjectId(result.projectId)
      }
    })

    return () => timers.forEach(clearTimeout)
  }, [url])

  const handleOpen = () => {
    if (!projectId) return
    router.push(`/new-project/import/${projectId}`)
    onClose()
  }

  const handleOverlayClick = () => {
    if (isDone || isFailed) onClose()
  }

  // Truncate the URL for display
  const displayUrl = url.length > 60 ? url.slice(0, 57) + "…" : url

  return (
    <div className="popup-overlay" onClick={handleOverlayClick}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="popup-header">
          <h3 className="arco-section-title">
            {isDone ? "Your project is ready" : isFailed ? "Import failed" : "Importing project…"}
          </h3>
          {(isDone || isFailed) && (
            <button type="button" className="popup-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>

        {/* URL pill */}
        <div className="scrape-url-pill">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6.5 9.5l3-3" /><path d="M9 10.5l1.5-1.5a2.83 2.83 0 0 0-4-4L5 6.5" /><path d="M7 5.5L5.5 7a2.83 2.83 0 0 0 4 4L11 9.5" />
          </svg>
          <span className="scrape-url-text">{displayUrl}</span>
        </div>

        {/* Steps */}
        <div className="scrape-steps">
          {STEPS.map((label, i) => {
            const status = statuses[i]
            return (
              <div key={label} className="scrape-step">
                <StepIcon status={status} />
                <span className={`scrape-step-label scrape-step-label--${status}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        {!isDone && !isFailed && (
          <div className="scrape-progress-track">
            <div
              className="scrape-progress-bar"
              style={{
                width:
                  statuses[2] === "active"
                    ? "85%"
                    : statuses[1] === "active"
                      ? "55%"
                      : "25%",
              }}
            />
          </div>
        )}

        {/* Error state */}
        {isFailed && (
          <div className="popup-banner popup-banner--danger">
            {error}
          </div>
        )}

        {/* Actions */}
        {isDone && (
          <div className="popup-actions">
            <button type="button" className="btn-secondary" onClick={handleOpen} style={{ flex: 1 }}>
              Open & edit your project →
            </button>
          </div>
        )}

        {isFailed && (
          <div className="popup-actions">
            <button type="button" className="btn-tertiary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <Link
              href="/new-project/details"
              onClick={onClose}
              className="btn-secondary"
              style={{ flex: 1, textAlign: "center" }}
            >
              Fill in manually →
            </Link>
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
