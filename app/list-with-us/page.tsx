"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { CheckCircle, Upload, Palette, ChevronLeft, ChevronRight, User } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

export default function ListWithUsPage() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0)

  const testimonials = [
    {
      name: "Jade Mills",
      company: "Coldwell Banker Realty",
      quote:
        "I turned down connects my listings with other luxury goals that my clients want to see, so my clients feel like they are in good company.",
      image: "/placeholder.svg?height=80&width=80",
    },
    {
      name: "Sarah Johnson",
      company: "Sotheby's International Realty",
      quote:
        "The platform has transformed how I showcase properties to high-end clients. The professional presentation makes all the difference.",
      image: "/placeholder.svg?height=80&width=80",
    },
    {
      name: "Michael Chen",
      company: "Christie's International Real Estate",
      quote:
        "Outstanding results in reaching qualified buyers. The global exposure has significantly increased our property visibility.",
      image: "/placeholder.svg?height=80&width=80",
    },
  ]

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="pt-24 md:pt-32 pb-12 md:pb-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6 text-center">
            <h1 className="mb-4 md:mb-6 px-4">
              Attract high-end homeowners
            </h1>
            <p className="text-base md:text-lg lg:text-xl text-text-secondary mb-6 md:mb-8 max-w-4xl mx-auto leading-relaxed px-2">
              Join Arco and connect with homeowners who value exceptional design and quality. By showcasing your completed projects, you put your company in front of clients seeking inspiration and the right professionals to bring their dream to life.
            </p>
            <Button asChild size="lg">
              <Link href="/create-company">Get started</Link>
            </Button>
          </div>
        </section>

        {/* Trusted by Section */}
        {/* <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <h2 className="text-2xl font-medium text-center mb-12 text-foreground">Trusted by leading professionals</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8 items-center opacity-60">
              {[
                "Christie's",
                "Sotheby's",
                "Berkshire Hathaway",
                "Keller Williams",
                "Compass",
                "Coldwell Banker",
                "Barnes",
                "Douglas Elliman",
              ].map((brand, index) => (
                <div key={index} className="text-center">
                  <div className="h-12 flex items-center justify-center">
                    <span className="text-lg font-medium text-text-secondary">{brand}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section> */}

        {/* Reach Wider Audience */}
        <section className="py-12 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="text-center lg:text-left">
                <h2 className="mb-4 md:mb-6">Reach a wider audience</h2>
                <p className="text-base md:text-lg text-text-secondary mb-6 md:mb-8 leading-relaxed">
                  Optimize your listings for better visibility. With our advanced global SEO features, your listings are
                  optimized to rank higher in search results, making it easier for potential clients to find your
                  properties across different regions and markets.
                </p>
              </div>
              <div className="flex justify-center">
                <img
                  src="/1.png"
                  alt="Global reach analytics"
                  className="w-full max-w-md object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Showcase Your Work */}
        <section className="py-12 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="flex justify-center order-2 lg:order-1">
                <img
                  src="/2.png"
                  alt="Portfolio showcase"
                  className="w-full max-w-md object-contain"
                />
              </div>
              <div className="text-center lg:text-left order-1 lg:order-2">
                <h2 className="mb-4 md:mb-6">Showcase your work</h2>
                <p className="text-base md:text-lg text-text-secondary leading-relaxed">
                  Our platform provides you with customizable tools to create a professional online presence.
                  Establishing a strong brand identity allows you to gain the trust of buyers and sellers, ultimately
                  leading to more business.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Portfolio Section */}
        <section className="py-12 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="text-center lg:text-left">
                <h2 className="mb-4 md:mb-6">Create a stunning portfolio</h2>
                <p className="text-base md:text-lg text-text-secondary leading-relaxed">
                  Shine whenever & build yours—whether it's during the day, in the evening, or on weekends.
                </p>
              </div>
              <div className="flex justify-center">
                <img
                  src="/3.png"
                  alt="Portfolio creation"
                  className="w-full max-w-md object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Direct Access Section */}
        <section className="py-12 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className="flex justify-center order-2 lg:order-1">
                <img
                  src="/4.png"
                  alt="Direct customer access"
                  className="w-full max-w-md object-contain"
                />
              </div>
              <div className="text-center lg:text-left order-1 lg:order-2">
                <h2 className="mb-4 md:mb-6">Get direct access to customers</h2>
                <p className="text-base md:text-lg text-text-secondary leading-relaxed">
                  Homeowners can reach out to you directly through your profile. You can also add all professionals involved in a project, so architects, builders, designers, and more get the recognition they deserve.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonial Section */}
        {/* <section className="py-20 bg-surface">
          <div className="max-w-4xl mx-auto px-4 md:px-6">
            <div className="bg-white rounded-2xl p-8 md:p-12 shadow-lg text-center relative">
              <button
                onClick={prevTestimonial}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-surface hover:bg-surface transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-text-secondary" />
              </button>

              <div className="flex justify-center mb-6">
                <img
                  src={testimonials[currentTestimonial].image || "/placeholder.svg"}
                  alt={testimonials[currentTestimonial].name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground">{testimonials[currentTestimonial].name}</h3>
              <p className="text-text-secondary mb-6">{testimonials[currentTestimonial].company}</p>
              <blockquote className="text-lg text-foreground italic leading-relaxed">
                &ldquo;{testimonials[currentTestimonial].quote}&rdquo;
              </blockquote>

              <button
                onClick={nextTestimonial}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-surface hover:bg-surface transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-text-secondary" />
              </button>

              <div className="flex justify-center mt-8 space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonial(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentTestimonial ? "bg-secondary-hover" : "bg-surface"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section> */}

        {/* How to List Section */}
        <section className="py-12 md:py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
            <h2 className="mb-6 md:mb-8">
              How to list your projects on Arco
            </h2>
            <div className="max-w-6xl mx-auto px-4 md:px-6 mt-8 md:mt-12">
            <div className="grid md:grid-cols-3 gap-8 md:gap-12 lg:gap-16">
              <div className="text-center space-y-3 md:space-y-4">
                <div className="flex justify-center">
                  <User className="h-6 w-6 text-foreground" />
                </div>
                <h4>Sign up in minutes</h4>
                <p className="text-sm md:text-base text-text-secondary leading-relaxed">
                  Create your professional account and join a community of top-tier professionals showcasing the best in residential design and craftsmanship.
                </p>
              </div>
              <div className="text-center space-y-3 md:space-y-4">
                <div className="flex justify-center">
                  <Upload className="h-6 w-6 text-foreground" />
                </div>
                <h4>List your projects</h4>
                <p className="text-sm md:text-base text-text-secondary leading-relaxed">
                  Upload your completed projects, add photos, details, and credit your collaborators to show the full story behind your work.
                </p>
              </div>
              <div className="text-center space-y-3 md:space-y-4">
                <div className="flex justify-center">
                  <Palette className="h-6 w-6 text-foreground" />
                </div>
                <h4>Create portfolio</h4>
                <p className="text-sm md:text-base text-text-secondary leading-relaxed">
                  Build a stunning profile that reflects your brand and expertise. Your portfolio becomes a powerful tool to attract clients, highlight your best work, and stand out from the competition.
                </p>
              </div>
            </div>
          </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-12 md:py-20 bg-[#F5F5F5]">
          <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
            <h2 className="mb-4 md:mb-6">Ready to list your projects?</h2>
            <p className="text-base md:text-lg lg:text-xl mb-6 md:mb-8 text-text-secondary leading-relaxed px-2">
              Inspire professionals to build beautiful and showcase their portfolios to homeowners in search of
              realizing their dream.
            </p>
            <Button asChild size="lg">
              <Link href="/create-company">Get started</Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
