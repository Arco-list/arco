import { getTranslations } from "next-intl/server"
import { IntroductionButton } from "./introduction-button"

interface ProfessionalContactProps {
  companyId: string
  companyName: string
  companyLogoUrl: string | null
  companyInitials: string
  serviceLabel: string | null
  officeAddress: string | null
  city: string | null
  websiteUrl: string | null
}

export async function ProfessionalContact({
  companyId,
  companyName,
  companyLogoUrl,
  companyInitials,
  serviceLabel,
  officeAddress,
  city: cityProp,
  websiteUrl,
}: ProfessionalContactProps) {
  const t = await getTranslations("professional_detail")

  const city = cityProp ?? null
  const street = officeAddress?.split(",")[0]?.trim() ?? null
  const locationDisplay = [street, city].filter(Boolean).join(', ') || null
  const subtitle = [serviceLabel, city].filter(Boolean).join(' · ') || null

  return (
    <section id="contact" className="contact-section">
      <div className="wrap">
        <div className="section-header">
          <h2 className="arco-section-title">{t("get_in_touch")}</h2>
        </div>

        <div className="contact-grid">
          {/* Request Introduction CTA */}
          <div className="contact-card">
            <IntroductionButton
              companyId={companyId}
              companyName={companyName}
              companyLogoUrl={companyLogoUrl}
              companyInitials={companyInitials}
              subtitle={subtitle}
            />
          </div>

          {/* Office location */}
          {locationDisplay && (
            <div className="contact-card">
              <span className="arco-eyebrow">{t("office_location")}</span>
              <p className="arco-card-title" style={{ margin: '12px 0 4px' }}>
                {locationDisplay}
              </p>
            </div>
          )}

          {/* Website */}
          {websiteUrl && (
            <div className="contact-card">
              <span className="arco-eyebrow">{t("website")}</span>
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
