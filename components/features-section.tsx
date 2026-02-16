// components/features-section.tsx
// How Arco works section - MATCHES HTML DESIGN

const features = [
  {
    number: "01",
    title: "Architects publish",
    description:
      "Leading residential architects submit completed projects for editorial review. Each published project is verified and complete — not a render, not a pitch.",
  },
  {
    number: "02",
    title: "Teams get credited",
    description:
      "Every collaborator on a project — builder, interior designer, landscape architect — is credited by the architect who hired them. That endorsement means something.",
  },
  {
    number: "03",
    title: "Clients discover",
    description:
      "Browse by project type, space, or location. See the actual work. Contact the team directly. No middlemen, no lead fees, no auctions.",
  },
]

export function FeaturesSection() {
  return (
    <div className="how-section">
      <div className="wrap">
        <div className="section-header" style={{ marginBottom: '40px' }}>
          <h2 className="section-title">How Arco works</h2>
        </div>
        <div className="how-grid">
          {features.map((feature) => (
            <div key={feature.number} className="how-card">
              <div className="how-number">{feature.number}</div>
              <h3 className="how-title">{feature.title}</h3>
              <p className="how-body">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
