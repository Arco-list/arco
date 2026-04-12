"use client"

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
  return (
    <div className="product-gallery">
      {photos.map((photo, i) => (
        <div key={photo.id} className="product-gallery-item">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.alt_text ?? productName}
            className="product-gallery-img"
            loading={i === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}
    </div>
  )
}
