"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { ImageIcon, Loader2, Search, Trash2, X } from "lucide-react"
import {
  getHeroCoversAction,
  searchProjectsForHeroAction,
  getProjectPhotosAction,
  saveHeroCoverAction,
  removeHeroCoverAction,
  type HeroCover,
} from "@/app/admin/hero/actions"

type SearchProject = {
  id: string
  title: string
  slug: string | null
  primary_photo_url: string | null
}

type ProjectPhoto = {
  id: string
  url: string
  is_primary: boolean
}

type EditorStep = "slots" | "search" | "photos"

export function HeroCoversEditor({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [covers, setCovers] = useState<HeroCover[]>([])
  const [step, setStep] = useState<EditorStep>("slots")
  const [activeSlot, setActiveSlot] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchProject[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedProject, setSelectedProject] = useState<SearchProject | null>(null)
  const [photos, setPhotos] = useState<ProjectPhoto[]>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false)
  const [isPending, startTransition] = useTransition()
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load current covers on open
  useEffect(() => {
    if (!isOpen) return
    startTransition(async () => {
      const result = await getHeroCoversAction()
      if (result.success) setCovers(result.covers)
    })
  }, [isOpen])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true)
      const result = await searchProjectsForHeroAction(query.trim())
      if (result.success) setSearchResults(result.projects)
      setIsSearching(false)
    }, 300)
  }, [])

  const handleSelectProject = useCallback(async (project: SearchProject) => {
    setSelectedProject(project)
    setStep("photos")
    setIsLoadingPhotos(true)
    const result = await getProjectPhotosAction(project.id)
    if (result.success) setPhotos(result.photos)
    setIsLoadingPhotos(false)
  }, [])

  const handleSelectPhoto = useCallback((photoUrl: string) => {
    if (!selectedProject) return
    startTransition(async () => {
      const result = await saveHeroCoverAction({
        slot: activeSlot,
        projectId: selectedProject.id,
        photoUrl,
      })
      if (result.success) {
        toast.success(`Slot ${activeSlot} updated`)
        // Refresh covers
        const refreshed = await getHeroCoversAction()
        if (refreshed.success) setCovers(refreshed.covers)
        setStep("slots")
        setSearchQuery("")
        setSearchResults([])
        setSelectedProject(null)
        setPhotos([])
      } else {
        toast.error(result.error ?? "Failed to save")
      }
    })
  }, [activeSlot, selectedProject])

  const handleRemoveSlot = useCallback((slot: number) => {
    startTransition(async () => {
      const result = await removeHeroCoverAction(slot)
      if (result.success) {
        toast.success(`Slot ${slot} cleared`)
        setCovers((prev) => prev.filter((c) => c.slot !== slot))
      } else {
        toast.error(result.error ?? "Failed to remove")
      }
    })
  }, [])

  const handleSlotClick = async (slot: number) => {
    setActiveSlot(slot)
    const cover = covers.find((c) => c.slot === slot)

    if (cover) {
      // Slot has a project — go directly to photos for that project
      setSelectedProject({
        id: cover.project_id,
        title: cover.project_title ?? "Project",
        slug: cover.project_slug ?? null,
        primary_photo_url: cover.photo_url,
      })
      setStep("photos")
      setIsLoadingPhotos(true)
      const result = await getProjectPhotosAction(cover.project_id)
      if (result.success) setPhotos(result.photos)
      setIsLoadingPhotos(false)
    } else {
      // Empty slot — go to search
      setStep("search")
      setSearchQuery("")
      setSearchResults([])
      setSelectedProject(null)
      setPhotos([])
    }
  }

  const handleBack = () => {
    if (step === "photos") {
      // If this slot already had a project, go back to slots (not search)
      const cover = covers.find((c) => c.slot === activeSlot)
      if (cover) {
        setStep("slots")
        setSelectedProject(null)
        setPhotos([])
      } else {
        setStep("search")
        setSelectedProject(null)
        setPhotos([])
      }
    } else if (step === "search") {
      setStep("slots")
      setSearchQuery("")
      setSearchResults([])
    }
  }

  if (!isOpen) return null

  const getCoverForSlot = (slot: number) => covers.find((c) => c.slot === slot)

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 600, padding: 0, display: "flex", flexDirection: "column", maxHeight: "85vh" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 28px",
            background: "var(--arco-off-white)",
            borderRadius: "12px 12px 0 0",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {step !== "slots" && (
              <button
                type="button"
                className="popup-close"
                onClick={handleBack}
                style={{ fontSize: 16, display: "flex" }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 12L6 8L10 4" />
                </svg>
              </button>
            )}
            <h3 className="arco-section-title" style={{ margin: 0 }}>
              {step === "slots" && "Hero covers"}
              {step === "search" && `Slot ${activeSlot} — Select project`}
              {step === "photos" && `Select photo`}
            </h3>
          </div>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 28px 28px", overflowY: "auto", flex: 1 }}>

          {/* ── Slots view ── */}
          {step === "slots" && (
            <div>
              <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 20 }}>
                Select up to 5 projects for the homepage hero carousel.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3, 4, 5].map((slot) => {
                  const cover = getCoverForSlot(slot)
                  return (
                    <div
                      key={slot}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--arco-rule)",
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                      onClick={() => handleSlotClick(slot)}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#016D75")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--arco-rule)")}
                    >
                      {/* Thumbnail */}
                      {cover ? (
                        <img
                          src={cover.photo_url}
                          alt=""
                          style={{ width: 80, height: 48, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: 80,
                          height: 48,
                          borderRadius: 4,
                          background: "var(--arco-off-white)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <ImageIcon style={{ width: 20, height: 20, color: "var(--arco-rule)" }} />
                        </div>
                      )}

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--arco-black)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cover ? cover.project_title ?? "Project" : `Slot ${slot} — Empty`}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--arco-mid-grey)", margin: "2px 0 0" }}>
                          {cover ? "Click to change" : "Click to select a project"}
                        </p>
                      </div>

                      {/* Remove button */}
                      {cover && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveSlot(slot)
                          }}
                          disabled={isPending}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            border: "none",
                            background: "var(--arco-off-white)",
                            cursor: "pointer",
                            flexShrink: 0,
                            color: "var(--arco-mid-grey)",
                          }}
                          title="Remove"
                        >
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Search view ── */}
          {step === "search" && (
            <div>
              <div style={{ position: "relative", marginBottom: 16 }}>
                <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--arco-mid-grey)" }} />
                <input
                  type="text"
                  className="form-input"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search projects by title..."
                  style={{ marginBottom: 0, paddingLeft: 36 }}
                  autoFocus
                />
              </div>

              {isSearching && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--arco-mid-grey)", fontSize: 13 }}>
                  Searching...
                </div>
              )}

              {!isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--arco-mid-grey)", fontSize: 13 }}>
                  No projects found
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {searchResults.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleSelectProject(project)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--arco-rule)",
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      transition: "background 0.1s",
                      fontFamily: "var(--font-sans)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arco-off-white)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    {project.primary_photo_url ? (
                      <img
                        src={project.primary_photo_url}
                        alt=""
                        style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 60,
                        height: 40,
                        borderRadius: 4,
                        background: "var(--arco-off-white)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <ImageIcon style={{ width: 16, height: 16, color: "var(--arco-rule)" }} />
                      </div>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 400, color: "var(--arco-black)" }}>
                      {project.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Photos view ── */}
          {step === "photos" && (
            <div>
              {selectedProject && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", margin: 0 }}>
                    Select a photo from <strong>{selectedProject.title}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("search")
                      setSelectedProject(null)
                      setPhotos([])
                      setSearchQuery("")
                      setSearchResults([])
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "#016D75",
                      fontFamily: "var(--font-sans)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Change project
                  </button>
                </div>
              )}

              {isLoadingPhotos ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--arco-mid-grey)", fontSize: 13 }}>
                  <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
                  Loading photos...
                </div>
              ) : photos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--arco-mid-grey)", fontSize: 13 }}>
                  No photos available
                </div>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 8,
                }}>
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => handleSelectPhoto(photo.url)}
                      disabled={isPending}
                      style={{
                        position: "relative",
                        border: "2px solid transparent",
                        borderRadius: 6,
                        overflow: "hidden",
                        cursor: "pointer",
                        padding: 0,
                        background: "none",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#016D75")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                    >
                      <img
                        src={photo.url}
                        alt=""
                        style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", display: "block" }}
                      />
                      {photo.is_primary && (
                        <span style={{
                          position: "absolute",
                          top: 4,
                          left: 4,
                          fontSize: 9,
                          fontWeight: 600,
                          color: "white",
                          background: "rgba(0,0,0,0.5)",
                          padding: "1px 6px",
                          borderRadius: 3,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}>
                          Cover
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
