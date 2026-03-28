import Link from "next/link"

export function MembershipCTA() {
  return (
    <section className="py-20 px-4 md:px-8 bg-white">
      <div className="max-w-[1100px] mx-auto">

        <h2 className="arco-page-title mb-4 text-center">
          Built for the industry
        </h2>
        <p className="arco-body-text mb-12 max-w-[520px] mx-auto text-center">
          Whether you design, build, or furnish — Arco gives your work the visibility it deserves.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* Architects */}
          <div style={{
            padding: "40px 36px",
            border: "1px solid #e8e8e6",
            borderRadius: 8,
          }}>
            <p className="arco-eyebrow" style={{ marginBottom: 12 }}>For Architects</p>
            <h3 className="arco-section-title" style={{ marginBottom: 12 }}>
              Publish your work. Credit your team.
            </h3>
            <p className="arco-body-text" style={{ marginBottom: 24 }}>
              Showcase completed projects, credit the professionals involved, and let your built work speak for itself.
            </p>
            <Link
              href="/businesses/architects"
              className="btn-primary"
              style={{ display: "inline-block" }}
            >
              Learn more →
            </Link>
          </div>

          {/* Professionals */}
          <div style={{
            padding: "40px 36px",
            border: "1px solid #e8e8e6",
            borderRadius: 8,
          }}>
            <p className="arco-eyebrow" style={{ marginBottom: 12 }}>For Professionals</p>
            <h3 className="arco-section-title" style={{ marginBottom: 12 }}>
              Be recognised through your work.
            </h3>
            <p className="arco-body-text" style={{ marginBottom: 24 }}>
              Get credited on real projects by the architects you work with. Build your reputation through built work, not promotion.
            </p>
            <Link
              href="/businesses/professionals"
              className="btn-primary"
              style={{ display: "inline-block" }}
            >
              Learn more →
            </Link>
          </div>

        </div>

      </div>
    </section>
  )
}
