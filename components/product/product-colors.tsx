"use client"

import { useState } from "react"

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
  const hasImages = variants.some((v) => v.image_url)
  const [activeIndex, setActiveIndex] = useState(hasImages ? 0 : -1)
  const activeVariant = activeIndex >= 0 ? variants[activeIndex] : null

  return (
    <div>
      {/* Active variant image */}
      {activeVariant?.image_url && (
        <div style={{ marginBottom: 24, borderRadius: 4, overflow: "hidden", maxWidth: 480 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeVariant.image_url}
            alt={`${productName} — ${activeVariant.color}`}
            style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
          />
        </div>
      )}

      {/* Color dots row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {variants.map((v, i) => {
          const colorHex = v.hex ?? v.color_hex ?? null
          const isActive = activeIndex === i
          const hasImage = !!v.image_url

          return (
            <button
              key={i}
              type="button"
              className="product-color-swatch"
              onClick={hasImage ? () => setActiveIndex(i) : undefined}
              style={{ cursor: hasImage ? "pointer" : "default" }}
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
                style={{ color: isActive ? "var(--text-primary)" : undefined }}
              >
                {v.color}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
