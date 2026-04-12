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

/** Strip product name prefix from color label: "Taglio tavolo dark chrome" → "dark chrome" */
function cleanColorName(color: string, productName: string): string {
  const lower = color.toLowerCase()
  const productLower = productName.toLowerCase()
  // Try removing full product name prefix
  if (lower.startsWith(productLower)) {
    const cleaned = color.slice(productName.length).replace(/^[\s\-–—·]+/, "").trim()
    if (cleaned.length > 0) return cleaned
  }
  // Try removing each word of the product name from the start
  const productWords = productLower.split(/\s+/)
  let result = lower
  for (const word of productWords) {
    if (result.startsWith(word)) {
      result = result.slice(word.length).replace(/^[\s\-–—·]+/, "")
    } else {
      break
    }
  }
  return result.trim() || color
}

export function ProductColors({ variants, productName }: ProductColorsProps) {
  // Deduplicate by color name, prefer variants with images
  const uniqueVariants = useMemo(() => {
    const seen = new Map<string, ColorVariant & { cleanName: string }>()
    for (const v of variants) {
      const cleanName = cleanColorName(v.color, productName)
      const key = cleanName.toLowerCase()
      const existing = seen.get(key)
      if (!existing || (!existing.image_url && v.image_url)) {
        seen.set(key, { ...v, cleanName })
      }
    }
    return [...seen.values()]
  }, [variants, productName])

  const clickableVariants = uniqueVariants.filter((v) => v.image_url)
  const hasImages = clickableVariants.length > 0

  const [activeIndex, setActiveIndex] = useState(0)
  const activeVariant = hasImages ? clickableVariants[activeIndex] : null

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      {/* Color dots — left, horizontal with wrapping */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, maxWidth: hasImages ? 200 : undefined, flexShrink: 0 }}>
        {clickableVariants.map((v, i) => {
          const colorHex = v.hex ?? v.color_hex ?? null
          const isActive = activeIndex === i

          return (
            <button
              key={i}
              type="button"
              className="product-color-swatch"
              onClick={() => setActiveIndex(i)}
              style={{ cursor: "pointer" }}
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
                {v.cleanName}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active variant image — right */}
      {activeVariant?.image_url && (
        <div style={{ flex: 1, borderRadius: 4, overflow: "hidden", minWidth: 0, maxWidth: 400 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeVariant.image_url}
            alt={`${productName} — ${activeVariant.cleanName}`}
            style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
          />
        </div>
      )}
    </div>
  )
}
