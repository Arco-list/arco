"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Star } from "lucide-react"

const professionals = [
  {
    id: "marco-van-veldhuizen",
    name: "Marco van Veldhuizen",
    profession: "Architect",
    location: "Amsterdam",
    rating: 4.92,
    reviewCount: 24,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Modern Architecture", "Sustainable Design"],
  },
  {
    id: "fx-domotica",
    name: "FX Domotica",
    profession: "Home Automation Specialist",
    location: "Amsterdam",
    rating: 4.8,
    reviewCount: 18,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Smart Home", "Automation Systems"],
  },
  {
    id: "sarah-interior",
    name: "Sarah Interior Design",
    profession: "Interior Designer",
    location: "Utrecht",
    rating: 4.95,
    reviewCount: 32,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Luxury Interiors", "Color Consulting"],
  },
  {
    id: "green-landscapes",
    name: "Green Landscapes",
    profession: "Landscape Architect",
    location: "Rotterdam",
    rating: 4.7,
    reviewCount: 15,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Garden Design", "Outdoor Spaces"],
  },
  {
    id: "build-masters",
    name: "Build Masters",
    profession: "General Contractor",
    location: "The Hague",
    rating: 4.85,
    reviewCount: 28,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Renovations", "New Construction"],
  },
  {
    id: "light-solutions",
    name: "Light Solutions",
    profession: "Lighting Designer",
    location: "Eindhoven",
    rating: 4.9,
    reviewCount: 21,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Architectural Lighting", "Smart Lighting"],
  },
]

export function ProfessionalsGrid() {
  const [visibleCount, setVisibleCount] = useState(6)

  const loadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 6, professionals.length))
  }

  return (
    <div className="px-4 md:px-8">
      <div className="max-w-7xl mx-auto py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {professionals.slice(0, visibleCount).map((professional) => (
            <Link
              key={professional.id}
              href={`/professionals/${professional.id}`}
              className="group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-square relative">
                <Image
                  src={professional.image || "/placeholder.svg"}
                  alt={professional.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-1 mb-2">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{professional.rating}</span>
                  <span className="text-sm text-gray-500">({professional.reviewCount} reviews)</span>
                </div>
                <h3 className="font-semibold text-lg mb-1">{professional.name}</h3>
                <p className="text-gray-600 mb-2">
                  {professional.profession} in {professional.location}
                </p>
                <div className="flex flex-wrap gap-1">
                  {professional.specialties.map((specialty, index) => (
                    <span key={index} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {visibleCount < professionals.length && (
          <div className="text-center mt-8">
            <button
              onClick={loadMore}
              className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 transition-colors"
            >
              Load More Professionals
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
