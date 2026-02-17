interface SpecificationsBarProps {
  location: string | null
  year: number | null
  type: string | null
  scope: string | null
  style: string | null
}

export function SpecificationsBar({ location, year, type, scope, style }: SpecificationsBarProps) {
  const specs = [
    { label: "Location", value: location },
    { label: "Year", value: year },
    { label: "Type", value: type },
    { label: "Scope", value: scope },
    { label: "Style", value: style },
  ].filter(spec => spec.value)

  if (specs.length === 0) return null

  return (
    <section className="specifications-bar">
      {specs.map((spec) => (
        <div key={spec.label} className="spec-item">
          <span className="arco-eyebrow">{spec.label}</span>
          <div className="arco-card-title">{spec.value}</div>
        </div>
      ))}
    </section>
  )
}
