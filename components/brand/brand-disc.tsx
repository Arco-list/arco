"use client"

import { useBrandLogoFit } from "@/components/brand/brand-logo"

/**
 * Een merklogo in de schijf van een disc tile (/admin/design → Disc
 * tiles): een logo met eigen achtergrond vult de schijf, een wit of
 * doorzichtig logo staat met 7% marge op het grijs van .credit-icon.
 * Hoort binnen een .credit-icon.
 */
export function BrandDisc({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const { full, imgProps } = useBrandLogoFit(logoUrl)
  if (!logoUrl) return <span className="credit-icon-initials">{name.charAt(0).toUpperCase()}</span>
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...imgProps}
      src={logoUrl}
      alt={name}
      className={full ? "credit-cutout" : undefined}
      style={full ? undefined : { width: "100%", height: "100%", objectFit: "contain", padding: "7%", boxSizing: "border-box", mixBlendMode: "multiply" }}
    />
  )
}
