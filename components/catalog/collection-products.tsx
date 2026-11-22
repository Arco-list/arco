"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"

import { ProductImage } from "@/components/catalog/product-image"

/**
 * De producten op de collectiepagina: hetzelfde raster als de foto's op
 * collection edit (.collection-product-grid), één rij en daarna "Meer
 * producten" in de stijl van "Meer merken". Hoeveel er op een rij passen
 * hangt van de breedte af; dat lezen we uit het raster zelf. Tot die
 * meting tonen we er 4, een rij op een desktop.
 *
 * De hele tegel linkt naar het product bij het merk; geen apart icoon.
 */

export type CollectionProductTile = { id: string; name: string; url: string | null; imageUrl: string | null; category: string | null }

export function CollectionProducts({ products, brandName, locale }: { products: CollectionProductTile[]; brandName: string; locale: string }) {
  const grid = useRef<HTMLDivElement | null>(null)
  const [perRow, setPerRow] = useState(4)
  const [expanded, setExpanded] = useState(false)
  const nl = locale === "nl"

  useLayoutEffect(() => {
    const el = grid.current
    if (!el) return
    const measure = () => {
      const cols = getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length
      if (cols > 0) setPerRow(cols)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const clamped = !expanded && products.length > perRow
  const visible = clamped ? products.slice(0, perRow) : products

  return (
    <>
      <div ref={grid} className="collection-product-grid">
        {visible.map((p) => {
          const inner = (
            <>
              <div style={{ aspectRatio: "4 / 3", background: "var(--arco-surface)", borderRadius: 4, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {p.imageUrl && <ProductImage url={p.imageUrl} alt={p.name} />}
              </div>
              <h3 className="discover-card-title" style={{ marginTop: 12 }}>{p.name}</h3>
              {p.category && <p className="discover-card-sub">{p.category}</p>}
            </>
          )
          return p.url
            ? <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="discover-card" style={{ display: "block", textDecoration: "none", color: "inherit" }} aria-label={`${p.name} — ${brandName}`}>{inner}</a>
            : <div key={p.id}>{inner}</div>
        })}
      </div>
      {products.length > perRow && (
        <div className="show-more-container">
          <button type="button" className="btn-tertiary" onClick={() => setExpanded((v) => !v)}>
            {expanded ? (nl ? "Minder producten" : "Fewer products") : (nl ? "Meer producten" : "More products")}
            <ChevronRight size={16} style={expanded ? { transform: "rotate(180deg)" } : undefined} />
          </button>
        </div>
      )}
    </>
  )
}
