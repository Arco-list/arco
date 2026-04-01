"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

const MAX_VISIBLE = 3

interface ProfessionalHeaderProps {
  name: string
  services: string
  allServices?: string[]
  description: string | null
  companyIcon: string | null
  companyInitials: string
}

export function ProfessionalHeader({
  name,
  services,
  allServices,
  description,
  companyIcon,
  companyInitials,
}: ProfessionalHeaderProps) {
  const cleanDescription = description
    ? description.replace(/<[^>]*>/g, '').trim()
    : null

  const [showAll, setShowAll] = useState(false)
  const dropdownRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!showAll) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowAll(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showAll])

  const list = allServices && allServices.length > 0 ? allServices : null
  const visible = list ? list.slice(0, MAX_VISIBLE) : null
  const extraCount = list ? list.length - MAX_VISIBLE : 0

  return (
    <section className="professional-header">
      <div className="company-icon">
        {companyIcon ? (
          <Image
            src={companyIcon}
            alt={name}
            width={100}
            height={100}
            className="company-icon-image"
          />
        ) : (
          <div className="company-icon-initials">
            {companyInitials}
          </div>
        )}
      </div>

      <div id="details-anchor" />
      <h1 className="arco-page-title">{name}</h1>

      <p className="professional-badge">
        {visible ? (
          <>
            {visible.join(" · ")}
            {extraCount > 0 && (
              <span ref={dropdownRef} style={{ position: "relative", display: "inline" }}>
                {" · "}
                <button
                  type="button"
                  onClick={() => setShowAll(!showAll)}
                  style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}
                >
                  +{extraCount} more
                </button>
                {showAll && (
                  <span style={{
                    position: "absolute", left: "50%", transform: "translateX(-50%)", top: "calc(100% + 6px)",
                    background: "#fff", border: "1px solid #e5e5e4", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.08)",
                    padding: "6px 0", minWidth: 180, zIndex: 50, display: "flex", flexDirection: "column",
                  }}>
                    {list.map((s, i) => (
                      <span key={i} style={{ padding: "5px 16px", fontSize: 14, color: "#1c1c1a", whiteSpace: "nowrap" }}>{s}</span>
                    ))}
                  </span>
                )}
              </span>
            )}
          </>
        ) : services}
      </p>

      {cleanDescription && (
        <div className="professional-description">
          {cleanDescription.split('\n\n').map((paragraph, index) => (
            <p key={index} className="arco-body-text">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
