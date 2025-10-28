import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { ProfessionalContactSidebar } from "@/components/professional-contact-sidebar"
import { ProfessionalGallery } from "@/components/professional-gallery"
import { ProfessionalInfo } from "@/components/professional-info"
import { ProfessionalProjects } from "@/components/professional-projects"
import { ProfessionalReviews } from "@/components/professional-reviews"
import { ProfessionalActionButtons } from "@/components/professional-action-buttons"
import { fetchProfessionalDetail, fetchProfessionalMetadata } from "@/lib/professionals/queries"

const REVIEWS_ANCHOR_ID = "professional-reviews"
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
  const professional = await fetchProfessionalDetail(slug)

  if (!professional) {
    notFound()
  }

  const shareUrl = `/professionals/${professional.slug}`
  const galleryImages = professional.gallery
  const projects = professional.projects
  const reviews = professional.reviews
  const coverImageUrl = galleryImages.find((img) => img.isCover)?.url ?? galleryImages[0]?.url ?? null

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
    <div className="min-h-screen bg-white">
      <Header maxWidth="max-w-7xl" />

      <main className="px-4 py-8 md:px-8 pt-20 md:pt-20">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb and Action Buttons Row */}
          <div className="flex items-center justify-between mb-4 gap-4">
            <nav className="text-sm text-gray-600" aria-label="Breadcrumb">
              <ol className="flex items-center gap-2">
                <li>
                  <Link href="/professionals" className="hover:text-gray-900">
                    Professionals
                  </Link>
                </li>
                <li className="text-gray-400">&gt;</li>
                <li className="text-gray-900 font-medium">{professional.name}</li>
              </ol>
            </nav>

            <ProfessionalActionButtons
              professional={professionalCard}
              professionalTitle={professional.title}
              coverImageUrl={coverImageUrl}
              shareUrl={shareUrl}
            />
          </div>

          <div className="mb-8">
            <ProfessionalGallery professionalName={professional.name} images={galleryImages} />
          </div>

          <div className="grid grid-cols-1 items-start gap-8 py-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <ProfessionalInfo professional={professional} shareUrl={shareUrl} reviewsAnchorId={REVIEWS_ANCHOR_ID} />
            </div>

            <div className="lg:col-span-1">
              <ProfessionalContactSidebar professional={professional} />
            </div>
          </div>
        </div>
      </main>

      <div className="w-full bg-white py-16">
        <div className="px-4 md:px-8">
          <div className="max-w-7xl mx-auto">
            <ProfessionalProjects projects={projects} />
          </div>
        </div>
      </div>

      <ProfessionalReviews
        id={REVIEWS_ANCHOR_ID}
        companyId={professional.id}
        professionalName={professional.name}
        ratings={professional.ratings}
        reviews={reviews}
      />

      <Footer maxWidth="max-w-7xl" />
    </div>
  )
}
