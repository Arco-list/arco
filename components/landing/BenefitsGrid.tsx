export interface Benefit {
  title: string
  body: string
  features: string[]
}

interface BenefitsGridProps {
  benefits: Benefit[]
}

export function BenefitsGrid({ benefits }: BenefitsGridProps) {
  return (
    <section className="benefits-section">
      <div className="wrap">
        <div className="benefits-grid">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="benefit-card">
              <h3 className="benefit-title">{benefit.title}</h3>
              <p className="benefit-body">{benefit.body}</p>
              <ul className="benefit-features">
                {benefit.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
