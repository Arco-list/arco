"use client"

import { useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { Star } from "lucide-react"

import type { ProfessionalDetail } from "@/lib/professionals/types"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300"

type ProfessionalInfoProps = {
  professional: ProfessionalDetail
  shareUrl?: string
  reviewsAnchorId?: string
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

export function ProfessionalInfo({ professional, shareUrl = "", reviewsAnchorId }: ProfessionalInfoProps) {
  const coverImage =
    professional.gallery.find((image) => image.isCover)?.url ??
    professional.company.logoUrl ??
    professional.profile.avatarUrl ??
    PLACEHOLDER_IMAGE

  const ratingDisplay = useMemo(
    () => ({
      value: Number(professional.ratings.overall.toFixed(2)),
      total: professional.ratings.total,
    }),
    [professional.ratings.overall, professional.ratings.total]
  )

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

  const primarySpecialty = professional.specialties[0] || professional.services[0] || null
  const experience = formatExperience(professional.yearsExperience)
  const teamSize = formatTeamSize(professional.company.teamSizeMin, professional.company.teamSizeMax)
  const founded = professional.company.foundedYear ? professional.company.foundedYear.toString() : null

  const leftSummaryItems = [
    { label: "Specialization", value: primarySpecialty },
    { label: "Experience", value: experience },
    { label: "Services", value: formatArray(professional.services, { limit: 3 }) },
    { label: "Languages", value: formatArray(professional.languages, { limit: 3 }) },
    { label: "Team size", value: teamSize },
  ].filter((item) => Boolean(item.value))

  const rightSummaryItems = [
    { label: "Location", value: professional.location },
    { label: "Hourly rate", value: professional.hourlyRateDisplay },
    { label: "Founded", value: founded },
    {
      label: "Joined",
      value: formatJoinedYear(professional.profile.joinedAt ?? null),
    },
    {
      label: "Verified",
      value: professional.isVerified ? "Yes" : undefined,
    },
  ].filter((item) => Boolean(item.value))

  const ratingHref = reviewsAnchorId ? `#${reviewsAnchorId}` : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3 flex-1">
          <h1 className="text-3xl font-bold text-black">{professional.name}</h1>
          {professional.title ? <h2 className="text-xl text-gray-600">{professional.title}</h2> : null}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-semibold text-gray-900">{ratingDisplay.value.toFixed(2)}</span>
            </div>

            <span className="text-sm text-gray-500">·</span>

            {ratingHref ? (
              <a href={ratingHref} className="text-sm text-gray-500 underline hover:text-gray-700">
                {ratingDisplay.total} review{ratingDisplay.total === 1 ? "" : "s"}
              </a>
            ) : (
              <span className="text-sm text-gray-500">
                {ratingDisplay.total} review{ratingDisplay.total === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {professional.description ? (
            <p className="max-w-3xl text-gray-700">{professional.description}</p>
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

      <div className="border-y border-gray-200 py-6">
        <h3 className="mb-6 text-xl font-semibold text-black">Meet the professional</h3>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            {leftSummaryItems.map((item) => (
              <div key={item.label}>
                <h4 className="mb-1 text-sm font-medium text-gray-900">{item.label}</h4>
                <p className="text-sm text-gray-600">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {rightSummaryItems.map((item) => (
              <div key={item.label}>
                <h4 className="mb-1 text-sm font-medium text-gray-900">{item.label}</h4>
                <p className="text-sm text-gray-600">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
