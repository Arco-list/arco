export interface Step {
  title: string
  body: string
}

interface HowItWorksProps {
  steps: Step[]
}

export function HowItWorks({ steps }: HowItWorksProps) {
  return (
    <section className="how-section">
      <div className="wrap">
        <div style={{ textAlign: "center" }}>
          <h2 className="arco-section-title">How It Works</h2>
        </div>
        <div className="how-grid">
          {steps.map((step, i) => (
            <div key={step.title} className="how-card">
              <div className="how-number">{i + 1}</div>
              <div className="how-title">{step.title}</div>
              <div className="how-body">{step.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
