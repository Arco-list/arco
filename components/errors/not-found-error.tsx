import Link from "next/link"

export default function NotFoundError() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "80px 24px" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <p className="arco-eyebrow" style={{ marginBottom: 16 }}>404</p>
        <h1 className="arco-page-title" style={{ marginBottom: 12 }}>Page not found</h1>
        <p className="arco-body" style={{ marginBottom: 40 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/" className="btn btn-primary">Go home</Link>
          <Link href="/projects" className="btn btn-secondary">Browse projects</Link>
        </div>
      </div>
    </div>
  )
}
