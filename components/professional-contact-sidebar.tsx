'use client'

import Image from "next/image"
import { Fragment, useState } from "react"
import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Pinterest,
  type LucideIcon,
} from "lucide-react"

import type { ProfessionalDetail } from "@/lib/professionals/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ReportModal } from "./report-modal"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=120&width=120"
const SOCIAL_ICON_MAP: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  pinterest: Pinterest,
}

type ProfessionalContactSidebarProps = {
  professional: ProfessionalDetail
}

const normalizeUrl = (value: string | null) => {
  if (!value) {
    return null
  }

  try {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }

    return `https://${trimmed}`
  } catch (error) {
    return null
  }
}

export function ProfessionalContactSidebar({ professional }: ProfessionalContactSidebarProps) {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const company = professional.company
  const phone = company.phone ?? null
  const email = company.email ?? null
  const website = normalizeUrl(company.website ?? company.domain ?? null)
  const location = professional.location ?? null
  const displayName = company.name || professional.name || "Professional"
  const imageSrc = company.logoUrl ?? professional.profile.avatarUrl ?? PLACEHOLDER_IMAGE

  const primaryActions = [
    {
      icon: Mail,
      label: email ?? "Email unavailable",
      href: email ? `mailto:${email}` : null,
      disabled: !email,
    },
    {
      icon: Globe,
      label: website ? "Visit website" : "Website unavailable",
      href: website,
      disabled: !website,
      external: true,
    },
    {
      icon: MapPin,
      label: location ?? "Location unavailable",
      href: null,
      disabled: !location,
    },
  ]

  const socialLinks = professional.socialLinks
    .map((link) => {
      const platform = link.platform?.toLowerCase()
      if (!platform || !link.url) {
        return null
      }

      const href = normalizeUrl(link.url)
      if (!href) {
        return null
      }

      const Icon = SOCIAL_ICON_MAP[platform] ?? Globe
      return { href, Icon, platform }
    })
    .filter((entry): entry is { href: string; Icon: LucideIcon; platform: string } => Boolean(entry))

  return (
    <div className="space-y-4">
      <Card className="sticky top-24 z-10 space-y-6 p-6">
        <div className="space-y-4 text-center">
          <h3 className="text-lg font-semibold">Contact {displayName}</h3>

          <div className="flex justify-center">
            <Image
              src={imageSrc}
              alt={displayName}
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover"
            />
          </div>

          <div className="space-y-3 text-left">
            <div className="space-y-2">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  {phone ? (
                    <RevealPhoneNumber phone={phone} />
                  ) : (
                    <span className="text-gray-400">Phone unavailable</span>
                  )}
                </div>
              </div>

              {primaryActions.map(({ icon: Icon, label, href, disabled, external }, index) => (
                <Fragment key={index}>
                  <Button
                    variant="ghost"
                    size="sm"
                  className="flex w-full items-center justify-start gap-2 px-2 py-2 text-left text-sm text-gray-600 hover:text-gray-900"
                  asChild={Boolean(href)}
                  disabled={disabled}
                >
                  {href ? (
                    <a href={href ?? ""} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-gray-400">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </span>
                  )}
                  </Button>
                </Fragment>
              ))}
            </div>
          </div>

          {socialLinks.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Follow</h4>
              <div className="flex justify-center gap-2">
                {socialLinks.map(({ href, Icon, platform }) => (
                  <a
                    key={platform}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Visit ${platform} profile`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:border-gray-900 hover:text-gray-900"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <Button
            className="w-full bg-red-500 text-white hover:bg-red-600"
            asChild={Boolean(email)}
            disabled={!email}
          >
            {email ? <a href={`mailto:${email}`}>Contact</a> : <span>Contact</span>}
          </Button>

          <button
            className="text-sm text-gray-500 underline transition hover:text-gray-700"
            onClick={() => setIsReportModalOpen(true)}
          >
            Report this Professional
          </button>
        </div>
      </Card>

      <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} listingType="professional" />
    </div>
  )
}

const RevealPhoneNumber = ({ phone }: { phone: string }) => {
  const [isVisible, setIsVisible] = useState(false)

  if (isVisible) {
    return (
      <a href={`tel:${phone.replace(/\s+/g, "")}`} className="font-medium text-gray-900">
        {phone}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setIsVisible(true)}
      className="text-sm font-medium text-gray-900 underline hover:no-underline"
    >
      Show phone number
    </button>
  )
}
