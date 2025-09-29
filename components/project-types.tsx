import Link from "next/link"

const projectTypes = [
  {
    title: "Villa",
    image: "/placeholder.svg?height=300&width=400",
  },
  {
    title: "Outdoor pool",
    image: "/placeholder.svg?height=300&width=400",
  },
  {
    title: "Kitchen",
    image: "/placeholder.svg?height=300&width=400",
  },
  {
    title: "Bathroom",
    image: "/placeholder.svg?height=300&width=400",
  },
  {
    title: "Sauna",
    image: "/placeholder.svg?height=300&width=400",
  },
  {
    title: "Garden house",
    image: "/placeholder.svg?height=300&width=400",
  },
]

export function ProjectTypes() {
  return (
    <section className="py-16 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-semibold text-gray-900 mb-8">Popular project types</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {projectTypes.map((type, index) => (
            <Link
              key={index}
              href={`/projects?type=${encodeURIComponent(type.title)}`}
              className="group cursor-pointer"
            >
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3">
                <img
                  src={type.image || "/placeholder.svg"}
                  alt={type.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
                <h3 className="absolute bottom-4 left-4 text-white font-semibold text-2xl">{type.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
