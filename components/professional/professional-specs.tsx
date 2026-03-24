interface ProfessionalSpecsProps {
  location: string | null
  established: number | null
  teamSize: number | null
  languages: string[]
  certificates: string[]
}

export function ProfessionalSpecs({
  location,
  established,
  teamSize,
  languages,
  certificates,
}: ProfessionalSpecsProps) {
  const specs = [
    { label: 'Location', value: location },
    { label: 'Established', value: established },
    { label: 'Team Size', value: teamSize ? `${teamSize} People` : null },
    { label: 'Languages', value: languages.length > 0 ? languages.join(', ') : null },
    { label: 'Certificates', value: certificates.length > 0 ? certificates.join(', ') : null },
  ].filter(spec => spec.value) // Only show specs with values

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
