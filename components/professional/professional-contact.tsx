import Link from "next/link"

interface ProfessionalContactProps {
  companyName: string
  officeAddress: string | null
  city: string | null
  websiteUrl: string | null
}

export function ProfessionalContact({
  companyName,
  officeAddress,
  city: cityProp,
  websiteUrl,
}: ProfessionalContactProps) {
  // Build display: "street + housenumber, city" — matching company edit page format
  const city = cityProp ?? null
  const street = officeAddress?.split(",")[0]?.trim() ?? null
  const locationDisplay = [street, city].filter(Boolean).join(', ') || null

  return (
    <section id="contact" className="contact-section">
      <div className="wrap">
        <div className="section-header">
          <h2 className="arco-section-title">Get in Touch</h2>
        </div>

        <div className="contact-grid">
          {/* Request Introduction CTA */}
          <div className="contact-card">
            <Link href="#" className="btn-contact">
              Request an Introduction
            </Link>
          </div>

          {/* Office Location */}
          {locationDisplay && (
            <div className="contact-card">
              <span className="arco-eyebrow">Office Location</span>
              <p className="arco-card-title" style={{ margin: '12px 0 4px' }}>
                {locationDisplay}
              </p>
            </div>
          )}

          {/* Website */}
          {websiteUrl && (
            <div className="contact-card">
              <span className="arco-eyebrow">Website</span>
              <p className="arco-card-title" style={{ margin: '12px 0 4px' }}>
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link-plain"
                >
                  {websiteUrl.replace(/^https?:\/\//, '')} →
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
