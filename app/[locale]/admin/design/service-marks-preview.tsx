"use client"

import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"

/**
 * The hand-drawn service marks, one per service on the platform.
 *
 * Every mark is resolved through resolveProfessionalServiceIcon from the
 * service's real `categories.slug`, and rendered in the same
 * .credit-icon / .credit-icon-service lockup the project page uses — so
 * this section shows exactly what ships, and a broken mapping shows up
 * here as a briefcase rather than hiding until someone opens a project.
 */

type Mark = { slug: string; name: string }

const GROUPS: Array<{ name: string; services: Mark[] }> = [
  {
    name: "Design & Planning",
    services: [
      { slug: "architect", name: "Architect" },
      { slug: "garden-designer", name: "Garden designer" },
      { slug: "interior-designer", name: "Interior Designer" },
      { slug: "lighting-designer", name: "Lighting Designer" },
      { slug: "photographer", name: "Photographer" },
    ],
  },
  {
    name: "Construction",
    services: [
      { slug: "bathrooms", name: "Bathrooms" },
      { slug: "builder", name: "Builder" },
      { slug: "kitchens", name: "Kitchens" },
      { slug: "stairs-elevator", name: "Stairs & Elevators" },
      { slug: "swimming-pools", name: "Swimming pools" },
      { slug: "tiles-stones", name: "Tiles & Stones" },
      { slug: "windows-doors", name: "Windows & doors" },
    ],
  },
  {
    name: "Finishing",
    services: [
      { slug: "art", name: "Art" },
      { slug: "cabinet-maker", name: "Cabinet maker" },
      { slug: "fireplace", name: "Fireplaces" },
      { slug: "flooring", name: "Flooring" },
      { slug: "furniture", name: "Furniture" },
      { slug: "interior-stylist", name: "Interior stylist" },
      { slug: "lighting", name: "Lighting" },
    ],
  },
  {
    name: "Outdoor & Garden",
    services: [
      { slug: "gardener", name: "Gardener" },
      { slug: "outdoor-furniture", name: "Outdoor furniture" },
      { slug: "outdoor-lighting", name: "Outdoor lighting" },
    ],
  },
]

export function ServiceMarksPreview() {
  return (
    <>
      {GROUPS.map((group) => (
        <div key={group.name} style={{ marginBottom: 40 }}>
          <h4 className="arco-label" style={{ marginBottom: 20 }}>
            {group.name}
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 32,
            }}
          >
            {group.services.map((service) => {
              const Icon = resolveProfessionalServiceIcon(service.slug)
              return (
                <div key={service.slug} style={{ textAlign: "center" }}>
                  <div className="credit-icon">
                    <Icon className="credit-icon-service" strokeWidth={1} aria-hidden />
                  </div>
                  <div className="arco-card-title" style={{ marginBottom: 2 }}>
                    {service.name}
                  </div>
                  {/* The eyebrow uppercases; a slug is a literal value, so
                      it keeps the eyebrow's size and colour but its own case. */}
                  <div className="arco-eyebrow" style={{ textTransform: "none" }}>
                    {service.slug}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
