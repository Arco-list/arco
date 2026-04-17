"use client"

import { useEffect, useMemo, useState } from "react"
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

// Singular eyebrow labels to match the admin product-edit page.
const AXIS_LABELS: Record<string, string> = {
  color: "Color",
  material: "Material",
  size: "Model",
  model: "Model",
}

function axisLabel(name: AxisName): string {
  return AXIS_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1)
}

// Render order mirrors the admin edit page: model/size first, then color,
// then anything else. Keeps display consistent with how admins edit.
const AXIS_ORDER: Record<string, number> = {
  model: 0,
  size: 0,
  color: 1,
  material: 2,
}

function axisOrder(name: AxisName): number {
  return AXIS_ORDER[name] ?? 10
}

/**
 * Decide how to render an axis's values based on what they carry:
 *   hex  → circular colour swatches
 *   img  → circular image thumbnails (material finishes)
 *   pill → text pills (sizes, models)
 */
function axisStyle(axis: Axis): "hex" | "thumb" | "pill" {
  // Color axes always render as circular swatches (dots), even when
  // some values lack a hex — those get a neutral surface fill.
  if (axis.name === "color") return "hex"
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
        // In combination mode we need both axes picked to resolve a cell's
        // image — auto-select the first value of the other axis when the
        // user first engages, so a combination is always complete.
        if (norm.mode === "combination") {
          for (const axis of norm.axes) {
            if (axis.name === axisName) continue
            if (!next[axis.name]) {
              const first = axis.values[0]?.value
              if (first) next[axis.name] = first
            }
          }
        }
      }
      return next
    })
  }

  // Click anywhere outside the pill/dot region clears both selections and
  // reverts the hero to the cover image. The .product-hero-variants wrapper
  // below marks the "keep selection" zone.
  useEffect(() => {
    const anySelected = Object.values(selection).some((v) => !!v)
    if (!anySelected) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (t?.closest("[data-product-variants]")) return
      setSelection({})
      setLastChanged(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [selection])

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
          <div data-product-variants style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            {[...norm.axes].sort((a, b) => axisOrder(a.name) - axisOrder(b.name)).map((axis) => (
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

  // Selected state mirrors the admin edit page: accent outline sitting a
  // couple pixels outside the dot/pill, rather than a filled-black swap.
  if (style === "hex") {
    return (
      <button
        {...common}
        style={{
          ...common.style,
          width: 40, height: 40, borderRadius: "50%",
          background: value.hex ?? "var(--arco-surface)",
          border: value.hex ? "1px solid rgba(0,0,0,.08)" : "1px solid var(--rule)",
          boxSizing: "border-box", cursor: isAvailable ? "pointer" : "not-allowed", padding: 0,
          outline: isActive ? "2px solid var(--arco-accent)" : "none",
          outlineOffset: 2,
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
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--arco-surface)",
          border: "1px solid var(--rule)",
          boxSizing: "border-box", cursor: isAvailable ? "pointer" : "not-allowed", padding: 0,
          overflow: "hidden",
          outline: isActive ? "2px solid var(--arco-accent)" : "none",
          outlineOffset: 2,
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
      style={{
        ...common.style,
        fontFamily: "var(--font-sans)",
        display: "inline-flex", alignItems: "center",
        padding: "8px 16px",
        fontSize: 14, fontWeight: 400,
        color: "var(--text-primary)",
        background: "transparent",
        border: "1px solid var(--arco-rule)",
        borderRadius: 20,
        cursor: isAvailable ? "pointer" : "not-allowed",
        outline: isActive ? "2px solid var(--arco-accent)" : "none",
        outlineOffset: 2,
        transition: "all .15s",
      }}
    >
      {value.label}
    </button>
  )
}
