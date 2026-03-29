"use client"

import { useTranslations } from "next-intl"
import type { ProfessionalDetail } from "@/lib/professionals/types"

type ProfessionalDetailsProps = {
  professional: ProfessionalDetail
  projectsCount: number
}

export function ProfessionalDetails({ professional, projectsCount }: ProfessionalDetailsProps) {
  const t = useTranslations("professional_detail")

  const formatExperience = (years: number | null) => {
    if (typeof years !== "number" || Number.isNaN(years) || years <= 0) {
      return null
    }

    return years >= 20 ? t("years_plus", { years }) : t("years_count", { years })
  }

  const formatTeamSize = (min: number | null, max: number | null) => {
    if (typeof min === "number" && typeof max === "number") {
      if (min === max) {
        return t("team_members_exact", { count: min })
      }
      return t("team_members_range", { min, max })
    }

    if (typeof min === "number") {
      return t("team_members_min", { min })
    }

    if (typeof max === "number") {
      return t("team_members_max", { max })
    }

    return null
  }

  const formatProjects = (count: number) => {
    if (!Number.isFinite(count) || count <= 0) {
      return null
    }

    return count >= 50 ? t("projects_count_plus", { count }) : count === 1 ? t("project_one", { count }) : t("project_other", { count })
  }

  const primarySpecialty = professional.specialties[0] || professional.services[0] || null
  const experience = formatExperience(professional.yearsExperience)
  const teamSize = formatTeamSize(professional.company.teamSizeMin, professional.company.teamSizeMax)
  const completedProjects = formatProjects(projectsCount)
  const languages = professional.languages.length > 0 ? professional.languages.join(", ") : null
  const services = professional.services.length > 0 ? professional.services.join(", ") : null
  const founded = professional.company.foundedYear ? professional.company.foundedYear.toString() : null

  const details = [
    { label: t("specialization"), value: primarySpecialty },
    { label: t("experience"), value: experience },
    { label: t("location"), value: professional.location },
    { label: t("projects_completed"), value: completedProjects },
    { label: t("services"), value: services },
    { label: t("languages"), value: languages },
    { label: t("hourly_rate"), value: professional.hourlyRateDisplay },
    { label: t("team_size"), value: teamSize },
    { label: t("founded"), value: founded },
  ].filter((detail) => Boolean(detail.value))

  if (details.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h2 className="heading-4 font-bold text-black">{t("about_the_professional")}</h2>

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
