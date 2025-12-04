'use client'

import { useState } from "react"
import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Phone,
  type LucideIcon,
} from "lucide-react"
import { IconBrandPinterest } from "@tabler/icons-react"

import type { ProfessionalDetail } from "@/lib/professionals/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=120&width=120"

// Create a wrapper for Tabler icon to match LucideIcon interface
const PinterestIcon: LucideIcon = (props: any) => <IconBrandPinterest {...props} />

const SOCIAL_ICON_MAP: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  pinterest: PinterestIcon,
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
  const company = professional.company
  const phone = company.phone ?? null
  const email = company.email ?? null
  const website = normalizeUrl(company.website ?? company.domain ?? null)
  const location = professional.location ?? null
  const displayName = company.name || professional.name || "Professional"
  const imageSrc = company.logoUrl ?? professional.profile.avatarUrl ?? PLACEHOLDER_IMAGE

  const primaryActions = [
    {
      icon: Globe,
      label: website ? "Visit website" : "Website unavailable",
      href: website,
      disabled: !website,
      external: true,
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
    <div className="lg:sticky lg:top-24 lg:z-20">
      <Card className="space-y-6 p-6">
        <div className="space-y-4">
          <h2 className="heading-4 font-bold text-black">Contact {displayName}</h2>

          <div className="space-y-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2 body-small text-text-secondary">
                <Phone className="h-4 w-4 flex-shrink-0" />
                {phone ? (
                  <RevealPhoneNumber phone={phone} />
                ) : (
                  <span className="text-muted-foreground">Phone unavailable</span>
                )}
              </div>

              {primaryActions.map(({ icon: Icon, label, href, disabled, external }, index) => (
                <div key={index} className="flex items-center gap-2 body-small">
                  {href ? (
                    <a
                      href={href ?? ""}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noreferrer" : undefined}
                      className="flex items-center gap-2 text-text-secondary hover:text-foreground"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{label}</span>
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{label}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {socialLinks.length > 0 ? (
            <div className="space-y-2">
              <h4 className="body-small font-medium text-foreground">Follow</h4>
              <div className="flex justify-start gap-2">
                {socialLinks.map(({ href, Icon, platform }) => (
                  <a
                    key={platform}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Visit ${platform} profile`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-secondary transition hover:border-foreground hover:text-foreground"
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
        </div>
      </Card>
    </div>
  )
}

const RevealPhoneNumber = ({ phone }: { phone: string }) => {
  const [isVisible, setIsVisible] = useState(false)

  if (isVisible) {
    return (
      <a href={`tel:${phone.replace(/\s+/g, "")}`} className="font-medium text-foreground">
        {phone}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setIsVisible(true)}
      className="body-small font-medium text-foreground underline hover:no-underline"
    >
      Show phone number
    </button>
  )
}
