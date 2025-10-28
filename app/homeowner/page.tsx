"use client"
import { useState, useEffect, Suspense } from "react"

import { useSearchParams, useRouter } from "next/navigation"

import { AccountSettingsForm } from "@/components/account-settings-form"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/auth-context"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import { useProjectLikes } from "@/contexts/project-likes-context"
import { ProfessionalCard } from "@/components/professional-card"
import { ProjectCard } from "@/components/project-card"
import { useFilters } from "@/contexts/filter-context"
import { FilterProvider } from "@/contexts/filter-context"

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
  const {
    likedProjectIds,
    mutatingProjectIds: likeMutatingProjectIds,
    likeCounts,
    toggleLike,
  } = useProjectLikes()
  const { taxonomyLabelMap } = useFilters()
  const initialTab = searchParams.get("tab") || "saved-projects"
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    const tabParam = searchParams.get("tab")
    if (tabParam && ["saved-projects", "saved-professionals", "account"].includes(tabParam)) {
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
            <TabsList className="mb-8 rounded-full p-1 gap-1 w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="saved-projects" className="rounded-full px-4 whitespace-nowrap">Saved Projects</TabsTrigger>
              <TabsTrigger value="saved-professionals" className="rounded-full px-4 whitespace-nowrap">Saved Professionals</TabsTrigger>
              <TabsTrigger value="account" className="rounded-full px-4 whitespace-nowrap">Account</TabsTrigger>
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

                  // Build project title from style, type, and location (EXACT SAME as /projects page)
                  const style = summary?.style_preferences?.[0] || ""
                  const subType = summary?.project_type || ""
                  const location = summary?.location || "Location unavailable"
                  const parts = []
                  if (style) {
                    const styleLabel = taxonomyLabelMap.get(style) || style
                    parts.push(styleLabel)
                  }
                  if (subType) {
                    const subTypeLabel = taxonomyLabelMap.get(subType) || subType
                    parts.push(subTypeLabel)
                  }
                  parts.push(`in ${location}`)
                  const projectTitle = parts.join(" ")

                  const projectSlug = summary?.slug ?? null
                  const projectImage = summary?.primary_photo_url ?? "/placeholder.svg"
                  const projectAlt = summary?.primary_photo_alt ?? projectTitle
                  const projectLikes = summary?.likes_count ?? 0
                  const isMutatingSave = mutatingProjectIds.has(projectId)
                  const isLiked = likedProjectIds.has(projectId)
                  const isMutatingLike = likeMutatingProjectIds.has(projectId)
                  const likesCount = likeCounts[projectId] ?? projectLikes

                  const projectData = {
                    id: projectId,
                    title: projectTitle,
                    slug: projectSlug,
                    imageUrl: projectImage,
                    imageAlt: projectAlt,
                    location,
                    likes: projectLikes,
                  }

                  return (
                    <ProjectCard
                      key={projectId}
                      project={projectData}
                      isSaved={true}
                      isLiked={isLiked}
                      isMutatingSave={isMutatingSave}
                      isMutatingLike={isMutatingLike}
                      likesCount={likesCount}
                      onToggleSave={() => unsaveProject(projectId)}
                      onToggleLike={(id, count) => toggleLike(id, { currentCount: count })}
                    />
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
                  const { companyId, card } = entry
                  const isMutating = mutatingProfessionalIds.has(companyId)

                  return (
                    <div key={companyId} className="relative">
                      <ProfessionalCard
                        professional={card}
                        isSaved
                        isMutating={isMutating}
                        onToggleSave={() => {
                          unsaveProfessional(companyId)
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

            <TabsContent value="account">
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
      <FilterProvider>
        <HomeownerContent />
      </FilterProvider>
    </Suspense>
  )
}
