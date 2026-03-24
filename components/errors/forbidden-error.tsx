import Link from "next/link"

export default function ForbiddenError() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "80px 24px" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <p className="arco-eyebrow" style={{ marginBottom: 16 }}>403</p>
        <h1 className="arco-page-title" style={{ marginBottom: 12 }}>Forbidden</h1>
        <p className="arco-body" style={{ marginBottom: 40 }}>
          You don&apos;t have permission to access this page.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/dashboard" className="btn btn-primary">Go to dashboard</Link>
          <Link href="/" className="btn btn-secondary">Go home</Link>
        </div>
      </div>
    </div>
  )
}
