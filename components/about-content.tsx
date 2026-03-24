"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useEffect, useRef } from "react"

type ProjectCarouselItem = {
  id: string
  title: string
  slug: string | null
  imageUrl: string | null
  location: string | null
}

interface AboutContentProps {
  projects: ProjectCarouselItem[]
}

export function AboutContent({ projects }: AboutContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const scrollContainer = scrollRef.current
    if (!scrollContainer || projects.length === 0) return

    let scrollPosition = 0
    const scrollSpeed = 0.5 // pixels per frame

    const animate = () => {
      if (!scrollContainer) return

      scrollPosition += scrollSpeed

      // Get the width of one set of items
      const scrollWidth = scrollContainer.scrollWidth / 2

      // Reset position when we've scrolled through one complete set
      if (scrollPosition >= scrollWidth) {
        scrollPosition = 0
      }

      scrollContainer.scrollLeft = scrollPosition
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [projects.length])

  // Duplicate projects for seamless infinite scroll
  const duplicatedProjects = [...projects, ...projects]

  return (
    <>
      {/* Hero Section */}
      <section className="pt-24 md:pt-32 pb-12 md:pb-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 text-center">
          <h1 className="heading-1 mb-4 md:mb-6 px-4">
            Build beautiful
          </h1>
          <p className="body-large text-text-secondary mb-6 md:mb-8 max-w-4xl mx-auto leading-relaxed px-2">
            Inspiring the world to build beautifully through the most inspiring portfolio of architectural achievements.
          </p>
          <Button asChild>
            <a href="mailto:info@arcolist.com">Get in touch</a>
          </Button>
        </div>
      </section>

      {/* Horizontal Carousel Section */}
      <section className="py-12 md:py-20 bg-white overflow-hidden">
        <div className="w-full">
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-hidden pb-2 px-4 md:px-8"
            style={{
              scrollBehavior: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {duplicatedProjects.map((project, index) => (
              <Link
                key={`${project.id}-${index}`}
                href={project.slug ? `/projects/${project.slug}` : "#"}
                className="flex-none w-80 sm:w-72 md:w-60 lg:w-64 xl:w-72 group cursor-pointer"
              >
                <div className="relative overflow-hidden rounded-lg bg-surface">
                  <img
                    src={project.imageUrl || "/placeholder.svg"}
                    alt={project.title}
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="mt-3">
                  <p className="body-small font-medium leading-[1.2] tracking-[0] text-foreground line-clamp-2">
                    {project.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Three Cards Section */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="heading-2 mb-4 md:mb-6">
              <span className="inline-flex items-center justify-center flex-wrap">
                <span>Building&nbsp;</span>
                <span className="inline-flex items-baseline">
                  <img
                    src="/Asset co.avif"
                    alt="co"
                    className="h-[0.55em] w-auto object-contain align-baseline"
                  />
                  <span>nnections</span>
                </span>
              </span>
            </h2>
            <p className="body-large text-text-secondary max-w-4xl mx-auto leading-relaxed">
              We believe beauty is built through collaboration. Our platform connects homeowners, professionals, and brands to create a vibrant community where ideas, expertise, and products come together to shape exceptional architecture and design.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-8 lg:gap-12">
            {/* Homeowners Card */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 w-full aspect-[4/3] overflow-hidden rounded-lg">
                <img
                  src="/Homeowners .avif"
                  alt="Homeowners"
                  className="w-full h-full object-cover"
                />
              </div>
              <h4 className="heading-4 mb-3">Homeowners</h4>
              <p className="body-regular text-text-secondary leading-relaxed">
                We help homeowners move from inspiration to realisation by connecting them with featured projects and trusted professionals to bring their vision to life.
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-4">
                <Link href="/projects">Explore projects</Link>
              </Button>
            </div>

            {/* Professionals Card */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 w-full aspect-[4/3] overflow-hidden rounded-lg">
                <img
                  src="/Professionals.avif"
                  alt="Professionals"
                  className="w-full h-full object-cover"
                />
              </div>
              <h4 className="heading-4 mb-3">Professionals</h4>
              <p className="body-regular text-text-secondary leading-relaxed">
                Architects, designers, builders and many other professionals use our platform to showcase their work, grow their network, and reach clients who value quality and creativity.
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-4">
                <Link href="/businesses/architects">List your project</Link>
              </Button>
            </div>

            {/* Brands Card */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 w-full aspect-[4/3] overflow-hidden rounded-lg">
                <img
                  src="/Brands.avif"
                  alt="Brands"
                  className="w-full h-full object-cover"
                />
              </div>
              <h4 className="heading-4 mb-3">Brands</h4>
              <p className="body-regular text-text-secondary leading-relaxed">
                We connect design-focused brands with the people shaping tomorrow's most inspiring spaces, offering visibility at the moment it matters most.
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-4">
                <a href="mailto:info@arcolist.com">Get in touch</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-12 md:py-20 bg-[#F5F5F5]">
        <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
          <h2 className="heading-2 mb-4 md:mb-6">
            Shape this space together
          </h2>
          <p className="body-large mb-6 md:mb-8 text-text-secondary leading-relaxed px-2">
            At Arco, we're on a mission to transform how dreams become homes. Join us and help bring inspiring spaces to life. Together, we can build something extraordinary.
          </p>
          <Button asChild>
            <a href="mailto:info@arcolist.com">Get in touch</a>
          </Button>
        </div>
      </section>
    </>
  )
}
