interface ProfessionalSpecsProps {
  location: string | null
  established: number | null
  teamSize: number | null
  projectsCount: number
  specialties: string | null
}

export function ProfessionalSpecs({
  location,
  established,
  teamSize,
  projectsCount,
  specialties,
}: ProfessionalSpecsProps) {
  const specs = [
    { label: 'Location', value: location },
    { label: 'Established', value: established },
    { label: 'Team Size', value: teamSize ? `${teamSize} People` : null },
    { label: 'Projects', value: `${projectsCount}+ Completed` },
    { label: 'Specialties', value: specialties },
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
