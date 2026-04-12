"use client"

import { useCallback, useState } from "react"

interface Photo {
  id: string
  url: string
  alt_text: string | null
}

interface ProductGalleryProps {
  photos: Photo[]
  productName: string
}

type Orientation = "landscape" | "portrait" | "square"

function detectOrientation(w: number, h: number): Orientation {
  const ratio = w / h
  if (ratio > 1.15) return "landscape"
  if (ratio < 0.85) return "portrait"
  return "square"
}

export function ProductGallery({ photos, productName }: ProductGalleryProps) {
  const [orientations, setOrientations] = useState<Record<string, Orientation>>({})

  const handleLoad = useCallback((id: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setOrientations((prev) => ({
      ...prev,
      [id]: detectOrientation(img.naturalWidth, img.naturalHeight),
    }))
  }, [])

  return (
    <div className="product-gallery">
      {photos.map((photo, i) => (
        <div
          key={photo.id}
          className="product-gallery-item"
          data-orientation={orientations[photo.id] ?? "landscape"}
          data-featured={i === 0 ? "true" : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.alt_text ?? productName}
            className="product-gallery-img"
            loading={i === 0 ? "eager" : "lazy"}
            onLoad={(e) => handleLoad(photo.id, e)}
          />
        </div>
      ))}
    </div>
  )
}
