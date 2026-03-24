"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronRight } from "lucide-react"

interface Photo {
  id: string
  url: string
  caption: string | null
  feature_id: string | null
  /** Space slug derived from the feature's linked space */
  space?: string | null
}

interface PhotoTourProps {
  photos: Photo[]
  projectId: string
  /** Unique space slugs present on this project's photos */
  spaces?: string[]
}

export function PhotoTour({ photos, spaces = [] }: PhotoTourProps) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [showMore, setShowMore] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Build categories from actual spaces on photos, with "All" first
  const categories = ['All', ...spaces.map((slug) => {
    // Convert slug to display name (e.g. "living-room" → "Living Room")
    return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  })]

  // Slug lookup for filtering
  const categorySlugMap = new Map<string, string>()
  spaces.forEach((slug) => {
    const label = slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    categorySlugMap.set(label, slug)
  })

  // Filter photos by space
  const filteredPhotos = activeCategory === 'All'
    ? photos
    : photos.filter(photo => {
        const targetSlug = categorySlugMap.get(activeCategory)
        return targetSlug && photo.space === targetSlug
      })

  // Initial 6 photos for display
  const initialPhotos = filteredPhotos.slice(0, 6)
  const remainingPhotos = filteredPhotos.slice(6)
  const displayPhotos = showMore ? filteredPhotos : initialPhotos

  // Lightbox always shows ALL photos (pills navigate, not filter)
  const lightboxPhotos = photos

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % lightboxPhotos.length)
  }

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + lightboxPhotos.length) % lightboxPhotos.length)
  }

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category)
    setShowMore(false)
    // If lightbox is open, reset to first image of new filtered set
    if (lightboxOpen) {
      setLightboxIndex(0)
    }
  }

  // In lightbox: navigate to the first photo of a given space
  const handleLightboxSpaceNav = (spaceLabel: string) => {
    const targetSlug = categorySlugMap.get(spaceLabel)
    if (!targetSlug) return
    const targetIndex = photos.findIndex((p) => p.space === targetSlug)
    if (targetIndex !== -1) setLightboxIndex(targetIndex)
  }

  // Determine which space pill should be active based on current lightbox photo
  const currentLightboxSpace = lightboxOpen && photos[lightboxIndex]?.space
    ? photos[lightboxIndex].space
    : null
  const activeLightboxPill = currentLightboxSpace
    ? currentLightboxSpace.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowRight') nextImage()
    if (e.key === 'ArrowLeft') prevImage()
  }

  return (
    <>
      {/* Photo Tour Content - No wrap needed, already inside project-container */}
      <div id="photo-tour" className="photo-tour-content">
        <div className="section-header">
          <h2 className="arco-section-title">Photo Tour</h2>
        </div>

        {/* Category Tags — only show when photos have spaces */}
        {spaces.length > 0 && (
          <div className="category-tags">
            {categories.map((category) => (
              <button
                key={category}
                className={`category-tag ${activeCategory === category ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category)}
              >
                {category}
              </button>
            ))}
          </div>
        )}

          {/* Photo Gallery */}
          <div className="photo-gallery">
          {displayPhotos.map((photo, index) => {
            // Alternate between large and grid layouts
            const isLarge = index % 3 === 0
            const isHidden = index >= 6 && !showMore

            if (isLarge) {
              return (
                <div
                  key={photo.id}
                  className={`gallery-image-large-container ${isHidden ? 'hidden-photo' : ''} ${showMore ? 'revealed' : ''}`}
                  onClick={() => openLightbox(index)}
                >
                  <Image
                    src={photo.url}
                    alt={photo.caption ?? 'Project photo'}
                    width={1400}
                    height={900}
                    className="gallery-image-large"
                  />
                </div>
              )
            }

            // First of the pair renders both images; second returns null
            if (index % 3 === 1) {
              const nextPhoto = displayPhotos[index + 1]
              return (
                <div
                  key={`row-${photo.id}`}
                  className={`gallery-row ${isHidden ? 'hidden-photo' : ''} ${showMore ? 'revealed' : ''}`}
                >
                  <div
                    className="gallery-image-container"
                    onClick={() => openLightbox(index)}
                  >
                    <Image
                      src={photo.url}
                      alt={photo.caption ?? 'Project photo'}
                      width={700}
                      height={525}
                      className="gallery-image"
                    />
                  </div>
                  {nextPhoto && (
                    <div
                      className="gallery-image-container"
                      onClick={() => openLightbox(index + 1)}
                    >
                      <Image
                        src={nextPhoto.url}
                        alt={nextPhoto.caption ?? 'Project photo'}
                        width={700}
                        height={525}
                        className="gallery-image"
                      />
                    </div>
                  )}
                </div>
              )
            }

            // Second of the pair — already rendered above
            return null
          })}
        </div>

        {/* Show More/Less Buttons */}
        {remainingPhotos.length > 0 && (
          <div className="show-more-container">
            {!showMore ? (
              <button
                className="btn-tertiary"
                onClick={() => setShowMore(true)}
              >
                More photos
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                className="btn-tertiary"
                onClick={() => setShowMore(false)}
              >
                Less photos
                <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div 
          className="lightbox"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button 
              className="lightbox-close"
              onClick={closeLightbox}
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Navigation arrows */}
            <button 
              className="lightbox-prev"
              onClick={prevImage}
              aria-label="Previous image"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button 
              className="lightbox-next"
              onClick={nextImage}
              aria-label="Next image"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 18L15 12L9 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Image */}
            <div className="lightbox-image-container">
              <Image
                src={lightboxPhotos[lightboxIndex].url}
                alt={lightboxPhotos[lightboxIndex].caption ?? 'Project photo'}
                width={1920}
                height={1080}
                className="lightbox-image"
                priority
              />
            </div>

            {/* Space navigation pills — highlight based on current photo's space */}
            {spaces.length > 0 && (
              <div className="lightbox-categories">
                <div className="category-tags category-tags-dark">
                  {categories.filter((c) => c !== "All").map((category) => (
                    <button
                      key={category}
                      className={`category-tag category-tag-dark ${activeLightboxPill === category ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLightboxSpaceNav(category)
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Caption */}
            {lightboxPhotos[lightboxIndex].caption && (
              <div className="lightbox-caption">
                {lightboxPhotos[lightboxIndex].caption}
              </div>
            )}

            {/* Counter */}
            <div className="lightbox-counter">
              {lightboxIndex + 1} / {lightboxPhotos.length}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
