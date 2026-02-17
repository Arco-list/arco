import Image from "next/image"

interface ProfessionalHeaderProps {
  name: string
  services: string
  description: string | null
  companyIcon: string | null
  companyInitials: string
}

export function ProfessionalHeader({
  name,
  services,
  description,
  companyIcon,
  companyInitials,
}: ProfessionalHeaderProps) {
  // Strip HTML tags from description
  const cleanDescription = description
    ? description.replace(/<[^>]*>/g, '').trim()
    : null

  return (
    <section className="professional-header">
      {/* Company Icon */}
      <div className="company-icon">
        {companyIcon ? (
          <Image
            src={companyIcon}
            alt={name}
            width={100}
            height={100}
            className="company-icon-image"
          />
        ) : (
          <div className="company-icon-initials">
            {companyInitials}
          </div>
        )}
      </div>
      
      <h1 className="arco-page-title">{name}</h1>
      
      <p className="professional-badge">{services}</p>
      
      {cleanDescription && (
        <div className="professional-description">
          {cleanDescription.split('\n\n').map((paragraph, index) => (
            <p key={index} className="arco-body-text">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
