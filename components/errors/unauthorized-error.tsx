import Link from "next/link"

export default function UnauthorizedError() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "80px 24px" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <p className="arco-eyebrow" style={{ marginBottom: 16 }}>401</p>
        <h1 className="arco-page-title" style={{ marginBottom: 12 }}>Unauthorized</h1>
        <p className="arco-body" style={{ marginBottom: 40 }}>
          You need to be logged in to access this page.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/login" className="btn btn-primary">Sign in</Link>
          <Link href="/" className="btn btn-secondary">Go home</Link>
        </div>
      </div>
    </div>
  )
}
