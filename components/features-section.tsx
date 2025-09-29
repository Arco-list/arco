import { Lightbulb, Heart, Users } from "lucide-react"

const features = [
  {
    icon: Lightbulb,
    title: "Be inspired by amazing projects",
    description:
      "Explore a wide range of innovative architectural and interior design projects to ignite new ideas and spark your creativity.",
  },
  {
    icon: Heart,
    title: "Create lists with your favorites",
    description:
      "Easily save and share inspiring projects and trusted professionals to help you define your style and find the perfect team.",
  },
  {
    icon: Users,
    title: "Get in touch with professionals",
    description:
      "Reach out to the right experts and start turning your saved ideas into a real project with the support of experienced professionals.",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-16 px-4 md:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 mb-4 text-left">Realize your next dream project</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {features.map((feature, index) => (
            <div key={index} className="text-left">
              <div className="flex justify-start mb-6">
                <feature.icon className="h-8 w-8 text-gray-700" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
