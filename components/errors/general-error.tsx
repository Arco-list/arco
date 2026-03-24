"use client"

import { useEffect } from "react"
import Link from "next/link"
import { logger } from "@/lib/logger"

interface GeneralErrorProps {
  error?: Error & { digest?: string }
  reset?: () => void
}

export default function GeneralError({ error, reset }: GeneralErrorProps) {
  useEffect(() => {
    if (error) {
      logger.error("Global error boundary triggered", {
        component: "GeneralError",
        digest: error.digest,
        userAgent: typeof window !== "undefined" ? window.navigator.userAgent : undefined,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      }, error)
    }
  }, [error])

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "80px 24px" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <p className="arco-eyebrow" style={{ marginBottom: 16 }}>Error</p>
        <h1 className="arco-page-title" style={{ marginBottom: 12 }}>Something went wrong</h1>
        <p className="arco-body" style={{ marginBottom: 40 }}>
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {reset && (
            <button onClick={reset} className="btn btn-primary">Try again</button>
          )}
          <Link href="/" className="btn btn-secondary">Go home</Link>
        </div>
      </div>
    </div>
  )
}
