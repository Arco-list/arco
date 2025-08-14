export function ProjectDetails() {
  const details = [
    { label: "Category", value: "House" },
    { label: "Style", value: "Contemporary" },
    { label: "Size", value: "Large" },
    { label: "Project year", value: "1999" },
    { label: "Type", value: "Villa" },
    { label: "Project type", value: "Renovated" },
    { label: "Budget", value: "Premium" },
    { label: "Building year", value: "2022" },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-black">About the project</h2>

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
