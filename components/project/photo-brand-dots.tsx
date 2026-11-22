"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link } from "@/i18n/navigation"

import type { PhotoBrandTag } from "@/lib/projects/photo-brand-tags"

/**
 * Merk-stippen op een projectfoto (migratie 317), voor elke plek waar de
 * foto staat: de hero, de fototour en de lightbox.
 *
 * De laag ligt over het vak van de foto. We rekenen uit waar de foto in
 * dat vak werkelijk staat: in de lightbox past hij erin (contain, met
 * randen), in de hero en de fototour vult hij het vak (cover, gecentreerd
 * uitgesneden). Een stip die buiten het zichtbare deel valt, verdwijnt.
 *
 * De kaart opent als zwevende laag op de plek van de stip (portal naar
 * body), zodat een tegel met overflow: hidden hem niet afknipt. Dezelfde
 * kaart als op de professionalskaart: beeld 140px, logo 28px, naam en
 * eronder het merk.
 */
type Fit = "contain" | "cover"

export function PhotoBrandDots({ tags, src, width, height, fit = "contain", focus }: {
  tags: PhotoBrandTag[]
  src: string
  width?: number | null
  height?: number | null
  fit?: Fit
  /** Focuspunt bij cover (object-position); zonder punt het midden. */
  focus?: { x: number; y: number } | null
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState<number | null>(width && height ? width / height : null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [open, setOpen] = useState<{ id: string; anchor: DOMRect } | null>(null)

  useEffect(() => {
    if (width && height) { setRatio(width / height); return }
    const img = new window.Image()
    img.onload = () => { if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight) }
    img.src = src
  }, [src, width, height])

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const close = useCallback(() => setOpen(null), [])
  // Andere foto, scrollen, schermmaat of Escape: kaart dicht.
  useEffect(() => { setOpen(null) }, [src])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close() } }
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest(".photo-dot-card") || t.closest(".photo-dot")) return
      close()
    }
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    window.addEventListener("keydown", onKey, true)
    document.addEventListener("mousedown", onDown)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
      window.removeEventListener("keydown", onKey, true)
      document.removeEventListener("mousedown", onDown)
    }
  }, [open, close])

  if (tags.length === 0) return null

  let rect: { left: number; top: number; w: number; h: number } | null = null
  if (size && ratio && size.w > 0 && size.h > 0) {
    const boxRatio = size.w / size.h
    const fillsWidth = fit === "contain" ? boxRatio <= ratio : boxRatio > ratio
    if (fillsWidth) {
      const h = size.w / ratio
      rect = { left: 0, top: (size.h - h) * (fit === "cover" ? focus?.y ?? 0.5 : 0.5), w: size.w, h }
    } else {
      const w = size.h * ratio
      rect = { left: (size.w - w) * (fit === "cover" ? focus?.x ?? 0.5 : 0.5), top: 0, w, h: size.h }
    }
  }

  const openTag = open ? tags.find((t) => t.id === open.id) ?? null : null

  return (
    <div ref={boxRef} className="photo-dots">
      {rect && tags.map((t) => {
        const left = rect!.left + t.x * rect!.w
        const top = rect!.top + t.y * rect!.h
        // Uitgesneden weg (cover): niet tonen.
        if (size && (left < 6 || top < 6 || left > size.w - 6 || top > size.h - 6)) return null
        const isOpen = open?.id === t.id
        return (
          <button
            key={t.id}
            type="button"
            className="photo-dot"
            style={{ left, top }}
            aria-label={t.subtitle ? `${t.title}, ${t.subtitle}` : t.title}
            aria-expanded={isOpen}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setOpen(isOpen ? null : { id: t.id, anchor: e.currentTarget.getBoundingClientRect() })
            }}
          />
        )
      })}
      {openTag && open && typeof document !== "undefined" && createPortal(
        <DotCard tag={openTag} anchor={open.anchor} />,
        document.body,
      )}
    </div>
  )
}

function DotCard({ tag, anchor }: { tag: PhotoBrandTag; anchor: DOMRect }) {
  const cardW = 240
  const cardH = 196
  const cx = anchor.left + anchor.width / 2
  const above = anchor.top > cardH + 24
  const left = Math.min(Math.max(cx - cardW / 2, 8), window.innerWidth - cardW - 8)
  const style: React.CSSProperties = above
    ? { left, top: anchor.top - cardH - 12 }
    : { left, top: anchor.bottom + 12 }
  return (
    <div className="photo-dot-card map-card-wrapper" style={style} onClick={(e) => e.stopPropagation()}>
      <CardLink tag={tag}>
        <div style={{ position: "relative", width: "100%", height: 140, overflow: "hidden", background: "#f5f5f4", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {tag.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tag.imageUrl} alt={tag.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : tag.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tag.logoUrl} alt={tag.title} style={{ maxWidth: "50%", maxHeight: "50%", objectFit: "contain", mixBlendMode: "multiply" }} />
          ) : null}
        </div>
        <div style={{ padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {tag.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tag.logoUrl} alt="" style={{ width: 28, height: 28, minWidth: 28, borderRadius: "50%", objectFit: "contain", background: "#f5f5f4", mixBlendMode: "multiply" }} />
            ) : (
              <div style={{ width: 28, height: 28, minWidth: 28, borderRadius: "50%", background: "#f5f5f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#1a1a19" }}>
                {tag.title.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a19", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tag.title}</div>
              {tag.subtitle && (
                <div style={{ fontSize: 12, fontWeight: 300, color: "#6b6b68", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tag.subtitle}</div>
              )}
            </div>
          </div>
        </div>
      </CardLink>
    </div>
  )
}

function CardLink({ tag, children }: { tag: PhotoBrandTag; children: React.ReactNode }) {
  const style: React.CSSProperties = { display: "block", textDecoration: "none", color: "inherit", width: 240 }
  if (!tag.href) return <div style={style}>{children}</div>
  if (tag.external) {
    return <a href={tag.href} target="_blank" rel="noopener noreferrer" style={style}>{children}</a>
  }
  return <Link href={tag.href} style={style}>{children}</Link>
}
