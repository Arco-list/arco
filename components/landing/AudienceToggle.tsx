"use client"

import Link from "next/link"

interface AudienceToggleProps {
  active: "architects" | "professionals"
}

export function AudienceToggle({ active }: AudienceToggleProps) {
  return (
    <div className="audience-toggle">
      <Link
        href="/businesses/architects"
        className={`toggle-seg${active === "architects" ? " active" : ""}`}
      >
        For Architects
      </Link>
      <Link
        href="/businesses/professionals"
        className={`toggle-seg${active === "professionals" ? " active" : ""}`}
      >
        For Professionals
      </Link>
    </div>
  )
}
