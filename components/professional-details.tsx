"use client"

import type { ProfessionalDetail } from "@/lib/professionals/types"

type ProfessionalDetailsProps = {
  professional: ProfessionalDetail
  projectsCount: number
}

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

const formatProjects = (count: number) => {
  if (!Number.isFinite(count) || count <= 0) {
    return null
  }

  return count >= 50 ? `${count}+ projects` : `${count} project${count === 1 ? "" : "s"}`
}

export function ProfessionalDetails({ professional, projectsCount }: ProfessionalDetailsProps) {
  const primarySpecialty = professional.specialties[0] || professional.services[0] || null
  const experience = formatExperience(professional.yearsExperience)
  const teamSize = formatTeamSize(professional.company.teamSizeMin, professional.company.teamSizeMax)
  const completedProjects = formatProjects(projectsCount)
  const languages = professional.languages.length > 0 ? professional.languages.join(", ") : null
  const services = professional.services.length > 0 ? professional.services.join(", ") : null
  const founded = professional.company.foundedYear ? professional.company.foundedYear.toString() : null

  const details = [
    { label: "Specialization", value: primarySpecialty },
    { label: "Experience", value: experience },
    { label: "Location", value: professional.location },
    { label: "Projects completed", value: completedProjects },
    { label: "Services", value: services },
    { label: "Languages", value: languages },
    { label: "Hourly rate", value: professional.hourlyRateDisplay },
    { label: "Team size", value: teamSize },
    { label: "Founded", value: founded },
  ].filter((detail) => Boolean(detail.value))

  if (details.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h2 className="heading-4 font-bold text-black">About the professional</h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {details.map((detail) => (
          <div key={detail.label} className="space-y-1">
            <p className="body-small text-text-secondary">{detail.label}</p>
            <p className="body-small font-medium text-foreground">{detail.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
