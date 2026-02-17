import Link from "next/link"

interface ProfessionalContactProps {
  companyName: string
  officeAddress: string | null
  websiteUrl: string | null
}

export function ProfessionalContact({
  companyName,
  officeAddress,
  websiteUrl,
}: ProfessionalContactProps) {
  // Parse address if available
  const addressLines = officeAddress ? officeAddress.split('\n').filter(Boolean) : []
  const city = addressLines[0] ?? null
  const street = addressLines[1] ?? null
  const postal = addressLines[2] ?? null

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
          {city && (
            <div className="contact-card">
              <span className="arco-eyebrow">Office Location</span>
              <p className="arco-card-title" style={{ margin: '12px 0 4px' }}>
                {city}
              </p>
              {street && <p className="arco-card-subtitle">{street}</p>}
              {postal && <p className="arco-card-subtitle">{postal}</p>}
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
