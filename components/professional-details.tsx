export function ProfessionalDetails() {
  const details = [
    { label: "Specialization", value: "Architecture" },
    { label: "Experience", value: "15+ years" },
    { label: "Location", value: "Amsterdam" },
    { label: "Projects completed", value: "50+" },
    { label: "Style", value: "Contemporary" },
    { label: "Services", value: "Design & Build" },
    { label: "Team size", value: "5-10 people" },
    { label: "Founded", value: "2008" },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-black">About the professional</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {details.map((detail, index) => (
          <div key={index} className="space-y-1">
            <p className="text-sm text-gray-500">{detail.label}</p>
            <p className="text-sm font-medium text-gray-900">{detail.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
