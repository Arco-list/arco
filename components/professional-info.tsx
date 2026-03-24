"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ReportModal } from "@/components/report-modal"
import type { ProfessionalDetail } from "@/lib/professionals/types"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300"

type ProfessionalInfoProps = {
  professional: ProfessionalDetail
  shareUrl?: string
}

const formatJoinedYear = (value: string | null) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.getFullYear().toString()
}

const formatArray = (values: string[], options?: { limit?: number }) => {
  if (!values || values.length === 0) {
    return null
  }

  const limit = options?.limit ?? values.length
  const trimmed = values.slice(0, limit)
  const remainder = values.length - trimmed.length

  return remainder > 0 ? `${trimmed.join(", ")} (+${remainder})` : trimmed.join(", ")
}

export function ProfessionalInfo({ professional, shareUrl = "" }: ProfessionalInfoProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  const coverImage =
    professional.gallery.find((image) => image.isCover)?.url ??
    professional.company.logoUrl ??
    professional.profile.avatarUrl ??
    PLACEHOLDER_IMAGE

  const formatExperience = (years: number | null) => {
    if (typeof years !== "number" || Number.isNaN(years) || years <= 0) {
      return null
    }
    return years >= 20 ? `${years}+ years` : `${years} years`
  }

  const formatTeamSize = (min: number | null, max: number | null) => {
    if (typeof min === "number" && typeof max === "number") {
      if (min === max) {
        return `${min} team members`
      }
      return `${min}-${max} team members`
    }
    if (typeof min === "number") {
      return `${min}+ team members`
    }
    if (typeof max === "number") {
      return `Up to ${max} people`
    }
    return null
  }

  // Combine primary service with other services (primary service first, company data only)
  const primaryService = professional.company.primaryService
  const allCompanyServices = professional.company.services
  const combinedServices = useMemo(() => {
    if (!primaryService) {
      return allCompanyServices
    }
    // Filter out primary service from services array to avoid duplicates, then add it at the beginning
    const otherServices = allCompanyServices.filter(s => s !== primaryService)
    return [primaryService, ...otherServices]
  }, [primaryService, allCompanyServices])

  const experience = formatExperience(professional.yearsExperience)
  const teamSize = formatTeamSize(professional.company.teamSizeMin, professional.company.teamSizeMax)
  const founded = professional.company.foundedYear ? professional.company.foundedYear.toString() : null

  // Build address from company.address, city, and country
  const addressParts = [
    professional.company.address,
    professional.company.city,
    professional.company.country
  ].filter(Boolean)
  const address = addressParts.length > 0 ? addressParts.join(", ") : null

  const certificates = formatArray(professional.company.certificates)

  // Build details in grid format (similar to project details)
  const detailItems = [
    { label: "Services", value: formatArray(combinedServices) || "⚠️ Missing primary service" },
    { label: "Experience", value: experience },
    { label: "Team size", value: teamSize },
    { label: "Languages", value: formatArray(professional.company.languages) },
    { label: "Address", value: address },
    { label: "Hourly rate", value: professional.hourlyRateDisplay },
    { label: "Founded", value: founded },
    { label: "Certificates", value: certificates },
    { label: "Joined", value: formatJoinedYear(professional.profile.joinedAt ?? null) },
    { label: "Verified", value: professional.isVerified ? "Yes" : undefined },
  ].filter((item) => Boolean(item.value))

  const subtitle = useMemo(() => {
    // Use company's PRIMARY service (from primary_service_id), NOT the first item in services array
    const service = professional.company.primaryService || professional.company.services[0]
    const location = professional.location

    if (service && location) {
      return `${service} in ${location}`
    }
    if (service) {
      return service
    }
    if (location) {
      return location
    }
    return professional.title || null
  }, [professional.company.primaryService, professional.company.services, professional.location, professional.title])

  const description = professional.description || ""
  const MAX_CHARS = 200
  const shouldTruncate = description.length > MAX_CHARS
  const displayDescription = shouldTruncate && !isDescriptionExpanded
    ? description.substring(0, MAX_CHARS) + "..."
    : description

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3 flex-1">
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px', lineHeight: '1.2' }}>{professional.name}</h1>
          {subtitle ? <h2 className="text-base md:text-xl font-semibold text-foreground" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.3px', lineHeight: '1.2' }}>{subtitle}</h2> : null}

          {description ? (
            <div className="space-y-2">
              <p className="max-w-3xl text-foreground">{displayDescription}</p>
              {shouldTruncate && (
                <Button
                  variant="link"
                  className="p-0 text-red-600 hover:text-red-700"
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                >
                  {isDescriptionExpanded ? "Show less" : "Show more"}
                </Button>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex-shrink-0">
          <Image
            src={professional.company.logoUrl ?? professional.profile.avatarUrl ?? PLACEHOLDER_IMAGE}
            alt={professional.company.name || professional.name}
            width={80}
            height={80}
            className="h-20 w-20 rounded-full object-cover"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="heading-4 font-bold text-black">Meet the professional</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {detailItems.map((detail) => (
            <div key={detail.label} className="space-y-1">
              <p className="body-small text-text-secondary">{detail.label}</p>
              <p className="body-small font-medium text-foreground">{detail.value}</p>
            </div>
          ))}
        </div>

        <button
          className="body-small text-text-secondary hover:text-foreground underline mt-4"
          onClick={() => setIsReportModalOpen(true)}
        >
          Report this listing
        </button>

        <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} listingType="professional" />
      </div>
    </div>
  )
}
