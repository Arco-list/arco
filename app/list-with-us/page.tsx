"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { CheckCircle, Upload, Palette, ChevronLeft, ChevronRight } from "lucide-react"
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
      <Header transparent />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative h-[70vh] text-white overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="/placeholder.svg?height=600&width=1200"
              alt="Modern luxury house"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 md:px-6 h-full flex items-end pb-20">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Attract
                <br />
                high-end
                <br />
                homeowners
              </h1>
              <Button asChild className="bg-white text-black hover:bg-gray-100 px-8 py-3 text-lg font-medium">
                <Link href="/create-company">Get started</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Trusted by Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <h2 className="text-2xl font-medium text-center mb-12 text-gray-800">Trusted by leading professionals</h2>
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
                    <span className="text-lg font-medium text-gray-600">{brand}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Reach Wider Audience */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900">Reach a wider audience</h2>
                <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                  Optimize your listings for better visibility. With our advanced global SEO features, your listings are
                  optimized to rank higher in search results, making it easier for potential clients to find your
                  properties across different regions and markets.
                </p>
              </div>
              <div className="flex justify-center">
                <img
                  src="/placeholder.svg?height=300&width=400"
                  alt="Global reach analytics"
                  className="w-full max-w-md h-64 object-cover rounded-2xl shadow-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Showcase Your Work */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="flex justify-center">
                <img
                  src="/placeholder.svg?height=300&width=400"
                  alt="Portfolio showcase"
                  className="w-full max-w-md h-64 object-cover rounded-2xl shadow-lg"
                />
              </div>
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900">Showcase your work</h2>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Our platform provides you with customizable tools to create a professional online presence.
                  Establishing a strong brand identity allows you to gain the trust of buyers and sellers, ultimately
                  leading to more business.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Portfolio Section */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-block bg-gray-200 text-gray-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
                  Coming soon
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900">Create a stunning portfolio</h2>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Shine whenever & build yours—whether it’s during the day, in the evening, or on weekends.
                </p>
              </div>
              <div className="flex justify-center">
                <img
                  src="/placeholder.svg?height=300&width=400"
                  alt="Portfolio creation"
                  className="w-full max-w-md h-64 object-cover rounded-2xl shadow-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Direct Access Section */}
        <section className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900">Get direct access to customers</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              You are always in control of your leads, with every inquiry — whether via written messages or direct phone
              calls — delivered to you instantly. This streamlined process ensures seamless communication and faster
              deal closures.
            </p>
          </div>
        </section>

        {/* Testimonial Section */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 md:px-6">
            <div className="bg-white rounded-2xl p-8 md:p-12 shadow-lg text-center relative">
              <button
                onClick={prevTestimonial}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>

              <div className="flex justify-center mb-6">
                <img
                  src={testimonials[currentTestimonial].image || "/placeholder.svg"}
                  alt={testimonials[currentTestimonial].name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">{testimonials[currentTestimonial].name}</h3>
              <p className="text-gray-600 mb-6">{testimonials[currentTestimonial].company}</p>
              <blockquote className="text-lg text-gray-700 italic leading-relaxed">
                &ldquo;{testimonials[currentTestimonial].quote}&rdquo;
              </blockquote>

              <button
                onClick={nextTestimonial}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>

              <div className="flex justify-center mt-8 space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonial(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentTestimonial ? "bg-gray-800" : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How to List Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">
              How to list your projects on Arco
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-gray-900">Sign up</h3>
                <p className="text-gray-600 leading-relaxed">
                  Shine whenever & build yours—whether it’s during the day, in the evening, or on weekends. Once you
                  sign up, you have full control over your schedule, timing your work around your life and your clients’
                  needs.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Upload className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-gray-900">Upload your project</h3>
                <p className="text-gray-600 leading-relaxed">
                  You decide how much to charge per hour, including any extra fees for materials, travel, or other
                  services. Plus, you get paid immediately after each task.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Palette className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-gray-900">Create portfolio</h3>
                <p className="text-gray-600 leading-relaxed">
                  Stay safe on the road with Ora’s additional insurance coverage and 24/7 roadside assistance. We’ve got
                  every trip covered at every step.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="relative py-20 text-white overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="/placeholder.svg?height=400&width=1200"
              alt="Modern house at night"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to list your projects?</h2>
            <p className="text-xl mb-8 opacity-90">
              Inspire professionals to build beautiful and showcase their portfolios to homeowners in search of
              realizing their dream.
            </p>
            <Button asChild className="bg-white text-black hover:bg-gray-100 px-8 py-3 text-lg font-medium">
              <Link href="/create-company">Get started</Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
