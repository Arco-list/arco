"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, X } from "lucide-react"
import { LinkInputRow } from "@/components/landing"
import { scrapeAndCreateProject } from "@/app/new-project/import/actions"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { toast } from "sonner"

type StepStatus = "pending" | "active" | "done" | "error"
type ModalPhase = "input" | "processing" | "done" | "error"

const STEPS = [
  "Fetching page",
  "Extracting content",
  "Creating your project",
]

const STEP_DELAYS_MS = [0, 1200, 2800]

interface ImportProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string | null
  companyId: string | null
  professionalId: string | null
  /** When provided, skip the input phase and auto-start scraping */
  initialUrl?: string
  /** Custom callback on successful import — overrides default redirect to edit page */
  onSuccess?: (projectId: string) => void
  /** Admin mode: skip domain verification and use this company ID for the project */
  adminCompanyId?: string | null
}

export function ImportProjectModal({
  open,
  onOpenChange,
  userId,
  companyId,
  professionalId,
  initialUrl,
  onSuccess,
  adminCompanyId,
}: ImportProjectModalProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<ModalPhase>("input")
  const [statuses, setStatuses] = useState<StepStatus[]>(["pending", "pending", "pending"])
  const [error, setError] = useState<string | null>(null)
  const [scrapeUrl, setScrapeUrl] = useState<string | null>(null)
  const [isCreatingBlank, setIsCreatingBlank] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const supabase = getBrowserSupabaseClient()

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setPhase("input")
        setStatuses(["pending", "pending", "pending"])
        setError(null)
        setScrapeUrl(null)
      }, 200)
      return () => clearTimeout(t)
    }
  }, [open])

  // Run scraping when URL is submitted
  useEffect(() => {
    if (!scrapeUrl || phase !== "processing") return

    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    setStatuses(["active", "pending", "pending"])

    timersRef.current.push(
      setTimeout(() => setStatuses(["done", "active", "pending"]), STEP_DELAYS_MS[1])
    )
    timersRef.current.push(
      setTimeout(() => setStatuses(["done", "done", "active"]), STEP_DELAYS_MS[2])
    )

    scrapeAndCreateProject(scrapeUrl, adminCompanyId ?? undefined).then((result) => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []

      if ("error" in result) {
        setStatuses(["error", "pending", "pending"])
        setError(result.error)
        setPhase("error")
      } else if ((result as any).duplicate) {
        // Project already exists — redirect to it
        setStatuses(["done", "done", "done"])
        setPhase("done")
        toast.info("This project was already imported.")
        setTimeout(() => {
          onOpenChange(false)
          router.push(`/dashboard/edit/${result.projectId}`)
        }, 600)
      } else {
        setStatuses(["done", "done", "done"])
        setPhase("done")
        setTimeout(() => {
          onOpenChange(false)
          if (onSuccess) {
            onSuccess(result.projectId)
          } else {
            router.push(`/dashboard/edit/${result.projectId}`)
          }
        }, 600)
      }
    })

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [scrapeUrl, phase, router, onOpenChange])

  const handleSubmitUrl = useCallback(async (url: string) => {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`)
    } catch {
      setError("Please enter a valid URL")
      setPhase("error")
      return
    }

    const inputDomain = parsedUrl.hostname.replace(/^www\./, "").toLowerCase()

    // Domain verification check (skip for admin)
    if (companyId && !adminCompanyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("domain, website, is_verified")
        .eq("id", companyId)
        .maybeSingle()

      const companyDomain = (company?.domain ?? company?.website ?? "")
        .replace(/^https?:\/\//i, "").split("/")[0].replace(/^www\./, "").toLowerCase()

      if (!companyDomain) {
        setError("Add your website domain in company settings before importing projects.")
        setPhase("error")
        return
      }

      if (companyDomain && inputDomain !== companyDomain && !inputDomain.endsWith(`.${companyDomain}`) && !companyDomain.endsWith(`.${inputDomain}`)) {
        setError(`This URL doesn't match your company domain (${companyDomain}). Import a project from your own website.`)
        setPhase("error")
        return
      }
    }

    // Duplicate check — look for existing project with same source URL
    const normalizedUrl = parsedUrl.toString().replace(/\/+$/, "").toLowerCase()
    const { data: existingProject } = await supabase
      .from("projects")
      .select("id")
      .eq("source_url", normalizedUrl)
      .maybeSingle()

    if (existingProject) {
      toast.info("This project was already imported.")
      onOpenChange(false)
      router.push(`/dashboard/edit/${existingProject.id}`)
      return
    }

    setScrapeUrl(url)
    setPhase("processing")
  }, [companyId, adminCompanyId, supabase, onOpenChange, router])

  // Auto-start when initialUrl is provided and modal opens
  const initialUrlTriggered = useRef(false)
  useEffect(() => {
    if (open && initialUrl && !initialUrlTriggered.current) {
      initialUrlTriggered.current = true
      handleSubmitUrl(initialUrl)
    }
    if (!open) {
      initialUrlTriggered.current = false
    }
  }, [open, initialUrl, handleSubmitUrl])

  const handleTryAgain = useCallback(() => {
    setPhase("input")
    setStatuses(["pending", "pending", "pending"])
    setError(null)
    setScrapeUrl(null)
  }, [])

  const handleCreateBlankProject = useCallback(async () => {
    if (!userId || !companyId || !professionalId) {
      toast.error("Please sign in to create a project.")
      return
    }

    setIsCreatingBlank(true)
    try {
      const slug = `untitled-project-${Date.now()}`
      const { data: project, error } = await supabase
        .from("projects")
        .insert({ title: "Untitled Project", client_id: userId, status: "draft" as const, slug })
        .select("id")
        .single()

      if (error || !project) throw error

      // Get user email for invited_email field
      const { data: { user: authUser } } = await supabase.auth.getUser()

      await supabase.from("project_professionals").insert({
        project_id: project.id,
        professional_id: professionalId,
        company_id: companyId,
        is_project_owner: true,
        status: "live_on_page",
        invited_email: authUser?.email ?? "",
      })

      onOpenChange(false)
      router.push(`/dashboard/edit/${project.id}`)
    } catch (err) {
      console.error("Failed to create project", err)
      toast.error("Failed to create project. Please try again.")
    } finally {
      setIsCreatingBlank(false)
    }
  }, [userId, companyId, professionalId, supabase, onOpenChange, router])

  const displayUrl = scrapeUrl && scrapeUrl.length > 60 ? scrapeUrl.slice(0, 57) + "…" : scrapeUrl

  const isProcessing = phase === "processing"
  const canClose = phase === "input" || phase === "error" || phase === "done"

  if (!open) return null

  return (
    <div
      className="popup-overlay"
      onClick={() => { if (canClose) onOpenChange(false) }}
    >
      <div
        className="popup-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        {/* Header */}
        <div className="popup-header">
          <h3 className="arco-section-title">
            {phase === "done"
              ? "Your project is ready"
              : phase === "error"
                ? "Import failed"
                : phase === "processing"
                  ? "Importing project…"
                  : "Import from your website"}
          </h3>
          {canClose && (
            <button
              type="button"
              className="popup-close"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        <p className="arco-body-text" style={{ marginBottom: 24 }}>
          {phase === "done"
            ? "Redirecting to your project…"
            : phase === "error"
              ? "Something went wrong while importing your project."
              : phase === "processing"
                ? "This usually takes about 10 seconds."
                : "Paste a link to a project page on your company website. We'll extract the title, photos, and details automatically."}
        </p>

        {/* Body */}
        <div>
          {/* Input phase */}
          {phase === "input" && (
            <>
              <LinkInputRow
                placeholder="https://yourstudio.com/projects/villa-laren"
                buttonLabel="Import →"
                onSubmit={handleSubmitUrl}
              />
              <div className="import-popup-manual">
                <span>
                  No website?{" "}
                  <button
                    onClick={handleCreateBlankProject}
                    disabled={isCreatingBlank}
                    className="import-popup-manual-link"
                  >
                    {isCreatingBlank ? "Creating…" : "Fill in manually"}
                  </button>
                </span>
              </div>
            </>
          )}

          {/* Processing / Done / Error phases */}
          {phase !== "input" && (
            <>
              {/* URL pill */}
              {displayUrl && (
                <div className="scrape-url-pill" style={{ marginBottom: 20 }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6.5 9.5l3-3" /><path d="M9 10.5l1.5-1.5a2.83 2.83 0 0 0-4-4L5 6.5" /><path d="M7 5.5L5.5 7a2.83 2.83 0 0 0 4 4L11 9.5" />
                  </svg>
                  <span className="scrape-url-text">{displayUrl}</span>
                </div>
              )}

              {/* Steps — only show when scraping was actually started */}
              {scrapeUrl && <div className="scrape-steps">
                {STEPS.map((label, i) => {
                  const status = statuses[i]
                  return (
                    <div key={label} className="scrape-step">
                      <StepIcon status={status} />
                      <span className={`scrape-step-label scrape-step-label--${status}`}>
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>}

              {/* Progress bar */}
              {isProcessing && (
                <div className="scrape-progress-track" style={{ marginTop: 20 }}>
                  <div
                    className="scrape-progress-bar"
                    style={{
                      width:
                        statuses[2] === "active"
                          ? "85%"
                          : statuses[1] === "active"
                            ? "55%"
                            : "25%",
                    }}
                  />
                </div>
              )}

              {/* Error message */}
              {phase === "error" && error && (
                <div className="popup-banner popup-banner--danger" style={{ marginTop: 20 }}>
                  <AlertTriangle className="popup-banner-icon" />
                  <span>{error}</span>
                </div>
              )}

              {/* Error actions */}
              {phase === "error" && (
                <div className="popup-actions" style={{ marginTop: 20 }}>
                  <button type="button" className="btn-tertiary" onClick={handleTryAgain} style={{ flex: 1, justifyContent: "center" }}>
                    Try another URL
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCreateBlankProject}
                    disabled={isCreatingBlank}
                    style={{ flex: 1 }}
                  >
                    {isCreatingBlank ? "Creating…" : "Fill in manually"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="scrape-step-icon scrape-step-icon--done">
        <Check size={10} color="white" strokeWidth={2.5} />
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="scrape-step-icon scrape-step-icon--error">
        <X size={10} color="white" strokeWidth={2.5} />
      </span>
    )
  }
  if (status === "active") {
    return <span className="scrape-step-icon scrape-step-icon--active" />
  }
  return <span className="scrape-step-icon scrape-step-icon--pending" />
}
