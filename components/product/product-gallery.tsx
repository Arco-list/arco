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

export function ProductGallery({ photos, productName }: ProductGalleryProps) {
  const [orientations, setOrientations] = useState<Record<string, "landscape" | "portrait">>({})

  const handleLoad = useCallback((id: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const orientation = img.naturalHeight > img.naturalWidth ? "portrait" : "landscape"
    setOrientations((prev) => ({ ...prev, [id]: orientation }))
  }, [])

  return (
    <div className="product-gallery">
      {photos.map((photo, i) => (
        <div
          key={photo.id}
          className="product-gallery-item"
          data-orientation={orientations[photo.id] ?? "landscape"}
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
