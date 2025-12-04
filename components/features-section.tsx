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
    <section className="py-10 px-4 md:px-8">
      <div className="max-w-[1800px] mx-auto rounded-lg p-8 mb-4" style={{ backgroundColor: '#F8F4F4' }}>
        <h3 className="heading-3">Realize your next dream project</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {features.map((feature, index) => (
            <div key={index}>
              <div className="flex justify-start mb-6">
                <feature.icon className="h-8 w-8 text-foreground" />
              </div>
              <h5 className="heading-5 mb-4">{feature.title}</h5>
              <p className="body-regular text-text-secondary leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
