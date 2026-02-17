import Link from "next/link"
import Image from "next/image"

interface Professional {
  id: string
  companyId: string | null
  companyName: string
  companySlug: string | null
  serviceCategory: string
  logo: string | null
  projectsCount: number
}

interface CreditedProfessionalsProps {
  professionals: Professional[]
}

export function CreditedProfessionals({ professionals }: CreditedProfessionalsProps) {
  if (professionals.length === 0) return null

  // Get initials from company name
  const getInitials = (name: string) => {
    const words = name.split(' ')
    if (words.length >= 2) {
      return words[0][0] + words[1][0]
    }
    return words[0].substring(0, 2)
  }

  return (
    <section id="professionals" className="credits-section">
      <div className="wrap">
        <div className="credits-header">
          <h2 className="arco-section-title">Credited Professionals</h2>
          <p className="arco-body-text" style={{ maxWidth: '800px', margin: '12px 0 0', textAlign: 'left' }}>
            The trusted team that worked together to bring this project to life.
          </p>
        </div>

        <div className="credits-grid">
          {professionals.map((professional) => {
            const initials = getInitials(professional.companyName)
            const href = professional.companySlug 
              ? `/professionals/${professional.companySlug}` 
              : '#'

            return (
              <Link
                key={professional.id}
                href={href}
                className="credit-card"
              >
                <span className="arco-eyebrow">{professional.serviceCategory}</span>
                
                <div className="credit-icon">
                  {professional.logo ? (
                    <Image
                      src={professional.logo}
                      alt={professional.companyName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span className="credit-icon-initials">{initials}</span>
                  )}
                </div>

                <h3 className="arco-h4">{professional.companyName}</h3>
                <p className="arco-card-subtitle">
                  {professional.projectsCount} {professional.projectsCount === 1 ? 'project' : 'projects'}
                </p>
                <span className="text-link-plain">View Portfolio →</span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
