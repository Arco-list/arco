"use client"

import { useState } from "react"

import { ProfessionalCard } from "@/components/professional-card"
import type { ProfessionalCard as ProfessionalCardData } from "@/lib/professionals/types"

/**
 * The professional card, rendered by the real component.
 *
 * Deliberately not a hand-drawn copy. The claim funnel keeps one of
 * those and it drifted — its service mark sat at 18px while the real
 * card used 24 — which is exactly the failure a design page exists to
 * catch. Here the fixtures are fake and the component is not, so what
 * this section shows is what ships.
 *
 * Three states, because they are the ones that differ: a company with
 * a cover photo and a logo, one with neither (service mark in the disc,
 * wash behind the photo), and a verified one with extra services, which
 * is where the "+N" dropdown and the check live.
 */

// A flat grey stands in for the cover photo, so the card can be judged
// without shipping an image into the repo.
const GREY = (tone: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${tone}"/></svg>`,
  )}`

const base: ProfessionalCardData = {
  id: "preview-1",
  slug: "preview",
  companyId: "preview",
  professionalId: "preview",
  name: "Studio Vermeer",
  profession: "Interieurontwerper",
  primaryServiceSlug: "interior-designer",
  location: "Amsterdam",
  image: GREY("#a1a1a0"),
  logoUrl: null,
  specialties: [],
  isVerified: false,
}

const CARDS: { label: string; note: string; data: ProfessionalCardData }[] = [
  {
    label: "With cover photo",
    note: "The common case: photo, logo, one service.",
    data: { ...base, logoUrl: GREY("#7a7a78") },
  },
  {
    label: "No photo, no logo",
    note: "Falls back to /placeholder.svg above, and the service mark in the disc below — never a bare initial.",
    data: { ...base, id: "preview-2", name: "Kap Architecten", profession: "Architect", primaryServiceSlug: "architect", image: "", location: "Nijmegen" },
  },
  {
    label: "Verified, extra services",
    note: "The check sits after the name; services past the first collapse into +N.",
    data: {
      ...base,
      id: "preview-3",
      name: "Buitenhuis Villabouw",
      profession: "Aannemer",
      primaryServiceSlug: "contractor",
      location: "Laren",
      isVerified: true,
      specialties: ["Aannemer", "Keukens", "Badkamers", "Zwembaden"],
    },
  },
]

export function ProfessionalCardPreview() {
  // Saving is local to the preview: the heart has to be clickable for
  // its filled state to be judged, but nothing is written.
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  return (
    <div className="discover-grid">
      {CARDS.map(({ label, note, data }) => (
        <div key={data.id}>
          <ProfessionalCard
            professional={data}
            isSaved={saved[data.id] ?? false}
            isMutating={false}
            onToggleSave={() => setSaved((prev) => ({ ...prev, [data.id]: !prev[data.id] }))}
          />
          <p className="arco-small-text" style={{ marginTop: 10 }}>
            <strong style={{ color: "var(--arco-black)", fontWeight: 500 }}>{label}</strong>
            {" — "}
            {note}
          </p>
        </div>
      ))}
    </div>
  )
}
