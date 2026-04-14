"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import type { RawVariant } from "@/lib/scraper/types"
import type { Axis, AxisName, AxisValue, NormalizedVariants } from "@/lib/products/variants"
import { availableValues, findCombination, normalizeVariants } from "@/lib/products/variants"

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
  variants: RawVariant[]
}

const AXIS_LABELS: Record<string, string> = {
  color: "Colors",
  material: "Materials",
  size: "Sizes",
  model: "Models",
}

function axisLabel(name: AxisName): string {
  return AXIS_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1) + "s"
}

/**
 * Decide how to render an axis's values based on what they carry:
 *   hex  → circular colour swatches
 *   img  → circular image thumbnails (material finishes)
 *   pill → text pills (sizes, models)
 */
function axisStyle(axis: Axis): "hex" | "thumb" | "pill" {
  if (axis.values.some((v) => v.hex)) return "hex"
  if (axis.values.some((v) => v.image_url)) return "thumb"
  return "pill"
}

export function ProductHero({ name, description, brand, heroImageUrl, variants }: ProductHeroProps) {
  const norm = useMemo(() => normalizeVariants(variants, name), [variants, name])

  const [selection, setSelection] = useState<Record<AxisName, string | null>>({})
  const [lastChanged, setLastChanged] = useState<AxisName | null>(null)

  // In combination mode, find the matching row once all axes are picked
  const combo = useMemo(() => findCombination(norm, selection), [norm, selection])

  const displayImage = (() => {
    if (norm.mode === "combination") {
      return combo?.image_url ?? heroImageUrl
    }
    // Independent: the most recently clicked axis wins the image swap
    if (lastChanged) {
      const axis = norm.axes.find((a) => a.name === lastChanged)
      const picked = axis?.values.find((v) => v.value === selection[lastChanged])
      if (picked?.image_url) return picked.image_url
    }
    return heroImageUrl
  })()

  const hasVariants = norm.axes.length > 0

  const toggleValue = (axisName: AxisName, value: string) => {
    setSelection((prev) => {
      const next = { ...prev }
      if (prev[axisName] === value) {
        next[axisName] = null
        setLastChanged(null)
      } else {
        next[axisName] = value
        setLastChanged(axisName)
      }
      return next
    })
  }

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
        {brand && (
          <Link href={`/products/${brand.slug}`} style={{ display: "block", marginBottom: 24, textDecoration: "none", color: "inherit" }}>
            <div className="company-icon" style={{ justifyContent: "flex-start" }}>
              {brand.logo_url ? (
                <Image src={brand.logo_url} alt={brand.name} width={100} height={100} className="company-icon-image" />
              ) : (
                <div className="company-icon-initials">{brand.name.charAt(0).toUpperCase()}</div>
              )}
            </div>
          </Link>
        )}

        <h1 className="arco-page-title" style={{ marginBottom: 0 }}>{name}</h1>

        {description && (
          <div style={{ marginTop: 20 }}>
            {description.split("\n\n").map((para, i) => (
              <p key={i} className="arco-body-text">{para}</p>
            ))}
          </div>
        )}

        {hasVariants && (
          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            {norm.axes.map((axis) => (
              <AxisBlock
                key={axis.name}
                axis={axis}
                selected={selection[axis.name] ?? null}
                available={availableValues(norm, axis.name, selection)}
                onToggle={(value) => toggleValue(axis.name, value)}
                mode={norm.mode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface AxisBlockProps {
  axis: Axis
  selected: string | null
  available: Set<string>
  onToggle: (value: string) => void
  mode: NormalizedVariants["mode"]
}

function AxisBlock({ axis, selected, available, onToggle, mode }: AxisBlockProps) {
  const style = axisStyle(axis)
  const activeValue = axis.values.find((v) => v.value === selected) ?? null

  return (
    <div>
      <span className="arco-eyebrow" style={{ display: "block", marginBottom: 10 }}>{axisLabel(axis.name)}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: style === "pill" ? 6 : 8 }}>
        {axis.values.map((v) => {
          const isActive = selected === v.value
          // In combination mode, fade values with no matching combination
          // given the current selection of the *other* axes.
          const isAvailable = mode !== "combination" || available.has(v.value)
          return (
            <AxisButton
              key={v.value}
              value={v}
              style={style}
              isActive={isActive}
              isAvailable={isAvailable}
              onClick={() => isAvailable && onToggle(v.value)}
            />
          )
        })}
      </div>
      {activeValue && style !== "pill" && (
        <span className="arco-xs-text" style={{ display: "block", marginTop: 6, color: "var(--text-secondary)" }}>
          {activeValue.label}
        </span>
      )}
    </div>
  )
}

interface AxisButtonProps {
  value: AxisValue
  style: "hex" | "thumb" | "pill"
  isActive: boolean
  isAvailable: boolean
  onClick: () => void
}

function AxisButton({ value, style, isActive, isAvailable, onClick }: AxisButtonProps) {
  const common = {
    onClick,
    title: value.label,
    type: "button" as const,
    disabled: !isAvailable,
    style: { opacity: isAvailable ? 1 : 0.35 },
  }

  if (style === "hex") {
    return (
      <button
        {...common}
        style={{
          ...common.style,
          width: 28, height: 28, borderRadius: "50%",
          background: value.hex ?? "var(--arco-surface)",
          border: isActive ? "2px solid var(--arco-black)" : value.hex ? "2px solid transparent" : "1px solid var(--rule)",
          boxSizing: "border-box", cursor: isAvailable ? "pointer" : "not-allowed", padding: 0,
          outline: isActive ? "2px solid var(--arco-white)" : "none",
          outlineOffset: -4,
        }}
      />
    )
  }

  if (style === "thumb") {
    return (
      <button
        {...common}
        style={{
          ...common.style,
          width: 28, height: 28, borderRadius: "50%",
          background: "var(--arco-surface)",
          border: isActive ? "2px solid var(--arco-black)" : "1px solid var(--rule)",
          boxSizing: "border-box", cursor: isAvailable ? "pointer" : "not-allowed", padding: 0,
          overflow: "hidden",
        }}
      >
        {value.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.image_url} alt={value.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </button>
    )
  }

  return (
    <button
      {...common}
      className="status-pill"
      style={{
        ...common.style,
        cursor: isAvailable ? "pointer" : "not-allowed",
        background: isActive ? "var(--arco-black)" : "transparent",
        color: isActive ? "var(--arco-white)" : "var(--arco-black)",
        borderColor: isActive ? "var(--arco-black)" : undefined,
      }}
    >
      {value.label}
    </button>
  )
}
