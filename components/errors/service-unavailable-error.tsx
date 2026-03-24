"use client"

import Link from "next/link"

export default function ServiceUnavailableError() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "80px 24px" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <p className="arco-eyebrow" style={{ marginBottom: 16 }}>503</p>
        <h1 className="arco-page-title" style={{ marginBottom: 12 }}>Service unavailable</h1>
        <p className="arco-body" style={{ marginBottom: 40 }}>
          The service is temporarily unavailable. Please try again later.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={() => window.location.reload()} className="btn btn-primary">Try again</button>
          <Link href="/" className="btn btn-secondary">Go home</Link>
        </div>
      </div>
    </div>
  )
}
