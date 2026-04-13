"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"

interface Variant {
  color?: string
  hex?: string | null
  color_hex?: string | null
  material?: string
  size?: string
  image_url?: string | null
}

interface Brand {
  name: string
  slug: string
  logo_url: string | null
}

interface ProductHeroProps {
  name: string
  description: string | null
  brand: Brand | null
  heroImageUrl: string | null
  variants: Variant[]
}

/** Strip product name words from variant label (order-independent) */
function cleanLabel(label: string, productName: string): string {
  const productWords = new Set(productName.toLowerCase().split(/\s+/))
  // Remove any leading words that appear in the product name
  const labelWords = label.split(/[\s\-–—]+/)
  let startIdx = 0
  while (startIdx < labelWords.length && productWords.has(labelWords[startIdx].toLowerCase())) {
    startIdx++
  }
  const cleaned = labelWords.slice(startIdx).join(" ").trim()
  return cleaned.length > 0 ? cleaned : label
}

export function ProductHero({ name, description, brand, heroImageUrl, variants }: ProductHeroProps) {
  // Extract and deduplicate variant types
  const colors = useMemo(() => {
    const seen = new Map<string, Variant>()
    for (const v of variants.filter((v) => v.color)) {
      const key = cleanLabel(v.color!, name).toLowerCase()
      const existing = seen.get(key)
      if (!existing) {
        seen.set(key, v)
      } else {
        // Merge: keep image_url and hex from whichever has them
        seen.set(key, {
          ...existing,
          image_url: existing.image_url || v.image_url,
          hex: existing.hex || v.hex,
          color_hex: existing.color_hex || v.color_hex,
        })
      }
    }
    return [...seen.entries()].map(([, v]) => ({ ...v, label: cleanLabel(v.color!, name) }))
  }, [variants, name])

  const materials = useMemo(() => {
    const seen = new Map<string, Variant>()
    for (const v of variants.filter((v) => v.material)) {
      const key = v.material!.toLowerCase()
      if (!seen.has(key) || (!seen.get(key)!.image_url && v.image_url)) seen.set(key, v)
    }
    return [...seen.entries()].map(([, v]) => ({ ...v, label: v.material! }))
  }, [variants])

  const models = useMemo(() => {
    const seen = new Map<string, Variant>()
    for (const v of variants.filter((v) => v.size)) {
      const key = v.size!.toLowerCase()
      if (!seen.has(key)) seen.set(key, v)
    }
    return [...seen.entries()].map(([, v]) => ({ ...v, label: v.size! }))
  }, [variants])

  const [activeColor, setActiveColor] = useState(0)
  const [activeMaterial, setActiveMaterial] = useState(0)
  const [activeModel, setActiveModel] = useState(0)

  // Determine which image to show: last-selected variant with an image, or hero
  const activeColorImg = colors[activeColor]?.image_url
  const activeMaterialImg = materials[activeMaterial]?.image_url
  const activeModelImg = models[activeModel]?.image_url

  // Priority: most recently interacted wins. Track which was last changed.
  const [lastChanged, setLastChanged] = useState<"color" | "material" | "model" | null>(
    colors.some((c) => c.image_url) ? "color" : materials.some((m) => m.image_url) ? "material" : null
  )

  const displayImage = (() => {
    if (lastChanged === "color" && activeColorImg) return activeColorImg
    if (lastChanged === "material" && activeMaterialImg) return activeMaterialImg
    if (lastChanged === "model" && activeModelImg) return activeModelImg
    // Fallback chain
    if (activeColorImg) return activeColorImg
    if (activeMaterialImg) return activeMaterialImg
    if (activeModelImg) return activeModelImg
    return heroImageUrl
  })()

  const hasVariants = colors.length > 0 || materials.length > 0 || models.length > 0

  return (
    <div className="product-hero">
      {/* Primary image — swaps based on variant selection */}
      <div className="product-hero-image">
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayImage} alt={name} key={displayImage} />
        ) : (
          <div style={{ width: "100%", aspectRatio: "4/3", background: "var(--arco-surface)", borderRadius: 4 }} />
        )}
      </div>

      {/* Product info + variant selectors */}
      <div className="product-hero-info">
        {/* Brand */}
        {brand && (
          <Link href={`/brands/${brand.slug}`} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, textDecoration: "none", color: "inherit" }}>
            {brand.logo_url ? (
              <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                <Image src={brand.logo_url} alt={brand.name} width={40} height={40} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--arco-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "var(--text-secondary)", flexShrink: 0 }}>
                {brand.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="arco-small-text" style={{ color: "var(--text-secondary)" }}>{brand.name}</span>
          </Link>
        )}

        {/* Product name */}
        <h1 className="arco-page-title" style={{ marginBottom: 0 }}>{name}</h1>

        {/* Description */}
        {description && (
          <div style={{ marginTop: 20 }}>
            {description.split("\n\n").map((para, i) => (
              <p key={i} className="arco-body-text">{para}</p>
            ))}
          </div>
        )}

        {/* Variant selectors */}
        {hasVariants && (
          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Colors */}
            {colors.length > 0 && (
              <div>
                <span className="arco-eyebrow" style={{ display: "block", marginBottom: 10 }}>Colors</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {colors.map((c, i) => {
                    const hex = c.hex ?? c.color_hex ?? null
                    const isActive = activeColor === i
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setActiveColor(i); setLastChanged("color") }}
                        title={c.label}
                        style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: hex ?? "var(--arco-surface)",
                          border: isActive ? "2px solid var(--arco-black)" : hex ? "2px solid transparent" : "1px solid var(--rule)",
                          boxSizing: "border-box", cursor: "pointer", padding: 0,
                          outline: isActive ? "2px solid var(--arco-white)" : "none",
                          outlineOffset: -4,
                        }}
                      />
                    )
                  })}
                </div>
                <span className="arco-xs-text" style={{ display: "block", marginTop: 6, color: "var(--text-secondary)" }}>
                  {colors[activeColor]?.label}
                </span>
              </div>
            )}

            {/* Materials */}
            {materials.length > 0 && (
              <div>
                <span className="arco-eyebrow" style={{ display: "block", marginBottom: 10 }}>Materials</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {materials.map((m, i) => {
                    const isActive = activeMaterial === i
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setActiveMaterial(i); setLastChanged("material") }}
                        title={m.label}
                        style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "var(--arco-surface)",
                          border: isActive ? "2px solid var(--arco-black)" : "1px solid var(--rule)",
                          boxSizing: "border-box", cursor: "pointer", padding: 0,
                          overflow: "hidden",
                        }}
                      >
                        {m.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.image_url} alt={m.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                      </button>
                    )
                  })}
                </div>
                <span className="arco-xs-text" style={{ display: "block", marginTop: 6, color: "var(--text-secondary)" }}>
                  {materials[activeMaterial]?.label}
                </span>
              </div>
            )}

            {/* Models */}
            {models.length > 0 && (
              <div>
                <span className="arco-eyebrow" style={{ display: "block", marginBottom: 10 }}>Models</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {models.map((m, i) => {
                    const isActive = activeModel === i
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setActiveModel(i); setLastChanged("model") }}
                        className="status-pill"
                        style={{
                          cursor: "pointer",
                          background: isActive ? "var(--arco-black)" : "transparent",
                          color: isActive ? "var(--arco-white)" : "var(--arco-black)",
                          borderColor: isActive ? "var(--arco-black)" : undefined,
                        }}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
