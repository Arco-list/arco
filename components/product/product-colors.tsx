"use client"

import { useMemo, useState } from "react"

interface ColorVariant {
  color: string
  hex?: string | null
  color_hex?: string | null
  image_url?: string | null
}

interface ProductColorsProps {
  variants: ColorVariant[]
  productName: string
}

export function ProductColors({ variants, productName }: ProductColorsProps) {
  // Deduplicate by color name, prefer variants with images
  const uniqueVariants = useMemo(() => {
    const seen = new Map<string, ColorVariant>()
    for (const v of variants) {
      const key = v.color.toLowerCase()
      const existing = seen.get(key)
      if (!existing || (!existing.image_url && v.image_url)) {
        seen.set(key, v)
      }
    }
    return [...seen.values()]
  }, [variants])

  // Only show clickable variants (ones with images)
  const clickableVariants = uniqueVariants.filter((v) => v.image_url)
  const hasImages = clickableVariants.length > 0

  const [activeIndex, setActiveIndex] = useState(0)
  const activeVariant = hasImages ? clickableVariants[activeIndex] : null

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      {/* Color dots — left column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
        {clickableVariants.map((v, i) => {
          const colorHex = v.hex ?? v.color_hex ?? null
          const isActive = activeIndex === i

          return (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              <div
                className="product-color-dot"
                style={{
                  background: colorHex ?? "var(--arco-surface)",
                  border: isActive
                    ? "2px solid var(--arco-black)"
                    : colorHex
                      ? "2px solid transparent"
                      : "1px solid var(--rule)",
                  boxSizing: "border-box",
                }}
              />
              <span
                className="product-color-label"
                style={{
                  color: isActive ? "var(--text-primary)" : undefined,
                  whiteSpace: "nowrap",
                }}
              >
                {v.color}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active variant image — right */}
      {activeVariant?.image_url && (
        <div style={{ flex: 1, borderRadius: 4, overflow: "hidden", minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeVariant.image_url}
            alt={`${productName} — ${activeVariant.color}`}
            style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
          />
        </div>
      )}
    </div>
  )
}
