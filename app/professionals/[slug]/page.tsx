import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { ProfessionalContactSidebar } from "@/components/professional-contact-sidebar"
import { ProfessionalGallery } from "@/components/professional-gallery"
import { ProfessionalInfo } from "@/components/professional-info"
import { ProfessionalProjects } from "@/components/professional-projects"
import { ProfessionalReviews } from "@/components/professional-reviews"
import { ProfessionalActionButtons } from "@/components/professional-action-buttons"
import { fetchProfessionalDetail, fetchProfessionalMetadata } from "@/lib/professionals/queries"
import { BreadcrumbWithTooltip } from "@/components/breadcrumb-with-tooltip"
import { ProfessionalGalleryModalProvider } from "@/contexts/professional-gallery-modal-context"

const REVIEWS_ANCHOR_ID = "professional-reviews"
const PROJECTS_ANCHOR_ID = "professional-projects"
const PLACEHOLDER_IMAGE = "/placeholder.svg?height=800&width=1200"

type PageParams = {
  slug: string
}

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { slug } = await params
  const professional = await fetchProfessionalMetadata(slug)

  if (!professional) {
    return {
      title: "Professional not found · Arco",
    }
  }

  const description =
    professional.description ??
    (professional.location ? `Discover ${professional.name} in ${professional.location}.` : `Discover ${professional.name}.`)

  const image = professional.coverImageUrl ?? PLACEHOLDER_IMAGE

  return {
    title: `${professional.name} · Arco`,
    description,
    openGraph: {
      title: `${professional.name} · Arco`,
      description,
      images: image ? [{ url: image, alt: professional.name }] : undefined,
    },
  }
}

export default async function ProfessionalDetailPage({ params }: { params: Promise<PageParams> }) {
  const { slug } = await params
  const [professional, metadata] = await Promise.all([
    fetchProfessionalDetail(slug),
    fetchProfessionalMetadata(slug)
  ])

  if (!professional) {
    notFound()
  }

  const shareUrl = `/professionals/${professional.slug}`
  const galleryImages = professional.gallery
  const projects = professional.projects
  const reviews = professional.reviews
  const coverImageUrl = galleryImages.find((img) => img.isCover)?.url ?? galleryImages[0]?.url ?? null

  // Transform gallery images for the modal provider
  const galleryImagesForProvider = galleryImages.map((img) => ({
    id: img.id,
    url: img.url,
    alt: img.altText || `Photo of ${professional.name}`,
    isCover: img.isCover,
  }))

  // Build breadcrumbs: Professionals > Location > Parent Category > Primary Service
  const breadcrumbs: Array<{ label: string; href?: string }> = []

  // Base: Professionals
  breadcrumbs.push({ label: "Professionals", href: "/professionals" })

  // Location: City only (matches filter)
  if (metadata?.city) {
    const locationParam = new URLSearchParams({ city: metadata.city })
    breadcrumbs.push({
      label: metadata.city,
      href: `/professionals?${locationParam.toString()}`
    })
  }

  // Parent Category (e.g., "Design & Planning")
  if (metadata?.parentCategory) {
    const parentParam = new URLSearchParams()
    if (metadata.city) {
      parentParam.set("city", metadata.city)
    }
    parentParam.set("services", metadata.parentCategory.id)
    breadcrumbs.push({
      label: metadata.parentCategory.name,
      href: `/professionals?${parentParam.toString()}`
    })
  }

  // Primary Service (e.g., "Architecture")
  if (metadata?.primaryService && metadata?.primaryServiceId) {
    const serviceParam = new URLSearchParams()
    if (metadata.city) {
      serviceParam.set("city", metadata.city)
    }
    serviceParam.set("services", metadata.primaryServiceId)
    breadcrumbs.push({
      label: metadata.primaryService,
      href: `/professionals?${serviceParam.toString()}`
    })
  }

  // Build ProfessionalCard for action buttons
  const professionalCard = {
    id: professional.company.id,
    slug: professional.slug,
    companyId: professional.company.id,
    professionalId: professional.id,
    name: professional.name,
    profession: professional.title || professional.services[0] || professional.specialties[0] || "Professional",
    location: professional.location ?? "Location unavailable",
    rating: Number(professional.ratings.overall.toFixed(2)),
    reviewCount: professional.ratings.total,
    image: coverImageUrl || professional.company.logoUrl || professional.profile.avatarUrl || "/placeholder.svg",
    specialties: professional.specialties,
    isVerified: professional.isVerified,
    domain: professional.company.domain ?? null,
  }

  return (
    <ProfessionalGalleryModalProvider
      professionalName={professional.name}
      companyId={professional.company.id}
      coverImageUrl={coverImageUrl}
      shareUrl={shareUrl}
      images={galleryImagesForProvider}
    >
      <div className="min-h-screen bg-white">
        <Header maxWidth="max-w-7xl" />

        <main className="px-4 py-8 md:px-8 pt-20 md:pt-20">
          <div className="max-w-7xl mx-auto">
            {/* Back Button and Action Buttons */}
            <div className="flex flex-row items-center justify-between mb-4 gap-3 md:gap-4 mt-4">
              <Button variant="tertiary" size="tertiary" asChild className="w-20 min-w-[5rem] max-w-[5rem]">
                <Link href="/professionals">
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Link>
              </Button>

              <div>
                <ProfessionalActionButtons
                  professional={professionalCard}
                  professionalTitle={professional.title}
                  coverImageUrl={coverImageUrl}
                  shareUrl={shareUrl}
                />
              </div>
            </div>

            <div className="mb-8">
              <ProfessionalGallery />
            </div>

            {/* Breadcrumb Row */}
            <div className="mb-2">
              <BreadcrumbWithTooltip items={breadcrumbs} />
            </div>

            <div className="grid grid-cols-1 items-start gap-8 py-4 lg:grid-cols-3">
              <div className="space-y-8 lg:col-span-2">
                <ProfessionalInfo professional={professional} shareUrl={shareUrl} reviewsAnchorId={REVIEWS_ANCHOR_ID} />
              </div>

              <div className="lg:col-span-1">
                <ProfessionalContactSidebar professional={professional} />
              </div>
            </div>
          </div>
        </main>

        <ProfessionalProjects id={PROJECTS_ANCHOR_ID} projects={projects} />

        <ProfessionalReviews
          id={REVIEWS_ANCHOR_ID}
          companyId={professional.id}
          professionalName={professional.name}
          ratings={professional.ratings}
          reviews={reviews}
        />

        <Footer maxWidth="max-w-7xl" />
      </div>
    </ProfessionalGalleryModalProvider>
  )
}
