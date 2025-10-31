"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"

type Category = "Support" | "Account" | "Features" | "Security" | "Other"

interface FAQItem {
  question: string
  answer: string
  category: Category
}

const faqItems: FAQItem[] = [
  // Support Questions
  {
    category: "Support",
    question: "How can I get help with my architectural project?",
    answer:
      "Our support team is available to help you connect with the right professionals for your project. You can reach out through our contact form or browse our extensive network of verified architects and contractors.",
  },
  {
    category: "Support",
    question: "What if I need immediate assistance with my project?",
    answer:
      "For urgent project needs, you can contact our priority support line. We'll connect you with available professionals in your area within 24 hours.",
  },
  {
    category: "Support",
    question: "Do you provide project consultation services?",
    answer:
      "Yes, we offer initial project consultations to help you understand scope, budget, and timeline. Our experts can guide you through the planning process.",
  },
  // Account Questions
  {
    category: "Account",
    question: "How do I create a professional profile?",
    answer:
      "Simply sign up and complete your professional profile with your credentials, portfolio, and areas of expertise. Our verification team will review and approve qualified professionals.",
  },
  {
    category: "Account",
    question: "How do I update my project portfolio?",
    answer:
      "You can easily add new projects, photos, and descriptions through your dashboard. High-quality images and detailed descriptions help attract more clients.",
  },
  {
    category: "Account",
    question: "What if I forget my password?",
    answer:
      "Use the 'Forgot Password' link on the login page. We'll send you a secure reset link to your registered email address.",
  },
  // Features Questions
  {
    category: "Features",
    question: "What types of architectural projects can I find?",
    answer:
      "Our platform features residential, commercial, and specialty projects including houses, kitchens, bathrooms, outdoor spaces, and unique architectural designs.",
  },
  {
    category: "Features",
    question: "How do I search for specific project types?",
    answer:
      "Use our advanced filters to search by project type, style, location, budget range, and specific features. You can also browse by categories like Villa, Kitchen, Bathroom, or Outdoor spaces.",
  },
  {
    category: "Features",
    question: "Can I save projects I'm interested in?",
    answer:
      "Yes, you can save projects to your favorites list and create custom collections. You can also share projects with others.",
  },
  // Security Questions
  {
    category: "Security",
    question: "How do you verify professional credentials?",
    answer:
      "We verify all professional licenses, certifications, and credentials through official channels. Only verified professionals can offer services on our platform.",
  },
  {
    category: "Security",
    question: "Is my project information secure?",
    answer:
      "We use industry-standard encryption to protect all project data and personal information. Your privacy and security are our top priorities.",
  },
  {
    category: "Security",
    question: "How do you handle payment security?",
    answer:
      "All payments are processed through secure, encrypted channels. We never store payment information and use trusted payment processors for all transactions.",
  },
  // Other Questions
  {
    category: "Other",
    question: "What are your pricing plans?",
    answer:
      "We offer flexible pricing plans for both clients and professionals. Check our pricing page for detailed information about features and costs.",
  },
  {
    category: "Other",
    question: "Do you offer refunds?",
    answer:
      "Yes, we have a fair refund policy. If you're not satisfied with our service, contact our support team within 30 days for a full refund.",
  },
  {
    category: "Other",
    question: "How can I become a featured professional?",
    answer:
      "Maintain high ratings, complete projects on time, and showcase exceptional work. Our algorithm promotes top-performing professionals to featured status.",
  },
]

const categories: Category[] = ["Support", "Account", "Features", "Security", "Other"]

const TOP_PADDING = 300

const Faq12 = () => {
  const [activeCategory, setActiveCategory] = useState<Category>("Support")
  const observerRef = useRef<IntersectionObserver | null>(null)
  const isScrollingRef = useRef(false)
  const categoryRefs = useRef<Record<Category, HTMLDivElement | null>>({
    Support: null,
    Account: null,
    Features: null,
    Security: null,
    Other: null,
  })

  const setupObserver = useCallback(() => {
    observerRef.current?.disconnect()

    let debounceTimeout: NodeJS.Timeout

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Skip if we're programmatically scrolling
        if (isScrollingRef.current) return

        // Clear any pending timeout
        if (debounceTimeout) {
          clearTimeout(debounceTimeout)
        }

        // Debounce the category update
        debounceTimeout = setTimeout(() => {
          const intersectingEntries = entries.filter((entry) => entry.isIntersecting)

          // Find the entry that's closest to being 100px from the top
          const entry = intersectingEntries.reduce(
            (closest, current) => {
              const rect = current.boundingClientRect
              const distanceFromThreshold = Math.abs(rect.top - TOP_PADDING)
              const closestDistance = closest
                ? Math.abs(closest.boundingClientRect.top - TOP_PADDING)
                : Number.POSITIVE_INFINITY

              return distanceFromThreshold < closestDistance ? current : closest
            },
            null as IntersectionObserverEntry | null,
          )

          if (entry) {
            const category = entry.target.getAttribute("data-category") as Category
            if (category) {
              setActiveCategory(category)
            }
          }
        }, 150)
      },
      {
        root: null,
        rootMargin: `-${TOP_PADDING}px 0px -100% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    Object.entries(categoryRefs.current).forEach(([category, element]) => {
      if (element) {
        element.setAttribute("data-category", category)
        observerRef.current?.observe(element)
      }
    })

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
    }
  }, [])

  useEffect(() => {
    const cleanup = setupObserver()
    return () => {
      cleanup()
      observerRef.current?.disconnect()
    }
  }, [setupObserver])

  const handleCategoryClick = (category: Category) => {
    setActiveCategory(category)
    isScrollingRef.current = true

    const element = document.getElementById(`faq-${category.toLowerCase()}`)
    if (element) {
      element.style.scrollMargin = `${TOP_PADDING}px`
      element.scrollIntoView({ behavior: "smooth", block: "start" })

      setTimeout(() => {
        isScrollingRef.current = false
      }, 1000)
    }
  }

  return (
    <section className="min-h-screen bg-white py-32 dark:bg-white">
      <div className="container max-w-4xl">
        <div className="text-center">
          <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">Help Center</h1>
          <p className="mx-auto mt-4 max-w-xl text-center text-balance text-muted-foreground">
            Find answers to common questions about using Arco to discover and connect with architectural professionals.
          </p>
        </div>

        <div className="mt-8 grid max-w-5xl gap-8 md:mt-12 md:grid-cols-[200px_1fr] md:gap-12 lg:mt-16">
          {/* Sidebar */}
          <div className="sticky top-24 flex h-fit flex-col gap-4 max-md:hidden">
            {categories.map((category) => (
              <Button
                variant="ghost"
                key={category}
                onClick={() => handleCategoryClick(category)}
                className={`justify-start text-left text-xl transition-colors ${
                  activeCategory === category ? "font-semibold" : "font-normal hover:opacity-75"
                }`}
              >
                {category}
              </Button>
            ))}
          </div>

          {/* FAQ Items by Category */}
          <div className="space-y-6">
            {categories.map((category) => {
              const categoryItems = faqItems.filter((item) => item.category === category)

              return (
                <div
                  key={category}
                  id={`faq-${category.toLowerCase()}`}
                  ref={(el) => {
                    categoryRefs.current[category] = el
                  }}
                  className={cn(`rounded-xl`, activeCategory === category ? "bg-gray-100" : "bg-gray-50", "px-6")}
                  style={{
                    scrollMargin: `${TOP_PADDING}px`,
                  }}
                >
                  <Accordion type="single" collapsible defaultValue={`${categories[0]}-0`} className="w-full">
                    {categoryItems.map((item, i) => (
                      <AccordionItem key={i} value={`${category}-${i}`} className="border-b border-muted last:border-0">
                        <AccordionTrigger className="text-base font-medium hover:no-underline">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-base font-medium text-muted-foreground">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export { Faq12 }
