"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { MoreHorizontal, ChevronLeft, ChevronRight, XIcon, Share, Heart } from "lucide-react"
import { useState } from "react"

export function ProjectGallery() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  // Gallery images data
  const galleryImages = [
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Modern bathroom with glass shower",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Modern kitchen",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Bathroom vanity",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Bedroom with storage",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Bathroom shelving",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Living room",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Dining area",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Outdoor terrace",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Master bedroom",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Home office",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Guest bathroom",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Entrance hallway",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Laundry room",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Walk-in closet",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Recreation room",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Rooftop garden",
    },
    {
      src: "/placeholder.svg?height=800&width=1200",
      alt: "Garage",
    },
  ]

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % galleryImages.length)
  }

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)
  }

  const openModal = (index = 0) => {
    setCurrentPhotoIndex(index)
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Main gallery grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[50vh] min-h-[400px]">
        {/* Large image */}
        <div className="md:row-span-2 cursor-pointer" onClick={() => openModal(0)}>
          <img
            src={galleryImages[0].src || "/placeholder.svg"}
            alt={galleryImages[0].alt}
            className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
          />
        </div>

        {/* Top right images */}
        <div className="grid grid-cols-2 gap-4 h-full">
          <div className="cursor-pointer" onClick={() => openModal(1)}>
            <img
              src={galleryImages[1].src || "/placeholder.svg"}
              alt={galleryImages[1].alt}
              className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
          <div className="cursor-pointer" onClick={() => openModal(2)}>
            <img
              src={galleryImages[2].src || "/placeholder.svg"}
              alt={galleryImages[2].alt}
              className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
        </div>

        {/* Bottom right images */}
        <div className="grid grid-cols-2 gap-4 h-full">
          <div className="cursor-pointer" onClick={() => openModal(3)}>
            <img
              src={galleryImages[3].src || "/placeholder.svg"}
              alt={galleryImages[3].alt}
              className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
          <div className="relative">
            <div className="cursor-pointer" onClick={() => openModal(4)}>
              <img
                src={galleryImages[4].src || "/placeholder.svg"}
                alt={galleryImages[4].alt}
                className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
              />
            </div>
            <div className="absolute inset-0 bg-white bg-opacity-80 rounded-lg flex items-center justify-center">
              <Button
                variant="secondary"
                size="sm"
                className="bg-black text-white hover:bg-gray-800"
                onClick={() => openModal(0)}
              >
                <MoreHorizontal className="w-4 h-4 mr-2" />
                Show all photos
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen photo modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-none w-screen h-screen p-0 bg-black border-none flex items-center justify-center">
          <div className="relative w-full h-full flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-black/90 to-transparent">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => setIsModalOpen(false)}
              >
                <XIcon className="w-4 h-4 mr-2" />
                Close
              </Button>

              <div className="text-white font-medium">
                {currentPhotoIndex + 1}/{galleryImages.length}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <Share className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <Heart className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8 md:p-16">
              <img
                src={galleryImages[currentPhotoIndex].src || "/placeholder.svg"}
                alt={galleryImages[currentPhotoIndex].alt}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Navigation arrows */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={prevPhoto}
              disabled={galleryImages.length <= 1}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={nextPhoto}
              disabled={galleryImages.length <= 1}
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
