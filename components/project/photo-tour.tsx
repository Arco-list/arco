"use client"

import { useState } from "react"
import Image from "next/image"

interface Photo {
  id: string
  url: string
  caption: string | null
  feature_id: string | null
}

interface PhotoTourProps {
  photos: Photo[]
  projectId: string
}

export function PhotoTour({ photos }: PhotoTourProps) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [showMore, setShowMore] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Categories - this would ideally come from features/categories
  // TODO: Extract actual categories from photo feature_ids
  const categories = ['All', 'Exterior', 'Living', 'Kitchen', 'Bedroom', 'Bathroom', 'Garden']

  // Filter photos by category
  const filteredPhotos = activeCategory === 'All' 
    ? photos 
    : photos.filter(photo => {
        // TODO: Map feature_id to category name
        // For now, filter by caption containing category name
        return photo.caption?.toLowerCase().includes(activeCategory.toLowerCase())
      })

  // Initial 6 photos for display
  const initialPhotos = filteredPhotos.slice(0, 6)
  const remainingPhotos = filteredPhotos.slice(6)
  const displayPhotos = showMore ? filteredPhotos : initialPhotos

  // UPDATED: Always use ALL filtered photos in lightbox
  const lightboxPhotos = filteredPhotos

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

  const handleLightboxCategoryChange = (category: string) => {
    // Update category
    setActiveCategory(category)
    setShowMore(false)
    // Reset to first image
    setLightboxIndex(0)
  }

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

        {/* Category Tags */}
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

            // Check if we need a grid row
            const nextPhoto = displayPhotos[index + 1]
            if (!nextPhoto || (index + 1) % 3 === 0) {
              // Single image or end of pair
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

            // Skip this one as it's part of the grid row above
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
                Show More Photos <span>({remainingPhotos.length} remaining)</span>
              </button>
            ) : (
              <button
                className="btn-tertiary"
                onClick={() => setShowMore(false)}
              >
                Show Less Photos
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

            {/* UPDATED: Category tags with dark theme - stay in lightbox */}
            <div className="lightbox-categories">
              <div className="category-tags category-tags-dark">
                {categories.map((category) => (
                  <button
                    key={category}
                    className={`category-tag category-tag-dark ${activeCategory === category ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLightboxCategoryChange(category)
                    }}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

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
