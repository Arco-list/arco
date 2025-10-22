"use client"
import { useState, useEffect, Suspense } from "react"

import { useSearchParams, useRouter } from "next/navigation"
import { ThumbsUp, X } from "lucide-react"

import { AccountSettingsForm } from "@/components/account-settings-form"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/auth-context"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import { ProfessionalCard } from "@/components/professional-card"
import Link from "next/link"

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
  const {
    savedProfessionals: savedProfessionalEntries,
    isLoading: isSavedProfessionalsLoading,
    error: savedProfessionalsError,
    mutatingProfessionalIds: mutatingProfessionalIds,
    removeProfessional,
  } = useSavedProfessionals()
  const initialTab = searchParams.get("tab") || "saved-projects"
  const [activeTab, setActiveTab] = useState(initialTab)

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

  const unsaveProject = (projectId: string) => {
    void removeProject(projectId)
  }

  const unsaveProfessional = (professionalId: string) => {
    void removeProfessional(professionalId)
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    router.push(`/homeowner?tab=${value}`)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />

      <main className="flex-1 py-8 pt-20">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                            <ThumbsUp className="h-3 w-3" />
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
              {savedProfessionalsError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 mb-6 text-sm text-red-700">
                  {savedProfessionalsError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {savedProfessionalEntries.map((entry) => {
                  const { professionalId, card } = entry
                  const isMutating = mutatingProfessionalIds.has(professionalId)

                  return (
                    <div key={professionalId} className="relative">
                      <ProfessionalCard
                        professional={card}
                        isSaved
                        isMutating={isMutating}
                        onToggleSave={() => {
                          unsaveProfessional(professionalId)
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              {!isSavedProfessionalsLoading &&
                savedProfessionalEntries.length === 0 &&
                !savedProfessionalsError && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No saved professionals yet.</p>
                </div>
              )}
              {isSavedProfessionalsLoading && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Loading saved professionals…</p>
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
