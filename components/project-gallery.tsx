"use client"

import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import { useState } from "react"
import { GroupedPicturesModal } from "@/components/grouped-pictures-modal"

export function ProjectGallery() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const groupedGalleryData = [
    {
      id: "kitchen",
      title: "Kitchen",
      description: "Modern kitchen design with premium finishes",
      images: [
        {
          id: "kitchen-1",
          src: "/modern-kitchen-island.png",
          alt: "Modern kitchen with island",
          isPrimary: true,
        },
        {
          id: "kitchen-2",
          src: "/kitchen-cabinets-and-appliances.jpg",
          alt: "Kitchen cabinets and appliances",
          isPrimary: false,
        },
        {
          id: "kitchen-3",
          src: "/kitchen-dining-area.jpg",
          alt: "Kitchen dining area",
          isPrimary: false,
        },
      ],
    },
    {
      id: "bathroom",
      title: "Bathroom",
      description: "Luxurious bathroom spaces with spa-like features",
      images: [
        {
          id: "bathroom-1",
          src: "/modern-bathroom-glass-shower.png",
          alt: "Modern bathroom with glass shower",
          isPrimary: true,
        },
        {
          id: "bathroom-2",
          src: "/bathroom-vanity-with-mirror.jpg",
          alt: "Bathroom vanity with mirror",
          isPrimary: false,
        },
        {
          id: "bathroom-3",
          src: "/guest-bathroom-design.jpg",
          alt: "Guest bathroom design",
          isPrimary: false,
        },
      ],
    },
    {
      id: "living-spaces",
      title: "Living Spaces",
      description: "Open concept living areas designed for comfort",
      images: [
        {
          id: "living-1",
          src: "/modern-living-room-fireplace.png",
          alt: "Modern living room with fireplace",
          isPrimary: true,
        },
        {
          id: "living-2",
          src: "/dining-area-with-large-windows.jpg",
          alt: "Dining area with large windows",
          isPrimary: false,
        },
        {
          id: "living-3",
          src: "/cozy-home-office.png",
          alt: "Home office space",
          isPrimary: false,
        },
      ],
    },
    {
      id: "bedrooms",
      title: "Bedrooms",
      description: "Comfortable and stylish bedroom designs",
      images: [
        {
          id: "bedroom-1",
          src: "/master-bedroom-walk-in.png",
          alt: "Master bedroom with walk-in closet",
          isPrimary: true,
        },
        {
          id: "bedroom-2",
          src: "/guest-bedroom-design.jpg",
          alt: "Guest bedroom design",
          isPrimary: false,
        },
        {
          id: "bedroom-3",
          src: "/bedroom-storage-solutions.jpg",
          alt: "Bedroom storage solutions",
          isPrimary: false,
        },
      ],
    },
  ]

  const displayImages = [
    groupedGalleryData[0].images[0], // Kitchen primary
    groupedGalleryData[1].images[0], // Bathroom primary
    groupedGalleryData[2].images[0], // Living primary
    groupedGalleryData[3].images[0], // Bedroom primary
    groupedGalleryData[0].images[1], // Kitchen secondary for overlay
  ]

  const openModal = () => {
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Main gallery grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[50vh] min-h-[400px]">
        {/* Large image */}
        <div className="md:row-span-2 cursor-pointer" onClick={openModal}>
          <img
            src={displayImages[0].src || "/placeholder.svg"}
            alt={displayImages[0].alt}
            className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
          />
        </div>

        {/* Top right images */}
        <div className="grid grid-cols-2 gap-4 h-full">
          <div className="cursor-pointer" onClick={openModal}>
            <img
              src={displayImages[1].src || "/placeholder.svg"}
              alt={displayImages[1].alt}
              className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
          <div className="cursor-pointer" onClick={openModal}>
            <img
              src={displayImages[2].src || "/placeholder.svg"}
              alt={displayImages[2].alt}
              className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
        </div>

        {/* Bottom right images */}
        <div className="grid grid-cols-2 gap-4 h-full">
          <div className="cursor-pointer" onClick={openModal}>
            <img
              src={displayImages[3].src || "/placeholder.svg"}
              alt={displayImages[3].alt}
              className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
          <div className="relative">
            <div className="cursor-pointer" onClick={openModal}>
              <img
                src={displayImages[4].src || "/placeholder.svg"}
                alt={displayImages[4].alt}
                className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
              />
            </div>
            <div className="absolute inset-0 bg-white bg-opacity-80 rounded-lg flex items-center justify-center">
              <Button
                variant="secondary"
                size="sm"
                className="bg-black text-white hover:bg-gray-800"
                onClick={openModal}
              >
                <MoreHorizontal className="w-4 h-4 mr-2" />
                Show all photos
              </Button>
            </div>
          </div>
        </div>
      </div>

      <GroupedPicturesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageGroups={groupedGalleryData.map((category) => ({
          category: category.title,
          description: category.description,
          images: category.images,
        }))}
      />
    </div>
  )
}
