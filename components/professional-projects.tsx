"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"

export function ProfessionalProjects() {
  const allProjects = [
    {
      title: "Villa Upgrade",
      location: "Nijmegen",
      image: "/placeholder.svg?height=300&width=400",
    },
    {
      title: "Contemporary Apartment",
      location: "Amsterdam",
      image: "/placeholder.svg?height=300&width=400",
    },
    {
      title: "Garden House",
      location: "Utrecht",
      image: "/placeholder.svg?height=300&width=400",
    },
    {
      title: "Luxury Penthouse",
      location: "Rotterdam",
      image: "/placeholder.svg?height=300&width=400",
    },
    {
      title: "Sustainable Office",
      location: "The Hague",
      image: "/placeholder.svg?height=300&width=400",
    },
    {
      title: "Historic Renovation",
      location: "Delft",
      image: "/placeholder.svg?height=300&width=400",
    },
    {
      title: "Modern Townhouse",
      location: "Eindhoven",
      image: "/placeholder.svg?height=300&width=400",
    },
    {
      title: "Coastal Retreat",
      location: "Zandvoort",
      image: "/placeholder.svg?height=300&width=400",
    },
    {
      title: "Urban Loft",
      location: "Groningen",
      image: "/placeholder.svg?height=300&width=400",
    },
  ]

  const [projectsToShow, setProjectsToShow] = useState(3)
  const displayedProjects = allProjects.slice(0, projectsToShow)
  const hasMoreProjects = projectsToShow < allProjects.length

  const loadMoreProjects = () => {
    setProjectsToShow((prev) => Math.min(prev + 6, allProjects.length))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-black">{allProjects.length} projects</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedProjects.map((project, index) => (
          <div key={index} className="group cursor-pointer">
            <div className="aspect-[4/3] overflow-hidden rounded-lg mb-3">
              <img
                src={project.image || "/placeholder.svg"}
                alt={project.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <h3 className="font-semibold text-gray-900">{project.title}</h3>
            <p className="text-sm text-gray-500">{project.location}</p>
          </div>
        ))}
      </div>

      {hasMoreProjects && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={loadMoreProjects} className="px-8 bg-transparent">
            Load more projects
          </Button>
        </div>
      )}
    </div>
  )
}
