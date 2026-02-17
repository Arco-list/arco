import Link from "next/link"

export function ProjectCTA() {
  return (
    <section className="intro-cta-section">
      <div className="wrap">
        <h2>Ready to bring your villa project to life?</h2>
        <Link href="/plan-project" className="btn-secondary">
          Plan a Project
        </Link>
      </div>
    </section>
  )
}
