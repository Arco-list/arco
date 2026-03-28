"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Check, CheckCircle2, ChevronRight, Plus, X } from "lucide-react"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { useAuth } from "@/contexts/auth-context"
import { regenerateDescription } from "@/app/new-project/import/actions"

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftProject {
  id: string
  title: string
  description: string | null
  building_year: number | null
  location: string | null
  slug: string | null
  status: string | null
  client_id: string
}

interface ProjectPhoto {
  id: string
  url: string
  is_primary: boolean | null
  order_index: number | null
}

interface Professional {
  tempId: string
  id?: string
  service: string
  companyName: string
  email: string
}

type SaveStatus = "idle" | "saving" | "saved"

// ─── Constants ────────────────────────────────────────────────────────────────

const FLOW_STEPS = [
  { label: "Upload",        status: "done"    },
  { label: "Review & Edit", status: "active"  },
  { label: "Verify domain", status: "pending" },
  { label: "Submit",        status: "pending" },
] as const

const SERVICE_OPTIONS = [
  "Architect", "Interior Design", "Builder / Contractor",
  "Landscape Architect", "Structural Engineer", "Photographer",
  "Lighting Design", "Swimming Pool", "Other",
]
const TYPE_OPTIONS    = ["Villa", "Apartment", "House", "Extension", "Office", "Retail", "Cultural", "Hospitality", "Multi-residential"]
const SCOPE_OPTIONS   = ["New Build", "Renovation", "Interior Design", "Extension", "Restoration", "Conversion"]
const STYLE_OPTIONS   = ["Contemporary", "Minimalist", "Traditional", "Industrial", "Scandinavian", "Mediterranean", "Japanese", "Brutalist", "Art Deco"]

// ─── Pencil SVG ───────────────────────────────────────────────────────────────

function PencilSVG({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: "inline-block", flexShrink: 0 }}>
      <path d="M11.5 1.5l3 3L5 14H2v-3z" />
    </svg>
  )
}

// ─── Top bar ─────────────────────────────────────────────────────────────────

function ImportTopBar({ saveStatus, onPublish, publishing }: {
  saveStatus: SaveStatus
  onPublish: () => void
  publishing: boolean
}) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 500,
      height: 60, background: "rgba(255,255,255,.94)", backdropFilter: "blur(16px)",
      borderBottom: "1px solid #e8e8e6",
      display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
      padding: "0 28px",
    }}>
      <Link href="/" style={{ display: "flex", alignItems: "center" }}>
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
          alt="Arco"
          style={{ height: "auto", width: 52, filter: "brightness(0)" }}
        />
      </Link>

      <div style={{ display: "flex", alignItems: "center" }}>
        {FLOW_STEPS.map((step, i) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "0 10px",
              fontSize: 12,
              color: step.status === "done" ? "#016D75" : step.status === "active" ? "#1c1c1a" : "#a1a1a0",
            }}>
              <span style={{
                width: step.status === "active" ? 20 : 16, height: 16,
                borderRadius: step.status === "active" ? 3 : "50%",
                background: step.status === "done" ? "#016D75" : step.status === "active" ? "#1c1c1a" : "#e8e8e6",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {step.status === "done" && <Check size={8} color="white" strokeWidth={2.5} />}
              </span>
              <span style={{ fontWeight: step.status === "active" ? 500 : 400, whiteSpace: "nowrap" }}>
                {step.label}
              </span>
            </div>
            {i < FLOW_STEPS.length - 1 && (
              <ChevronRight size={10} style={{ color: "#e8e8e6", flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
        {saveStatus !== "idle" && (
          <span style={{ fontSize: 12, color: saveStatus === "saved" ? "#016D75" : "#a1a1a0" }}>
            {saveStatus === "saving" ? "Saving…" : "✓ Saved"}
          </span>
        )}
        <button
          onClick={onPublish}
          disabled={publishing}
          style={{
            padding: "7px 18px", fontSize: 13, fontWeight: 500,
            background: "#1c1c1a", color: "white", border: "none", borderRadius: 4,
            cursor: publishing ? "default" : "pointer",
            opacity: publishing ? 0.65 : 1, transition: "opacity .15s",
          }}
        >
          {publishing ? "Submitting…" : "Submit →"}
        </button>
      </div>
    </div>
  )
}

// ─── Professional card ────────────────────────────────────────────────────────

function ProCard({ pro, editing, onActivate, onChange, onSave, onDelete }: {
  pro: Professional
  editing: boolean
  onActivate: () => void
  onChange: (patch: Partial<Professional>) => void
  onSave: () => void
  onDelete: () => void
}) {
  const [svcOpen, setSvcOpen] = useState(false)

  const initials = pro.companyName
    ? pro.companyName.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()
    : pro.service.slice(0, 2).toUpperCase()

  return (
    <div
      data-pro-card=""
      className={`credit-card-edit${editing ? " editing" : ""}`}
      onClick={() => !editing && onActivate()}
    >
      {/* Edit badge — always visible, dims */}
      <span className="ec-badge">
        <span className="ec-ico"><PencilSVG /></span>
        <span className="ec-txt">Edit</span>
      </span>

      {/* Delete (hover only, not while editing) */}
      {!editing && (
        <button className="card-del" onClick={e => { e.stopPropagation(); onDelete() }} aria-label="Remove">
          <X size={9} />
        </button>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>

        {/* Service type */}
        <div style={{ position: "relative", marginBottom: 12, height: 17, display: "flex", alignItems: "center" }}>
          {editing ? (
            <>
              <button
                onClick={e => { e.stopPropagation(); setSvcOpen(v => !v) }}
                style={{
                  fontSize: 11, fontWeight: 500, letterSpacing: ".12em", textTransform: "uppercase",
                  color: "#b0b0ae", background: "none", border: "none", cursor: "pointer",
                  borderBottom: "1px solid #e8e8e6", paddingBottom: 1, fontFamily: "inherit",
                }}
              >
                {pro.service} ▾
              </button>
              {svcOpen && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 10 }}
                    onClick={e => { e.stopPropagation(); setSvcOpen(false) }}
                  />
                  <div className="dd-panel" style={{ zIndex: 11, top: "calc(100% + 6px)" }}>
                    {SERVICE_OPTIONS.map(opt => (
                      <div
                        key={opt}
                        className={`dd-row${opt === pro.service ? " sel" : ""}`}
                        onClick={e => { e.stopPropagation(); onChange({ service: opt }); setSvcOpen(false) }}
                      >
                        <span>{opt}</span>
                        {opt === pro.service && <span className="dd-check">✓</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".12em", textTransform: "uppercase", color: "#b0b0ae" }}>
              {pro.service}
            </span>
          )}
        </div>

        {/* Avatar */}
        <div className="credit-icon">
          <span className="credit-icon-initials">{initials || "+"}</span>
        </div>

        {/* Company name */}
        {editing ? (
          <input
            type="text"
            value={pro.companyName}
            onChange={e => onChange({ companyName: e.target.value })}
            onClick={e => e.stopPropagation()}
            placeholder="Company name"
            autoFocus
            style={{
              width: "100%", textAlign: "center", marginTop: 10,
              fontSize: 15, fontWeight: 500, color: "#1c1c1a",
              background: "transparent", border: "none", borderBottom: "1px solid #e8e8e6",
              outline: "none", padding: "0 0 2px", fontFamily: "inherit",
            }}
          />
        ) : (
          <h3 style={{
            fontSize: 15, fontWeight: 500, lineHeight: 1.3, marginTop: 10,
            color: pro.companyName ? "#1c1c1a" : "#b0b0ae",
          }}>
            {pro.companyName || "Company name"}
          </h3>
        )}

        {/* Email */}
        {editing ? (
          <input
            type="email"
            value={pro.email}
            onChange={e => onChange({ email: e.target.value })}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.key === "Enter" && onSave()}
            placeholder="email@company.com"
            style={{
              width: "100%", textAlign: "center", marginTop: 8,
              fontSize: 13, fontWeight: 300, color: "#5c5c5a",
              background: "transparent", border: "none", borderBottom: "1px solid #e8e8e6",
              outline: "none", padding: "2px 0", fontFamily: "inherit",
            }}
          />
        ) : (
          <p style={{ fontSize: 13, fontWeight: 300, color: "#b0b0ae", marginTop: 4 }}>
            {pro.email || "No email yet"}
          </p>
        )}

        {editing && (
          <button
            onClick={e => { e.stopPropagation(); onSave() }}
            style={{
              marginTop: 16, padding: "6px 20px", fontSize: 12, fontWeight: 500,
              background: "#1c1c1a", color: "white", border: "none",
              borderRadius: 4, cursor: "pointer",
            }}
          >
            Done
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Spec dropdown ────────────────────────────────────────────────────────────

function SpecSelect({ value, options, onChange, onClose }: {
  value: string
  options: string[]
  onChange: (val: string) => void
  onClose: () => void
}) {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={onClose} />
      <div className="dd-panel" style={{ zIndex: 11, top: "calc(100% + 4px)" }}>
        {options.map(opt => (
          <div
            key={opt}
            className={`dd-row${opt === value ? " sel" : ""}`}
            onClick={e => { e.stopPropagation(); onChange(opt); onClose() }}
          >
            <span>{opt}</span>
            {opt === value && <span className="dd-check">✓</span>}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImportReviewPage() {
  const params  = useParams()
  const router  = useRouter()
  const { user } = useAuth()
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const projectId = typeof params?.id === "string" ? params.id : ""

  const [project, setProject]       = useState<DraftProject | null>(null)
  const [loading, setLoading]       = useState(true)

  // Text fields
  const [title, setTitle]           = useState("")
  const [description, setDescription] = useState("")
  const [year, setYear]             = useState("")
  const [location, setLocation]     = useState("")
  const [specType, setSpecType]     = useState("")
  const [specScope, setSpecScope]   = useState("")
  const [specStyle, setSpecStyle]   = useState("")

  // UI state
  const [activeField, setActiveField] = useState<"title" | "desc" | null>(null)
  const [editingSpec, setEditingSpec] = useState<string | null>(null)

  // Photos
  const [photos, setPhotos] = useState<ProjectPhoto[]>([])

  // Professionals
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [editingProId, setEditingProId]   = useState<string | null>(null)

  // Regenerate description
  const [isRegenerating, setIsRegenerating] = useState(false)

  // Save / publish
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished]   = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const titleRef     = useRef<HTMLHeadingElement>(null)
  const descRef      = useRef<HTMLParagraphElement>(null)

  // ── Load project ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId || !user) return
    const load = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, building_year, location, slug, status, client_id")
        .eq("id", projectId)
        .single()

      if (error || !data) { router.replace("/dashboard/listings"); return }
      if (data.client_id !== user.id) { router.replace("/dashboard/listings"); return }

      setProject(data as DraftProject)
      setTitle(data.title ?? "")
      setDescription(data.description ?? "")
      setYear(data.building_year ? String(data.building_year) : "")
      setLocation(data.location ?? "")
      setLoading(false)
    }
    void load()
  }, [projectId, user, supabase, router])

  // ── Load professionals ────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId || !user) return
    const load = async () => {
      const { data } = await supabase
        .from("project_professionals")
        .select("id, email, service_category, company_name")
        .eq("project_id", projectId)
      if (data && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProfessionals((data as any[]).map(p => ({
          tempId: p.id, id: p.id,
          service: p.service_category ?? "Architect",
          companyName: p.company_name ?? "",
          email: p.email ?? "",
        })))
      }
    }
    void load()
  }, [projectId, user, supabase])

  // ── Load photos ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId || !user) return
    const load = async () => {
      const { data } = await supabase
        .from("project_photos")
        .select("id, url, is_primary, order_index")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true })
      if (data && data.length > 0) setPhotos(data as ProjectPhoto[])
    }
    void load()
  }, [projectId, user, supabase])

  // ── Click outside to close pro card editing ───────────────────────────────

  useEffect(() => {
    if (!editingProId) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-pro-card]")) setEditingProId(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [editingProId])

  // ── Save helper ───────────────────────────────────────────────────────────

  const save = useCallback(async (patch: Record<string, unknown>) => {
    if (!projectId || Object.keys(patch).length === 0) return
    setSaveStatus("saving")
    await supabase.from("projects").update(patch).eq("id", projectId)
    setSaveStatus("saved")
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000)
  }, [projectId, supabase])

  const flashSaved = useCallback(() => {
    setSaveStatus("saved")
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000)
  }, [])

  // ── Field handlers ────────────────────────────────────────────────────────

  const handleTitleBlur = () => {
    const val = titleRef.current?.textContent?.trim() ?? ""
    setActiveField(null)
    if (val && val !== title) { setTitle(val); void save({ title: val }) }
  }

  const handleDescBlur = () => {
    const val = descRef.current?.textContent?.trim() ?? ""
    setActiveField(null)
    if (val !== description) { setDescription(val); void save({ description: val || null }) }
  }

  const handleRegenerate = async () => {
    if (isRegenerating) return
    // Save any pending description edits first
    const currentDesc = descRef.current?.textContent?.trim() ?? description
    if (currentDesc !== description) {
      setDescription(currentDesc)
      await save({ description: currentDesc || null })
    }
    setIsRegenerating(true)
    const result = await regenerateDescription(projectId)
    setIsRegenerating(false)
    if ("description" in result) {
      setDescription(result.description)
      if (descRef.current) descRef.current.textContent = result.description
      flashSaved()
    }
  }

  const saveYear = (v: string) => {
    setEditingSpec(null)
    const parsed = parseInt(v, 10)
    const valid = !isNaN(parsed) && parsed >= 1800 && parsed <= new Date().getFullYear()
    void save({ building_year: valid ? parsed : null })
  }

  const saveLocation = (v: string) => {
    setEditingSpec(null)
    void save({ location: v || null })
  }

  // ── Professional handlers ─────────────────────────────────────────────────

  const addProfessional = () => {
    const tempId = Math.random().toString(36).slice(2)
    setProfessionals(prev => [...prev, { tempId, service: "Architect", companyName: "", email: "" }])
    setEditingProId(tempId)
  }

  const updateProfessional = (tempId: string, patch: Partial<Professional>) => {
    setProfessionals(prev => prev.map(p => p.tempId === tempId ? { ...p, ...patch } : p))
  }

  const saveProfessional = async (tempId: string) => {
    const pro = professionals.find(p => p.tempId === tempId)
    if (!pro) return
    setEditingProId(null)

    if (!pro.email && !pro.companyName) {
      setProfessionals(prev => prev.filter(p => p.tempId !== tempId))
      return
    }

    if (pro.id) {
      await supabase
        .from("project_professionals")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ service_category: pro.service, company_name: pro.companyName } as any)
        .eq("id", pro.id)
    } else {
      const { data } = await supabase
        .from("project_professionals")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({ project_id: projectId, email: pro.email, service_category: pro.service, company_name: pro.companyName } as any)
        .select("id")
        .single()
      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProfessionals(prev => prev.map(p => p.tempId === tempId ? { ...p, id: (data as any).id } : p))
      }
    }
    flashSaved()
  }

  const deleteProfessional = async (pro: Professional) => {
    setProfessionals(prev => prev.filter(p => p.tempId !== pro.tempId))
    if (pro.id) await supabase.from("project_professionals").delete().eq("id", pro.id)
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (publishing) return
    setPublishing(true)
    const t = titleRef.current?.textContent?.trim() ?? title
    const d = descRef.current?.textContent?.trim() ?? description
    await supabase
      .from("projects")
      .update({ title: t, description: d || null, status: "in_progress" })
      .eq("id", projectId)
    setPublished(true)
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <ImportTopBar saveStatus="idle" onPublish={() => {}} publishing={false} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 60px)", paddingTop: 60 }}>
          <span className="arco-eyebrow">Loading your project…</span>
        </div>
      </div>
    )
  }

  // ── Published success screen ──────────────────────────────────────────────

  if (published) {
    return (
      <div className="min-h-screen bg-white">
        <ImportTopBar saveStatus="idle" onPublish={() => {}} publishing={false} />
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "calc(100vh - 60px)", paddingTop: 60, paddingLeft: 24, paddingRight: 24, textAlign: "center",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(10,124,78,.08)", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#0a7c4e", marginBottom: 28,
          }}>
            <CheckCircle2 size={32} />
          </div>
          <h1 className="arco-section-title" style={{ marginBottom: 12 }}>Project submitted</h1>
          <p className="arco-body-text" style={{ maxWidth: 420, marginBottom: 36 }}>
            Your project has been submitted for review. We&apos;ll let you know once it&apos;s published.
            In the meantime, add photos to make it stand out.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Link href={`/new-project/photos?projectId=${projectId}`} className="btn-primary" style={{ borderRadius: 5, textDecoration: "none" }}>
              Add photos →
            </Link>
            <Link href="/dashboard/listings" style={{
              padding: "10px 24px", borderRadius: 5, border: "1px solid #e5e5e4",
              fontSize: 14, color: "#1c1c1a", textDecoration: "none", display: "inline-flex", alignItems: "center",
            }}>
              View dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Edit screen ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        /* ── Edit container (.ec) ── */
        .ec {
          position: relative;
          cursor: pointer;
        }
        .ec::before {
          content: '';
          position: absolute;
          inset: -10px -14px;
          border: 1px solid transparent;
          border-radius: 5px;
          transition: border-color .18s;
          pointer-events: none;
          z-index: 0;
        }
        .ec:hover::before { border-color: #1c1c1a; }
        .ec.on::before    { border-color: #016D75; }
        .ec.on            { cursor: default; }

        /* Edit badge — always visible, dims until hover/active */
        .ec-badge {
          position: absolute;
          top: -19px;
          left: -8px;
          display: flex;
          align-items: center;
          gap: 4px;
          background: #fff;
          padding: 0 4px;
          pointer-events: none;
          z-index: 1;
        }
        .ec-ico { display: flex; align-items: center; color: #c8c8c6; transition: color .18s; }
        .ec-txt {
          font-size: 10px; font-weight: 400; letter-spacing: .04em;
          text-transform: uppercase; color: #c8c8c6;
          white-space: nowrap; transition: color .15s;
        }
        .ec:hover .ec-ico, .ec:hover .ec-txt { color: #1c1c1a; }
        .ec.on    .ec-ico, .ec.on    .ec-txt { color: #016D75; }

        /* Spec item edit affordance */
        .spec-item-edit {
          flex: 1;
          padding: 22px 20px 18px;
          text-align: center;
          position: relative;
          cursor: pointer;
          transition: background .15s;
        }
        .spec-item-edit::before {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid transparent;
          pointer-events: none;
          transition: border-color .18s;
        }
        .spec-item-edit:hover::before   { border-color: #1c1c1a; }
        .spec-item-edit.editing::before { border-color: #016D75; }
        .spec-item-edit .ec-badge {
          top: -9px; left: 50%; transform: translateX(-50%);
          padding: 0 6px;
        }
        .spec-item-edit:hover   .ec-ico, .spec-item-edit:hover   .ec-txt { color: #1c1c1a; }
        .spec-item-edit.editing .ec-ico, .spec-item-edit.editing .ec-txt { color: #016D75; }
        .spec-item-edit.editing .spec-eyebrow { color: #016D75; }

        /* Professional cards */
        .credit-card-edit {
          position: relative;
          border-radius: 6px;
          padding: 28px 20px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          cursor: pointer;
          border: 1px solid transparent;
          transition: border-color .18s, box-shadow .18s;
          background: #fff;
        }
        .credit-card-edit:hover           { border-color: #1c1c1a; box-shadow: 0 0 0 3px rgba(0,0,0,.03); }
        .credit-card-edit.editing         { border-color: #016D75; box-shadow: 0 0 0 3px rgba(1,109,117,.08); cursor: default; }
        .credit-card-edit .ec-badge       { top: -9px; left: 14px; padding: 0 6px; }
        .credit-card-edit:hover   .ec-ico, .credit-card-edit:hover   .ec-txt { color: #1c1c1a; }
        .credit-card-edit.editing .ec-ico, .credit-card-edit.editing .ec-txt { color: #016D75; }

        /* Delete button on card (hover only, not editing) */
        .card-del {
          position: absolute; top: 10px; right: 10px;
          width: 26px; height: 26px; border-radius: 50%;
          background: #e8e8e6; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #5c5c5a; opacity: 0; transition: all .15s;
        }
        .credit-card-edit:hover:not(.editing) .card-del { opacity: 1; }
        .card-del:hover { background: #fde8e8; color: #e03232; }

        /* Avatar */
        .credit-icon {
          width: 64px; height: 64px; border-radius: 50%;
          background: #e8e8e6;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 4px; flex-shrink: 0;
        }
        .credit-icon-initials {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 22px; font-weight: 300; color: #6b6b68;
          letter-spacing: .03em;
        }

        /* Add professional card */
        .add-pro-card {
          border-radius: 6px;
          border: 1.5px dashed #016D75;
          background: transparent;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 12px;
          cursor: pointer;
          padding: 28px 20px 24px;
          position: relative;
          transition: box-shadow .2s;
          min-height: 230px;
        }
        .add-pro-card:hover { box-shadow: 0 0 0 3px rgba(1,109,117,.08); }
        .add-pro-badge {
          position: absolute; top: -9px; left: 14px;
          font-size: 10px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase;
          color: #016D75; background: #fff; padding: 0 8px;
          display: flex; align-items: center; gap: 5px;
        }
        .add-pro-icon {
          width: 52px; height: 52px; border-radius: 50%;
          border: 1.5px solid rgba(1,109,117,.3);
          display: flex; align-items: center; justify-content: center;
          color: #016D75; transition: all .2s;
        }
        .add-pro-card:hover .add-pro-icon { border-color: #016D75; transform: scale(1.06); }

        /* Dropdown panel */
        .dd-panel {
          position: absolute;
          left: 50%; transform: translateX(-50%);
          background: #fff; border: 1px solid #e8e8e6; border-radius: 7px;
          box-shadow: 0 12px 40px rgba(0,0,0,.12);
          overflow: hidden; min-width: 180px;
        }
        .dd-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 14px; cursor: pointer; transition: background .1s;
          font-size: 13px; font-weight: 300; color: #1c1c1a;
        }
        .dd-row:hover { background: #f5f5f3; }
        .dd-row.sel   { font-weight: 500; }
        .dd-check     { color: #016D75; font-size: 11px; }

        /* Spec inline input */
        .spec-inp {
          width: 100%; text-align: center;
          font-size: 15px; font-weight: 500; color: #1c1c1a;
          background: transparent; border: none;
          border-bottom: 1px solid rgba(1,109,117,.3);
          outline: none; padding: 0 0 2px;
          font-family: inherit;
        }

        [contenteditable]:focus { outline: none; }
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #b0b0ae;
          pointer-events: none;
        }
        .hero-add-photo-cta:hover { opacity: 0.8 !important; }
      `}</style>

      <ImportTopBar saveStatus={saveStatus} onPublish={handlePublish} publishing={publishing} />

      <div style={{ paddingTop: 60 }}>

        {/* ── Hero ─────────────────────────────────────────────── */}
        {(() => {
          const coverPhoto = photos.find(p => p.is_primary) ?? photos[0] ?? null
          return (
            <section style={{
              position: "relative", width: "100%", height: "82vh", minHeight: 560,
              overflow: "hidden", background: "#111",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {coverPhoto ? (
                <>
                  <img
                    src={coverPhoto.url}
                    alt="Cover photo"
                    style={{
                      position: "absolute", inset: 0, width: "100%", height: "100%",
                      objectFit: "cover", objectPosition: "center",
                    }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.18)" }} />
                  <Link
                    href={`/new-project/photos?projectId=${projectId}`}
                    className="hero-add-photo-cta"
                    style={{
                      position: "relative", zIndex: 1,
                      display: "flex", flexDirection: "column", alignItems: "center",
                      gap: 12, textDecoration: "none", opacity: 0.6, transition: "opacity .2s",
                    }}
                  >
                    <span style={{
                      width: 44, height: 44, borderRadius: "50%",
                      border: "1.5px solid rgba(255,255,255,.5)",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "white",
                    }}>
                      <Plus size={16} />
                    </span>
                    <span style={{ fontSize: 12, color: "white", letterSpacing: ".06em", textTransform: "uppercase" }}>
                      Manage photos
                    </span>
                  </Link>
                </>
              ) : (
                <Link
                  href={`/new-project/photos?projectId=${projectId}`}
                  className="hero-add-photo-cta"
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 12, textDecoration: "none", opacity: 0.5, transition: "opacity .2s",
                  }}
                >
                  <span style={{
                    width: 52, height: 52, borderRadius: "50%",
                    border: "1.5px solid rgba(255,255,255,.35)",
                    display: "flex", alignItems: "center", justifyContent: "center", color: "white",
                  }}>
                    <Plus size={20} />
                  </span>
                  <span style={{ fontSize: 13, color: "white", letterSpacing: ".06em", textTransform: "uppercase" }}>
                    Add cover photo
                  </span>
                </Link>
              )}
            </section>
          )
        })()}

        {/* ── Sub-nav ──────────────────────────────────────────── */}
        <div className="sub-nav" style={{ top: 60 }}>
          <div className="sub-nav-content wrap">
            <div className="sub-nav-left">
              <div className="sub-nav-links">
                <a href="#details"       className="sub-nav-link active">Details</a>
                <a href="#professionals" className="sub-nav-link">Professionals</a>
                <a href="#photos"        className="sub-nav-link">Photos</a>
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              {saveStatus !== "idle" && (
                <span style={{ fontSize: 12, color: saveStatus === "saved" ? "#016D75" : "#a1a1a0" }}>
                  {saveStatus === "saving" ? "Saving…" : "✓ All changes saved"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Project header (centered) ─────────────────────────── */}
        <section
          id="details"
          style={{
            maxWidth: 740, margin: "0 auto",
            padding: "80px 60px 72px", textAlign: "center",
            borderBottom: "1px solid #e8e8e6",
          }}
        >
          {/* Title */}
          <div
            className={`ec${activeField === "title" ? " on" : ""}`}
            style={{ display: "inline-block", width: "100%" }}
          >
            <span className="ec-badge">
              <span className="ec-ico"><PencilSVG /></span>
              <span className="ec-txt">Edit</span>
            </span>
            <h1
              ref={titleRef}
              className="arco-page-title"
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setActiveField("title")}
              onBlur={handleTitleBlur}
              style={{ cursor: "text" }}
              data-placeholder="Project title"
            >
              {title}
            </h1>
          </div>

          {user && (
            <p style={{ fontSize: 14, fontWeight: 300, color: "#5c5c5a", marginTop: 16 }}>
              by {user.email?.split("@")[0]}
            </p>
          )}

          {/* Description */}
          <div
            className={`ec${activeField === "desc" ? " on" : ""}`}
            style={{ marginTop: 28, display: "block" }}
          >
            <span className="ec-badge">
              <span className="ec-ico"><PencilSVG /></span>
              <span className="ec-txt">Edit</span>
            </span>
            <p
              ref={descRef}
              className="arco-body-text proj-desc"
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setActiveField("desc")}
              onBlur={handleDescBlur}
              style={{ cursor: "text", minHeight: "1.7em", textAlign: "center" }}
              data-placeholder="Add a description…"
            >
              {description || ""}
            </p>
          </div>

          {/* Regenerate button */}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 400, color: isRegenerating ? "#a1a1a0" : "#5c5c5a",
                background: "none", border: "1px solid #e8e8e6", borderRadius: 20,
                padding: "5px 14px", cursor: isRegenerating ? "default" : "pointer",
                transition: "border-color .15s, color .15s",
              }}
              onMouseEnter={e => { if (!isRegenerating) { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1c1c1a"; (e.currentTarget as HTMLButtonElement).style.color = "#1c1c1a" } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e8e8e6"; (e.currentTarget as HTMLButtonElement).style.color = isRegenerating ? "#a1a1a0" : "#5c5c5a" }}
            >
              {isRegenerating ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                  Regenerate description
                </>
              )}
            </button>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </section>

        {/* ── Specs bar ─────────────────────────────────────────── */}
        <section style={{ display: "flex", borderBottom: "1px solid #e8e8e6", margin: "0 0 80px" }}>

          {/* Location */}
          <div
            className={`spec-item-edit${editingSpec === "location" ? " editing" : ""}`}
            onClick={() => editingSpec !== "location" && setEditingSpec("location")}
          >
            <span className="ec-badge">
              <span className="ec-ico"><PencilSVG size={9} /></span>
              <span className="ec-txt">Edit</span>
            </span>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Location</span>
            {editingSpec === "location" ? (
              <input
                autoFocus
                className="spec-inp"
                value={location}
                onChange={e => setLocation(e.target.value)}
                onBlur={() => saveLocation(location)}
                onKeyDown={e => e.key === "Enter" && saveLocation(location)}
                placeholder="City, Country"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <div className="arco-card-title" style={{ color: location ? undefined : "#b0b0ae" }}>
                {location || "Add location"}
              </div>
            )}
          </div>

          {/* Year */}
          <div
            className={`spec-item-edit${editingSpec === "year" ? " editing" : ""}`}
            onClick={() => editingSpec !== "year" && setEditingSpec("year")}
          >
            <span className="ec-badge">
              <span className="ec-ico"><PencilSVG size={9} /></span>
              <span className="ec-txt">Edit</span>
            </span>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Year</span>
            {editingSpec === "year" ? (
              <input
                autoFocus
                className="spec-inp"
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                onBlur={() => saveYear(year)}
                onKeyDown={e => e.key === "Enter" && saveYear(year)}
                placeholder={String(new Date().getFullYear())}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <div className="arco-card-title" style={{ color: year ? undefined : "#b0b0ae" }}>
                {year || "Add year"}
              </div>
            )}
          </div>

          {/* Type */}
          <div
            className={`spec-item-edit${editingSpec === "type" ? " editing" : ""}`}
            style={{ position: "relative" }}
            onClick={() => editingSpec !== "type" && setEditingSpec("type")}
          >
            <span className="ec-badge">
              <span className="ec-ico"><PencilSVG size={9} /></span>
              <span className="ec-txt">Edit</span>
            </span>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Type</span>
            <div className="arco-card-title" style={{ color: specType ? undefined : "#b0b0ae" }}>
              {specType || "Select type"}
            </div>
            {editingSpec === "type" && (
              <SpecSelect value={specType} options={TYPE_OPTIONS} onChange={setSpecType} onClose={() => setEditingSpec(null)} />
            )}
          </div>

          {/* Scope */}
          <div
            className={`spec-item-edit${editingSpec === "scope" ? " editing" : ""}`}
            style={{ position: "relative" }}
            onClick={() => editingSpec !== "scope" && setEditingSpec("scope")}
          >
            <span className="ec-badge">
              <span className="ec-ico"><PencilSVG size={9} /></span>
              <span className="ec-txt">Edit</span>
            </span>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Scope</span>
            <div className="arco-card-title" style={{ color: specScope ? undefined : "#b0b0ae" }}>
              {specScope || "Select scope"}
            </div>
            {editingSpec === "scope" && (
              <SpecSelect value={specScope} options={SCOPE_OPTIONS} onChange={setSpecScope} onClose={() => setEditingSpec(null)} />
            )}
          </div>

          {/* Style */}
          <div
            className={`spec-item-edit${editingSpec === "style" ? " editing" : ""}`}
            style={{ position: "relative" }}
            onClick={() => editingSpec !== "style" && setEditingSpec("style")}
          >
            <span className="ec-badge">
              <span className="ec-ico"><PencilSVG size={9} /></span>
              <span className="ec-txt">Edit</span>
            </span>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Style</span>
            <div className="arco-card-title" style={{ color: specStyle ? undefined : "#b0b0ae" }}>
              {specStyle || "Select style"}
            </div>
            {editingSpec === "style" && (
              <SpecSelect value={specStyle} options={STYLE_OPTIONS} onChange={setSpecStyle} onClose={() => setEditingSpec(null)} />
            )}
          </div>

        </section>

        {/* ── Professionals ─────────────────────────────────────── */}
        <section id="professionals" className="wrap" style={{ marginBottom: 80 }}>
          <div style={{ marginBottom: 40 }}>
            <h2 className="arco-section-title">Credited professionals</h2>
            <p className="arco-body-text" style={{ marginTop: 6, maxWidth: 600 }}>
              The trusted team behind this project. Click a card to edit.
            </p>
          </div>

          <div className="credits-grid">
            {professionals.map(pro => (
              <ProCard
                key={pro.tempId}
                pro={pro}
                editing={editingProId === pro.tempId}
                onActivate={() => setEditingProId(pro.tempId)}
                onChange={patch => updateProfessional(pro.tempId, patch)}
                onSave={() => saveProfessional(pro.tempId)}
                onDelete={() => deleteProfessional(pro)}
              />
            ))}

            {/* Add professional card */}
            <div className="add-pro-card" onClick={addProfessional}>
              <span className="add-pro-badge">
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 2v12M2 8h12" />
                </svg>
                Add Professional
              </span>
              <div className="add-pro-icon">
                <Plus size={22} color="#016D75" />
              </div>
              <span style={{ fontSize: 13, color: "#016D75" }}>Click to add</span>
            </div>
          </div>
        </section>

        {/* ── Photos ────────────────────────────────────────────── */}
        <section id="photos" className="wrap" style={{ marginBottom: 100 }}>
          <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <h2 className="arco-section-title">Photo tour</h2>
              <p className="arco-body-text" style={{ marginTop: 6 }}>
                {photos.length > 0
                  ? `${photos.length} photo${photos.length !== 1 ? "s" : ""} imported from your website.`
                  : "Add photos to bring your project to life."}
              </p>
            </div>
            {photos.length > 0 && (
              <Link
                href={`/new-project/photos?projectId=${projectId}`}
                style={{
                  fontSize: 13, color: "#016D75", textDecoration: "none",
                  display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                }}
              >
                <Plus size={13} /> Add more
              </Link>
            )}
          </div>

          {photos.length > 0 ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 8,
            }}>
              {photos.map((photo, i) => (
                <div
                  key={photo.id}
                  style={{
                    aspectRatio: "4/3", borderRadius: 4, overflow: "hidden",
                    position: "relative", background: "#f0f0ee",
                    outline: photo.is_primary ? "2px solid #016D75" : "none",
                    outlineOffset: 2,
                  }}
                >
                  <img
                    src={photo.url}
                    alt={`Project photo ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                  />
                  {photo.is_primary && (
                    <span style={{
                      position: "absolute", bottom: 6, left: 6,
                      fontSize: 9, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase",
                      color: "#016D75", background: "rgba(255,255,255,.92)", padding: "2px 6px", borderRadius: 3,
                    }}>Cover</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Link
              href={`/new-project/photos?projectId=${projectId}`}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 10,
                aspectRatio: "16/6",
                border: "1.5px dashed rgba(1,109,117,.3)",
                borderRadius: 6, textDecoration: "none",
                background: "rgba(1,109,117,.015)",
                transition: "border-color .2s, box-shadow .2s",
                position: "relative",
              }}
            >
              <span style={{
                position: "absolute", top: -9, left: 14,
                fontSize: 10, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase",
                color: "#016D75", background: "#fff", padding: "0 8px",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 2v12M2 8h12" />
                </svg>
                Add Photos
              </span>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                border: "1.5px solid rgba(1,109,117,.25)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#016D75",
              }}>
                <Plus size={18} />
              </div>
              <span style={{ fontSize: 13, color: "#016D75" }}>Upload images</span>
            </Link>
          )}
        </section>

      </div>
    </div>
  )
}
