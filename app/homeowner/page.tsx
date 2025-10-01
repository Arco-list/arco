"use client"
import { useState, useEffect, Suspense } from "react"

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Heart, X } from "lucide-react"

import { AccountSettingsForm } from "@/components/account-settings-form"
import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const savedProjects = [
  {
    id: 1,
    title: "Villa upgrade",
    location: "Contemporary Villa in Nijmegen",
    image: "/placeholder.svg?height=300&width=400",
    likes: 12,
    slug: "villa-upgrade",
  },
  {
    id: 2,
    title: "Modern Garden house in Vinkeveense Plassen",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 8,
    slug: "modern-garden-house",
  },
  {
    id: 3,
    title: "Contemporary Villa in Nijmegen",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 15,
    slug: "contemporary-villa",
  },
]

const savedProfessionals = [
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
]

function HomeownerContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = searchParams.get("tab") || "saved-projects"
  const [activeTab, setActiveTab] = useState(initialTab)

  const [userSavedProjects, setUserSavedProjects] = useState(savedProjects)
  const [userSavedProfessionals, setUserSavedProfessionals] = useState(savedProfessionals)

  useEffect(() => {
    const tabParam = searchParams.get("tab")
    if (tabParam && ["saved-projects", "saved-professionals", "settings"].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const unsaveProject = (projectId: number) => {
    setUserSavedProjects((prev) => prev.filter((project) => project.id !== projectId))
  }

  const unsaveProfessional = (professionalId: string) => {
    setUserSavedProfessionals((prev) => prev.filter((professional) => professional.id !== professionalId))
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    router.push(`/homeowner?tab=${value}`)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <DashboardHeader />

      <main className="flex-1 py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-8">Homeowner</h1>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="saved-projects">Saved Projects</TabsTrigger>
              <TabsTrigger value="saved-professionals">Saved Professionals</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="saved-projects">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {userSavedProjects.map((project) => (
                  <div key={project.id} className="group cursor-pointer relative">
                    <Link href={`/projects/${project.slug}`}>
                      <div className="relative overflow-hidden rounded-lg bg-gray-100">
                        <img
                          src={project.image || "/placeholder.svg"}
                          alt={project.title}
                          className="h-64 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="mt-3 flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{project.title}</h3>
                          <p className="text-xs text-gray-500 mt-1">{project.location}</p>
                        </div>
                        <div className="ml-3 flex items-center gap-1 text-sm text-gray-500">
                          <Heart className="h-3 w-3" />
                          <span>{project.likes}</span>
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        unsaveProject(project.id)
                      }}
                      className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
                    >
                      <X className="h-4 w-4 text-gray-600 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
              {userSavedProjects.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No saved projects yet.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="saved-professionals">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userSavedProfessionals.map((professional) => (
                  <div
                    key={professional.id}
                    className="group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow relative"
                  >
                    <Link href={`/professionals/${professional.id}`}>
                      <div className="aspect-square relative">
                        <img
                          src={professional.image || "/placeholder.svg"}
                          alt={professional.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-sm font-medium">{professional.rating}</span>
                          <span className="text-sm text-gray-500">({professional.reviewCount} reviews)</span>
                        </div>
                        <h3 className="font-semibold text-lg mb-1">{professional.name}</h3>
                        <p className="text-gray-600 mb-2">
                          {professional.profession} in {professional.location}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {professional.specialties.map((specialty, index) => (
                            <span
                              key={index}
                              className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                            >
                              {specialty}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        unsaveProfessional(professional.id)
                      }}
                      className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
                    >
                      <X className="h-4 w-4 text-gray-600 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
              {userSavedProfessionals.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No saved professionals yet.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings">
              <AccountSettingsForm />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function Homeowner() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <HomeownerContent />
    </Suspense>
  )
}
