"use client"
import { useState, useEffect, Suspense } from "react"

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Heart, X } from "lucide-react"

import { AccountSettingsForm } from "@/components/account-settings-form"
import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/auth-context"
import { useSavedProjects } from "@/contexts/saved-projects-context"

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
  const { profile, user, isLoading } = useAuth()
  const {
    savedProjects,
    isLoading: isSavedProjectsLoading,
    error: savedProjectsError,
    mutatingProjectIds,
    removeProject,
  } = useSavedProjects()
  const initialTab = searchParams.get("tab") || "saved-projects"
  const [activeTab, setActiveTab] = useState(initialTab)

  const [userSavedProfessionals, setUserSavedProfessionals] = useState(savedProfessionals)

  useEffect(() => {
    const tabParam = searchParams.get("tab")
    if (tabParam && ["saved-projects", "saved-professionals", "settings"].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const sessionMetadata = user?.user_metadata ?? {}
  const metadataUserTypes = Array.isArray(sessionMetadata.user_types)
    ? (sessionMetadata.user_types as string[])
    : typeof sessionMetadata.user_types === "string"
      ? [sessionMetadata.user_types]
      : null
  const userTypes = profile?.user_types ?? metadataUserTypes
  const isAdmin = userTypes?.includes("admin") ?? false

  useEffect(() => {
    if (isLoading) return
    if (!isAdmin) return

    router.replace("/admin")
  }, [isAdmin, isLoading, router])

  const unsaveProject = (projectId: string) => {
    void removeProject(projectId)
  }

  const unsaveProfessional = (professionalId: string) => {
    setUserSavedProfessionals((prev) => prev.filter((professional) => professional.id !== professionalId))
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    router.push(`/homeowner?tab=${value}`)
  }

  return (
    isAdmin ? null : (
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
              {savedProjectsError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 mb-6 text-sm text-red-700">
                  {savedProjectsError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedProjects.map((entry) => {
                  const { projectId, summary } = entry
                  const projectTitle = summary?.title ?? "Untitled project"
                  const projectSlug = summary?.slug ?? null
                  const projectImage = summary?.primary_photo_url ?? "/placeholder.svg"
                  const projectAlt = summary?.primary_photo_alt ?? projectTitle
                  const projectLocation = summary?.location ?? "Location unavailable"
                  const projectLikes = summary?.likes_count ?? 0
                  const isMutating = mutatingProjectIds.has(projectId)

                  return (
                    <div key={projectId} className="group cursor-pointer relative">
                      <Link href={projectSlug ? `/projects/${projectSlug}` : "#"} aria-disabled={!projectSlug}>
                        <div className="relative overflow-hidden rounded-lg bg-gray-100">
                          <img
                            src={projectImage}
                            alt={projectAlt ?? projectTitle}
                            className="h-64 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="mt-3 flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{projectTitle}</h3>
                            <p className="text-xs text-gray-500 mt-1">{projectLocation}</p>
                          </div>
                          <div className="ml-3 flex items-center gap-1 text-sm text-gray-500">
                            <Heart className="h-3 w-3" />
                            <span>{projectLikes}</span>
                          </div>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          unsaveProject(projectId)
                        }}
                        disabled={isMutating}
                        aria-label="Remove from saved projects"
                        className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors disabled:opacity-70"
                      >
                        <X className="h-4 w-4 text-gray-600 hover:text-red-500" />
                      </button>
                    </div>
                  )
                })}
              </div>
              {!isSavedProjectsLoading && savedProjects.length === 0 && !savedProjectsError && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No saved projects yet.</p>
                </div>
              )}
              {isSavedProjectsLoading && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Loading saved projects…</p>
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
  )
}

export default function Homeowner() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <HomeownerContent />
    </Suspense>
  )
}
