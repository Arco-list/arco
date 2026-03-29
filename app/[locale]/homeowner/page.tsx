"use client"

import { Suspense, useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Camera, ChevronLeft, ChevronRight } from "lucide-react"
import { ShareModal } from "@/components/share-modal"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"

import { useTranslations } from "next-intl"
import { useAuth } from "@/contexts/auth-context"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProfessionalCard } from "@/components/professional-card"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import { checkSelfDeletionAction, deleteSelfAccountAction, type DeletionCheckResult } from "@/app/homeowner/actions"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type HomeownerTab = "saved-projects" | "saved-professionals" | "account"

const AVATAR_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const AVATAR_MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}
const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024

function HomeownerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, profile, supabase, refreshSession, refreshProfile, isLoading } = useAuth()
  const t = useTranslations("homeowner")

  const TAB_ITEMS: { value: HomeownerTab; label: string }[] = [
    { value: "saved-projects", label: t("saved_projects") },
    { value: "saved-professionals", label: t("saved_professionals") },
    { value: "account", label: t("account") },
  ]

  const activeTab = (searchParams.get("tab") as HomeownerTab) || "saved-projects"
  const setActiveTab = (tab: HomeownerTab) => {
    router.push(`/homeowner?tab=${tab}`, { scroll: false })
  }

  // ── Profile state ──
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [location, setLocation] = useState("")
  const [phone, setPhone] = useState("")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Inline edit state ──
  const [activeEditField, setActiveEditField] = useState<string | null>(null)
  const [editingSpecBar, setEditingSpecBar] = useState<string | null>(null)
  const [editSaveStatus, setEditSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const editSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Email modal state ──
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailModalEmail, setEmailModalEmail] = useState("")

  // ── Password state ──
  const [passwordExpanded, setPasswordExpanded] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  // ── Notification preferences state ──
  const [notifPrefs, setNotifPrefs] = useState<{ project_updates: boolean; marketing: boolean }>({ project_updates: true, marketing: false })

  // ── Delete account state ──
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deletePassword, setDeletePassword] = useState("")
  const [isCheckingDeletion, setIsCheckingDeletion] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deletionCheck, setDeletionCheck] = useState<DeletionCheckResult | null>(null)

  // ── Companies count ──
  const [companyCount, setCompanyCount] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase
      .from("professionals")
      .select("company_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active")
      .then(({ count }) => setCompanyCount(count ?? 0))
  }, [user, supabase])

  const isEmailAuthUser = useMemo(() => {
    if (!user) return false
    const provider = user.app_metadata?.provider
    const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata?.providers : []
    return provider === "email" || providers?.includes("email") || Boolean(user.email)
  }, [user])

  const connectedProviders = useMemo(() => {
    if (!user) return [] as string[]
    return Array.isArray(user.app_metadata?.providers) ? (user.app_metadata.providers as string[]) : []
  }, [user])

  // ── Initialize from profile ──
  useEffect(() => {
    if (isLoading) return
    setFirstName(profile?.first_name ?? "")
    setLastName(profile?.last_name ?? "")
    setEmail(user?.email ?? "")
    setLocation(profile?.location ?? "")
    setPhone(profile?.phone ?? "")
    const prefs = profile?.notification_preferences as { project_updates?: boolean; marketing?: boolean } | null
    setNotifPrefs({ project_updates: prefs?.project_updates ?? true, marketing: prefs?.marketing ?? false })
  }, [isLoading, profile?.first_name, profile?.last_name, user?.email, profile?.location, profile?.phone, profile?.notification_preferences])

  useEffect(() => {
    setAvatarPreview(profile?.avatar_url ?? null)
  }, [profile?.avatar_url])

  // ── Helpers ──
  const flashSaved = useCallback(() => {
    setEditSaveStatus("saved")
    if (editSaveTimerRef.current) clearTimeout(editSaveTimerRef.current)
    editSaveTimerRef.current = setTimeout(() => setEditSaveStatus("idle"), 2000)
  }, [])

  const getInitials = () => {
    const f = firstName?.trim().charAt(0) ?? ""
    const l = lastName?.trim().charAt(0) ?? ""
    const initials = `${f}${l}`.toUpperCase()
    if (initials) return initials
    return email?.trim().charAt(0)?.toUpperCase() ?? "U"
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || t("your_name")
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null
  const userTypes = profile?.user_types ?? []
  const accountType = userTypes.includes("professional")
    ? t("professional")
    : userTypes.includes("client")
      ? t("client")
      : t("member")

  // ── Save profile field ──
  const saveProfileField = useCallback(async (fields: Record<string, string | null>) => {
    if (!user) return
    setEditSaveStatus("saving")
    const { error } = await supabase
      .from("profiles")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", user.id)
    if (error) {
      toast.error("Could not save", { description: error.message })
      setEditSaveStatus("idle")
      return
    }
    await refreshProfile()
    flashSaved()
  }, [user, supabase, refreshProfile, flashSaved])

  // ── Save email (auth) ──
  const saveEmail = useCallback(async (newEmail: string) => {
    if (!user) return
    setEditSaveStatus("saving")
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: window.location.origin }
    )
    if (error) {
      toast.error("Could not update email", { description: error.message })
      setEditSaveStatus("idle")
      return
    }
    toast.warning("Check your inbox", { description: "Confirm the email change to complete the update." })
    flashSaved()
  }, [user, supabase, flashSaved])

  // ── Avatar upload ──
  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!file || !user) return

    if (!AVATAR_ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error("Profile photos must be JPG, PNG, or WEBP")
      return
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      toast.error("Profile photos must be 5 MB or smaller")
      return
    }

    const ext = AVATAR_MIME_TO_EXTENSION[file.type] ?? "jpg"
    const objectKey = `${user.id}/${crypto.randomUUID()}.${ext}`
    const previousStoragePath = profile?.avatar_storage_path ?? null

    setIsUploadingAvatar(true)
    try {
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(objectKey, file, { cacheControl: "3600", upsert: false, contentType: file.type })
      if (uploadError) { toast.error("Could not upload photo", { description: uploadError.message }); return }

      const { data: publicUrlData } = supabase.storage.from("profile-photos").getPublicUrl(objectKey)
      const publicUrl = publicUrlData?.publicUrl ? `${publicUrlData.publicUrl}?v=${Date.now()}` : null
      if (!publicUrl) { toast.error("Could not fetch photo URL"); void supabase.storage.from("profile-photos").remove([objectKey]); return }

      setAvatarPreview(publicUrl)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, avatar_storage_path: objectKey, updated_at: new Date().toISOString() })
        .eq("id", user.id)
      if (profileError) { toast.error("Could not save photo"); void supabase.storage.from("profile-photos").remove([objectKey]); return }

      if (previousStoragePath && previousStoragePath !== objectKey) {
        void supabase.storage.from("profile-photos").remove([previousStoragePath])
      }
      await refreshProfile()
      toast.success("Profile photo updated")
    } catch (err) {
      toast.error("Could not update photo", { description: err instanceof Error ? err.message : "Unexpected error" })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  // ── Name blur handlers ──
  const handleNameBlur = useCallback((e: React.FocusEvent<HTMLHeadingElement>) => {
    const newName = (e.currentTarget.textContent ?? "").trim()
    setActiveEditField(null)
    if (!newName) return
    const parts = newName.split(" ")
    const newFirst = parts[0] || ""
    const newLast = parts.slice(1).join(" ") || ""
    if (newFirst !== firstName || newLast !== lastName) {
      setFirstName(newFirst)
      setLastName(newLast)
      saveProfileField({ first_name: newFirst || null, last_name: newLast || null })
    }
  }, [firstName, lastName, saveProfileField])

  // ── Password submit ──
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user?.email || !isEmailAuthUser) return

    if (!currentPassword.trim()) { toast.error("Enter your current password"); return }
    if (newPassword.trim().length < 8) { toast.error("New password must be at least 8 characters"); return }
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match"); return }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) { toast.error("Misconfigured credentials"); return }

    setIsSavingPassword(true)
    try {
      const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ email: user.email, password: currentPassword }),
      })
      if (!verifyResponse.ok) {
        const payload = (await verifyResponse.json().catch(() => null)) as { error_description?: string } | null
        toast.error("Current password is incorrect", { description: payload?.error_description ?? undefined })
        return
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) { toast.error("Unable to change password", { description: updateError.message }); return }

      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
      setPasswordExpanded(false)
      await refreshSession()
      toast.success("Password updated")
    } catch (err) {
      toast.error("Unable to change password", { description: err instanceof Error ? err.message : "Unexpected error" })
    } finally {
      setIsSavingPassword(false)
    }
  }

  // ── Notification toggle ──
  const handleNotifToggle = useCallback(async (key: "project_updates" | "marketing") => {
    if (!user) return
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(updated)
    const { error } = await supabase
      .from("profiles")
      .update({ notification_preferences: updated as any, updated_at: new Date().toISOString() })
      .eq("id", user.id)
    if (error) {
      toast.error("Could not save notification preferences")
      setNotifPrefs(notifPrefs)
    }
  }, [user, supabase, notifPrefs])

  // ── Delete account ──
  const handleOpenDeleteDialog = useCallback(async () => {
    setDeleteDialogOpen(true)
    setDeleteConfirmText("")
    setDeletePassword("")
    setDeletionCheck(null)
    setIsCheckingDeletion(true)
    const result = await checkSelfDeletionAction()
    if (result.success && result.data) {
      setDeletionCheck(result.data)
    } else {
      toast.error(result.error ?? "Could not check account status")
      setDeleteDialogOpen(false)
    }
    setIsCheckingDeletion(false)
  }, [])

  const handleDeleteAccount = useCallback(async () => {
    if (deleteConfirmText !== "DELETE") { toast.error("Type DELETE to confirm"); return }
    setIsDeletingAccount(true)
    const result = await deleteSelfAccountAction({
      password: isEmailAuthUser ? deletePassword : undefined,
      confirmText: deleteConfirmText,
    })
    if (result.success) {
      await supabase.auth.signOut()
      window.location.href = "/"
    } else {
      toast.error(result.error ?? "Could not delete account")
      setIsDeletingAccount(false)
    }
  }, [deleteConfirmText, deletePassword, isEmailAuthUser, supabase])

  // ── Google Maps location lookup (styled dropdown) ──
  const [locationQuery, setLocationQuery] = useState("")
  const [locationResults, setLocationResults] = useState<Array<{ placeId: string; mainText: string; secondaryText: string }>>([])
  const [isLocationSearching, setIsLocationSearching] = useState(false)
  const locationSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const locationServiceRef = useRef<any>(null)

  const searchLocation = useCallback((query: string) => {
    setLocationQuery(query)
    if (locationSearchTimer.current) clearTimeout(locationSearchTimer.current)
    if (query.trim().length < 2) { setLocationResults([]); return }

    locationSearchTimer.current = setTimeout(async () => {
      setIsLocationSearching(true)
      try {
        const g = (window as any).google
        if (!g?.maps) { setIsLocationSearching(false); return }

        if (!locationServiceRef.current) {
          const placesLib = await g.maps.importLibrary("places")
          if (!placesLib?.AutocompleteService) { setIsLocationSearching(false); return }
          locationServiceRef.current = new placesLib.AutocompleteService()
        }

        const predictions = await new Promise<any>((resolve) => {
          locationServiceRef.current.getPlacePredictions(
            { input: query.trim(), types: ["(cities)"] },
            (preds: any, status: string) => { resolve(status === "OK" && preds ? preds : []) },
          )
        })

        setLocationResults(predictions.slice(0, 5).map((p: any) => ({
          placeId: p.place_id,
          mainText: p.structured_formatting?.main_text ?? "",
          secondaryText: p.structured_formatting?.secondary_text ?? "",
        })))
      } catch { setLocationResults([]) }
      setIsLocationSearching(false)
    }, 300)
  }, [])

  const handleSelectLocation = useCallback(async (placeId: string) => {
    try {
      const g = (window as any).google
      if (!g?.maps) return

      const placesLib = await g.maps.importLibrary("places")
      const div = document.createElement("div")
      const service = new placesLib.PlacesService(div)

      const place = await new Promise<any>((resolve, reject) => {
        service.getDetails(
          { placeId, fields: ["address_components", "formatted_address"] },
          (p: any, status: string) => { status === "OK" && p ? resolve(p) : reject(new Error("Failed")) },
        )
      })

      let newCity = ""
      for (const comp of place.address_components ?? []) {
        if (comp.types.includes("locality")) newCity = comp.long_name
      }

      const loc = newCity || place.formatted_address || ""
      setLocation(loc)
      setEditingSpecBar(null)
      setLocationQuery("")
      setLocationResults([])
      saveProfileField({ location: loc || null })
    } catch {
      toast.error("Could not load location details")
    }
  }, [saveProfileField])

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ paddingTop: 60 }}>
      <style>{`
        .ec { position: relative; cursor: pointer; }
        .ec::before { content: ''; position: absolute; inset: -6px -14px; border: 1px solid transparent; border-radius: 5px; transition: border-color .18s; pointer-events: none; z-index: 0; }
        .ec:hover::before { border-color: #1c1c1a; }
        .ec.on::before  { border-color: #016D75; }
        .ec.on          { cursor: default; }
        .ec-badge { position: absolute; top: -19px; left: -8px; display: flex; align-items: center; gap: 4px; background: #fff; padding: 0 4px; pointer-events: none; z-index: 1; }
        .ec-ico { display: flex; align-items: center; color: #c8c8c6; transition: color .18s; }
        .ec-txt { font-size: 10px; font-weight: 400; letter-spacing: .04em; text-transform: uppercase; color: #c8c8c6; white-space: nowrap; transition: color .15s; }
        .ec:hover .ec-ico, .ec:hover .ec-txt { color: #1c1c1a; }
        .ec.on    .ec-ico, .ec.on    .ec-txt { color: #016D75; }
        [contenteditable]:focus { outline: none; }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #b0b0ae; pointer-events: none; }

        .spec-item-edit { padding: 0; text-align: center; position: relative; cursor: pointer; transition: background .15s; }
        .spec-item-edit::before { content: ''; position: absolute; inset: -32px -6px; border: 1px solid transparent; border-radius: 5px; pointer-events: none; transition: border-color .18s; z-index: 1; }
        .spec-item-edit:hover::before { border-color: #1c1c1a; }
        .spec-item-edit.editing::before { border-color: #016D75; }
        .spec-item-edit .ec-badge { top: -40px; left: 50%; transform: translateX(-50%); padding: 0 6px; background: #fff; z-index: 2; }
        .spec-item-edit:hover .ec-ico, .spec-item-edit:hover .ec-txt { color: #1c1c1a; }
        .spec-item-edit.editing .ec-ico, .spec-item-edit.editing .ec-txt { color: #016D75; }
        .spec-item-edit.editing .spec-eyebrow { color: #016D75; }
        .spec-inp { width: 100%; text-align: center; font-size: 15px; font-weight: 500; color: #1c1c1a; background: transparent; border: none; border-bottom: 1px solid rgba(1,109,117,.3); outline: none; padding: 0 0 2px; font-family: inherit; }
      `}</style>

      <Header />

      {/* ── Sub-nav with tabs ── */}
      <div className="sub-nav">
        <div className="wrap">
          <div className="sub-nav-content">
            <div className="sub-nav-left">
              <div className="sub-nav-links" style={{ paddingRight: 0, marginRight: 0, borderRight: "none" }}>
                {TAB_ITEMS.map(({ value, label }) => (
                  <button
                    key={value}
                    className={`sub-nav-link arco-eyebrow${activeTab === value ? " active" : ""}`}
                    onClick={() => setActiveTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Saved Projects Tab ── */}
      {activeTab === "saved-projects" && <SavedProjectsTab />}

      {/* ── Saved Professionals Tab ── */}
      {activeTab === "saved-professionals" && <SavedProfessionalsTab />}

      {/* ── Account Tab ── */}
      {activeTab === "account" && (
      <div className="wrap" style={{ paddingTop: 60, marginBottom: 60, flex: 1 }} id="header">
        <section className="professional-header" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          {/* Avatar */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 100, height: 100, borderRadius: "50%",
              background: "var(--arco-off-white)", display: "flex",
              alignItems: "center", justifyContent: "center",
              overflow: "hidden", cursor: "pointer", position: "relative",
              flexShrink: 0, marginBottom: 24,
            }}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 28, fontWeight: 500, color: "var(--arco-mid-grey)" }}>
                {getInitials()}
              </span>
            )}
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: 0, transition: "opacity .15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
            >
              <Camera size={20} style={{ color: "#fff" }} />
            </div>
            <input ref={fileInputRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={handleAvatarFileChange} />
            {isUploadingAvatar && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(255,255,255,.7)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 500, color: "var(--arco-mid-grey)",
              }}>
                {t("uploading")}
              </div>
            )}
          </div>

          {/* Name (contentEditable) */}
          <div className={`ec${activeEditField === "name" ? " on" : ""}`} style={{ marginBottom: 16 }}>
            <EditBadge />
            <h1
              className="arco-page-title"
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setActiveEditField("name")}
              onBlur={handleNameBlur}
              data-placeholder={t("your_name")}
              style={{ marginBottom: 0 }}
            >
              {displayName !== t("your_name") ? displayName : ""}
            </h1>
          </div>

          {/* Email badge — click to open email change popup (like service selector) */}
          <p
            className="professional-badge service-popup-badge"
            onClick={() => { setEmailModalEmail(email); setEmailModalOpen(true) }}
            style={{ cursor: "pointer" }}
          >
            {email || t("add_email")}
          </p>
        </section>

        {/* ── Details bar ── */}
        <div id="details" style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 32, padding: "32px 0",
          borderTop: "1px solid #e8e8e6", borderBottom: "1px solid #e8e8e6",
        }}>
          {/* Location */}
          <div
            className={`spec-item-edit${editingSpecBar === "location" ? " editing" : ""}`}
            onClick={() => { if (editingSpecBar !== "location") { setEditingSpecBar("location"); setLocationQuery("") } }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("location")}</span>
            {editingSpecBar === "location" ? (
              <div style={{ position: "relative" }}>
                <input
                  autoFocus
                  className="spec-inp"
                  value={locationQuery}
                  onChange={(e) => searchLocation(e.target.value)}
                  placeholder={t("search_city")}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditingSpecBar(null)
                      setLocationQuery("")
                      setLocationResults([])
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow dropdown click
                    setTimeout(() => {
                      if (editingSpecBar === "location") {
                        setEditingSpecBar(null)
                        setLocationQuery("")
                        setLocationResults([])
                      }
                    }, 200)
                  }}
                />
                {locationQuery.trim().length >= 2 && (
                  <div style={{
                    position: "absolute", left: -6, right: -6, top: "100%", marginTop: 8, zIndex: 20,
                    background: "#fff", border: "1px solid #e8e8e6", borderRadius: 5,
                    boxShadow: "0 4px 12px rgba(0,0,0,.08)", overflow: "hidden",
                  }}>
                    {locationResults.map((r) => (
                      <button
                        key={r.placeId}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleSelectLocation(r.placeId) }}
                        style={{
                          display: "block", width: "100%", padding: "10px 14px", border: "none",
                          background: "none", textAlign: "left", cursor: "pointer",
                          fontSize: 14, fontFamily: "inherit",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f4")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        <span style={{ fontWeight: 500 }}>{r.mainText}</span>
                        {r.secondaryText && <span style={{ color: "#a1a1a0", marginLeft: 4 }}>{r.secondaryText}</span>}
                      </button>
                    ))}
                    {isLocationSearching && (
                      <div style={{ padding: "10px 14px", fontSize: 13, color: "#a1a1a0" }}>{t("searching")}</div>
                    )}
                    {!isLocationSearching && locationResults.length === 0 && (
                      <div style={{ padding: "10px 14px", fontSize: 13, color: "#a1a1a0" }}>{t("no_results_found")}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="arco-card-title" style={{ color: location ? undefined : "#b0b0ae" }}>
                {location || t("add_location")}
              </div>
            )}
          </div>

          {/* Phone */}
          <div
            className={`spec-item-edit${editingSpecBar === "phone" ? " editing" : ""}`}
            onClick={() => { if (editingSpecBar !== "phone") setEditingSpecBar("phone") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("phone")}</span>
            {editingSpecBar === "phone" ? (
              <input
                autoFocus
                type="tel"
                className="spec-inp"
                defaultValue={phone}
                placeholder="+31 6 1234 5678"
                onBlur={(e) => {
                  const val = e.target.value.trim()
                  if (val !== phone) {
                    setPhone(val)
                    saveProfileField({ phone: val || null })
                  }
                  setEditingSpecBar(null)
                }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              />
            ) : (
              <div className="arco-card-title" style={{ color: phone ? undefined : "#b0b0ae" }}>
                {phone || t("add_phone")}
              </div>
            )}
          </div>

          {/* Member Since (read-only) */}
          <div className="spec-item-edit" style={{ cursor: "default" }}>
            <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("member_since")}</span>
            <div className="arco-card-title" style={{ color: memberSince ? undefined : "#b0b0ae" }}>
              {memberSince ?? "—"}
            </div>
          </div>

          {/* Companies */}
          <div className="spec-item-edit" style={{ cursor: companyCount > 0 ? "pointer" : "default" }} onClick={() => { if (companyCount > 0) router.push("/dashboard/listings") }}>
            <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("companies")}</span>
            <div className="arco-card-title" style={{ color: companyCount > 0 ? undefined : "#b0b0ae" }}>
              {companyCount > 0 ? t("company_count", { count: companyCount }) : t("none")}
            </div>
          </div>
        </div>

        {/* ── Notification Preferences ── */}
        <div style={{ padding: "48px 0" }}>
          <h2 className="arco-section-title" style={{ marginBottom: 8 }}>
            {t("notification_preferences")}
          </h2>
          <p className="arco-body-text" style={{ marginBottom: 32 }}>
            {t("notification_description")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 400 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <div className="arco-card-title">{t("project_updates")}</div>
                <p className="arco-body-text" style={{ margin: 0 }}>{t("project_updates_description")}</p>
              </div>
              <ToggleSwitch checked={notifPrefs.project_updates} onChange={() => handleNotifToggle("project_updates")} />
            </label>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <div className="arco-card-title">{t("marketing_emails")}</div>
                <p className="arco-body-text" style={{ margin: 0 }}>{t("marketing_description")}</p>
              </div>
              <ToggleSwitch checked={notifPrefs.marketing} onChange={() => handleNotifToggle("marketing")} />
            </label>
          </div>
        </div>

        {/* ── Connected Accounts ── */}
        <div style={{ padding: "48px 0" }}>
          <h2 className="arco-section-title" style={{ marginBottom: 8 }}>
            {t("security_connections")}
          </h2>
          <p className="arco-body-text" style={{ marginBottom: 32 }}>
            {t("security_description")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
            {/* Password */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c1c1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <span className="arco-card-title">{t("password")}</span>
              </div>
              {isEmailAuthUser ? (
                <button
                  onClick={() => setPasswordExpanded(true)}
                  style={{
                    fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 12,
                    background: "#e6f4f5", color: "#016D75",
                    border: "none", cursor: "pointer",
                  }}
                >
                  {t("update")}
                </button>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 12, background: "#f5f5f4", color: "#b0b0ae" }}>
                  {t("managed_by_provider")}
                </span>
              )}
            </div>
            {/* Google */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="arco-card-title">Google</span>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 12,
                background: connectedProviders.includes("google") ? "#e6f4f5" : "#f5f5f4",
                color: connectedProviders.includes("google") ? "#016D75" : "#b0b0ae",
              }}>
                {connectedProviders.includes("google") ? t("connected") : t("not_connected")}
              </span>
            </div>
            {/* Apple */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#1c1c1a">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                <span className="arco-card-title">Apple</span>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 12,
                background: connectedProviders.includes("apple") ? "#e6f4f5" : "#f5f5f4",
                color: connectedProviders.includes("apple") ? "#016D75" : "#b0b0ae",
              }}>
                {connectedProviders.includes("apple") ? t("connected") : t("not_connected")}
              </span>
            </div>
          </div>
        </div>

        {/* ── Delete Account ── */}
        <div style={{ padding: "48px 0" }}>
          <hr style={{ border: "none", borderTop: "1px solid var(--arco-rule)", margin: "0 0 24px" }} />
          <button
            onClick={handleOpenDeleteDialog}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 13, fontWeight: 300, padding: 0,
              color: "#dc2626", background: "none",
              border: "none", cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14M10 11v6M14 11v6" />
            </svg>
            {t("delete_account")}
          </button>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("delete_confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("delete_confirm_description")}
                </AlertDialogDescription>
              </AlertDialogHeader>

              {isCheckingDeletion ? (
                <p style={{ fontSize: 14, color: "var(--arco-mid-grey)" }}>{t("checking_account")}</p>
              ) : deletionCheck ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {deletionCheck.warnings.length > 0 && (
                    <div style={{ background: "#fef3c7", padding: 12, borderRadius: 4, fontSize: 13 }}>
                      <strong>{t("data_deleted_warning")}</strong>
                      <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                        {deletionCheck.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}

                  {deletionCheck.blockers.length > 0 && (
                    <div style={{ background: "#fee2e2", padding: 12, borderRadius: 4, fontSize: 13 }}>
                      <strong>{t("cannot_delete")}</strong>
                      <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                        {deletionCheck.blockers.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    </div>
                  )}

                  {deletionCheck.canDelete && (
                    <>
                      {isEmailAuthUser && (
                        <div>
                          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                            {t("enter_password")}
                          </label>
                          <input
                            type="password"
                            value={deletePassword}
                            onChange={e => setDeletePassword(e.target.value)}
                            placeholder={t("your_current_password")}
                            style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid var(--arco-light-grey)", borderRadius: 3, fontFamily: "inherit", outline: "none" }}
                          />
                        </div>
                      )}

                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }} dangerouslySetInnerHTML={{ __html: t("type_delete_confirm") }} />
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={e => setDeleteConfirmText(e.target.value)}
                          placeholder="DELETE"
                          autoComplete="off"
                          style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid var(--arco-light-grey)", borderRadius: 3, fontFamily: "inherit", outline: "none" }}
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setDeleteDialogOpen(false); setDeletionCheck(null) }}>
                  {t("cancel")}
                </AlertDialogCancel>
                {deletionCheck?.canDelete && (
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount || deleteConfirmText !== "DELETE" || (isEmailAuthUser && !deletePassword)}
                    style={{
                      background: "#b91c1c", color: "#fff", border: "none",
                      padding: "10px 20px", borderRadius: 3, fontSize: 14, cursor: "pointer",
                      fontFamily: "inherit", fontWeight: 500,
                      opacity: (isDeletingAccount || deleteConfirmText !== "DELETE" || (isEmailAuthUser && !deletePassword)) ? 0.5 : 1,
                    }}
                  >
                    {isDeletingAccount ? t("deleting") : t("delete_my_account")}
                  </button>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      )}

      {/* ══════ Email Change Modal ══════ */}
      {emailModalOpen && (
        <div className="popup-overlay" onClick={() => setEmailModalOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{t("update_email")}</h3>
              <button className="popup-close" onClick={() => setEmailModalOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 20 }}>
              {t("email_confirmation")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                  {t("new_email_address")}
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={emailModalEmail}
                  onChange={e => setEmailModalEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const trimmed = emailModalEmail.trim()
                      if (trimmed && trimmed !== email) {
                        setEmail(trimmed)
                        saveEmail(trimmed)
                      }
                      setEmailModalOpen(false)
                    }
                  }}
                  placeholder="new@email.com"
                  autoFocus
                  style={{ marginBottom: 0 }}
                />
              </div>
              <button
                onClick={() => {
                  const trimmed = emailModalEmail.trim()
                  if (trimmed && trimmed !== email) {
                    setEmail(trimmed)
                    saveEmail(trimmed)
                  }
                  setEmailModalOpen(false)
                }}
                disabled={!emailModalEmail.trim()}
                className="btn-primary"
                style={{ width: "100%", marginTop: 4, fontSize: 14, padding: "12px 20px" }}
              >
                {t("update_email")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Password Change Modal ══════ */}
      {passwordExpanded && isEmailAuthUser && (
        <div className="popup-overlay" onClick={() => { setPasswordExpanded(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("") }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{t("update_password")}</h3>
              <button className="popup-close" onClick={() => { setPasswordExpanded(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("") }} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 20 }}>
              {t("password_instructions")}
            </p>
            <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                  {t("current_password")}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  disabled={isSavingPassword}
                  placeholder={t("enter_current_password")}
                  autoFocus
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                  {t("new_password")}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  disabled={isSavingPassword}
                  placeholder={t("at_least_8_chars")}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                  {t("confirm_new_password")}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={isSavingPassword}
                  placeholder={t("confirm_new_password")}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <button
                type="submit"
                disabled={isSavingPassword}
                className="btn-primary"
                style={{ width: "100%", marginTop: 4, fontSize: 14, padding: "12px 20px" }}
              >
                {isSavingPassword ? t("updating") : t("update_password")}
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

/* ── Saved Projects Tab ── */
function SavedProjectCard({ entry, isMutating, onRemove, categories }: {
  entry: { projectId: string; summary: any }
  isMutating: boolean
  onRemove: (id: string) => void
  categories: Map<string, string>
}) {
  const [shareOpen, setShareOpen] = useState(false)
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([])
  const [photoIndex, setPhotoIndex] = useState(0)
  const [typeLabel, setTypeLabel] = useState<string | null>(null)
  const summary = entry.summary
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])

  // Fetch preview photos and primary category
  useEffect(() => {
    if (!summary?.id) return
    supabase
      .from("project_photos")
      .select("id, url, is_primary")
      .eq("project_id", summary.id)
      .order("is_primary", { ascending: false, nullsFirst: false })
      .order("order_index", { ascending: true, nullsFirst: false })
      .limit(5)
      .then(({ data }) => {
        if (data?.length) setPhotos(data.filter(p => p.url))
      })
    // Fetch project type from project_categories
    supabase
      .from("project_categories")
      .select("category:categories(name)")
      .eq("project_id", summary.id)
      .eq("is_primary", true)
      .maybeSingle()
      .then(({ data }) => {
        const name = (data as any)?.category?.name
        if (name) setTypeLabel(name)
      })
  }, [summary?.id, supabase])

  if (!summary) return null

  const currentPhoto = photos[photoIndex]?.url || summary.primary_photo_url || "/placeholder.svg"
  const title = summary.title || "Project"
  const location = summary.location || null
  const subtitle = [typeLabel, location].filter(Boolean).join(" · ")
  const hasMultiplePhotos = photos.length > 1

  const navigatePhoto = (dir: "prev" | "next", e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPhotoIndex(prev =>
      dir === "next" ? (prev + 1) % photos.length : (prev - 1 + photos.length) % photos.length
    )
  }

  return (
    <>
      <Link href={summary.slug ? `/projects/${summary.slug}` : "#"} className="discover-card">
        <div className="discover-card-image-wrap">
          <div className="discover-card-image-layer">
            <img key={currentPhoto} src={currentPhoto} alt={title} />
          </div>

          {/* Nav arrows */}
          {hasMultiplePhotos && (
            <div className="discover-card-nav-arrows">
              <button className="discover-card-nav-arrow" onClick={(e) => navigatePhoto("prev", e)} aria-label="Previous">
                <ChevronLeft size={14} />
              </button>
              <button className="discover-card-nav-arrow" onClick={(e) => navigatePhoto("next", e)} aria-label="Next">
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Dots */}
          {hasMultiplePhotos && (
            <div className="discover-card-dots">
              {photos.map((_, i) => (
                <span key={i} className={`discover-card-dot${i === photoIndex ? " active" : ""}`} />
              ))}
            </div>
          )}

          <div className="discover-card-actions" data-saved={true}>
            <button
              className="discover-card-action-btn"
              data-saved={true}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isMutating) onRemove(entry.projectId) }}
              disabled={isMutating}
              aria-label="Remove from saved"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
            <button
              className="discover-card-action-btn"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareOpen(true) }}
              aria-label="Share project"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
          </div>
        </div>
        <h3 className="discover-card-title">{title}</h3>
        {subtitle && <p className="discover-card-sub">{subtitle}</p>}
      </Link>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title={title}
        subtitle={subtitle}
        imageUrl={currentPhoto}
        shareUrl={summary.slug ? `/projects/${summary.slug}` : ""}
      />
    </>
  )
}

function SavedProjectsTab() {
  const {
    savedProjects,
    mutatingProjectIds,
    isLoading,
    removeProject,
  } = useSavedProjects()
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map())
  const t = useTranslations("homeowner")

  // Fetch category names for subtitle
  useEffect(() => {
    supabase.from("categories").select("id, name").then(({ data }) => {
      if (data) setCategoryMap(new Map(data.map(c => [c.id, c.name])))
    })
  }, [supabase])

  return (
    <main style={{ flex: 1 }}>
      <div className="discover-page-title">
        <div className="wrap">
          <h2 className="arco-section-title">{t("saved_projects")}</h2>
        </div>
      </div>
      <div className="discover-results">
        <div className="wrap">
          {!isLoading && savedProjects.length > 0 && (
            <div className="discover-results-meta">
              <p className="discover-results-count">
                <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>
                  {savedProjects.length}
                </strong>{" "}
                {t("saved_projects_count", { count: savedProjects.length })}
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="discover-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div style={{ aspectRatio: "4/3", background: "var(--surface)", borderRadius: 4, marginBottom: 12 }} />
                  <div style={{ height: 15, background: "var(--surface)", borderRadius: 3, width: "70%", marginBottom: 6 }} />
                  <div style={{ height: 13, background: "var(--surface)", borderRadius: 3, width: "50%" }} />
                </div>
              ))}
            </div>
          ) : savedProjects.length > 0 ? (
            <div className="discover-grid">
              {savedProjects.map((entry) => (
                <SavedProjectCard
                  key={entry.projectId}
                  entry={entry}
                  isMutating={mutatingProjectIds.has(entry.projectId)}
                  onRemove={removeProject}
                  categories={categoryMap}
                />
              ))}
            </div>
          ) : (
            <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "80px 24px", textAlign: "center" }}>
              <h2 className="arco-section-title" style={{ marginBottom: 12 }}>{t("no_saved_projects")}</h2>
              <p className="arco-body-text" style={{ marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                {t("no_saved_projects_description")}
              </p>
              <Link href="/projects" className="btn-primary" style={{ fontSize: 14, padding: "10px 20px" }}>
                {t("discover_projects")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

/* ── Saved Professionals Tab ── */
function SavedProfessionalsTab() {
  const {
    savedProfessionals,
    savedProfessionalIds,
    mutatingProfessionalIds,
    isLoading,
    saveProfessional,
    removeProfessional,
  } = useSavedProfessionals()
  const t = useTranslations("homeowner")

  const handleToggleSave = (professional: any) => {
    if (savedProfessionalIds.has(professional.companyId)) {
      removeProfessional(professional.companyId)
    } else {
      saveProfessional(professional)
    }
  }

  return (
    <main style={{ flex: 1 }}>
      <div className="discover-page-title">
        <div className="wrap">
          <h2 className="arco-section-title">{t("saved_professionals")}</h2>
        </div>
      </div>
      <div className="discover-results">
        <div className="wrap">
          {!isLoading && savedProfessionals.length > 0 && (
            <div className="discover-results-meta">
              <p className="discover-results-count">
                <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>
                  {savedProfessionals.length}
                </strong>{" "}
                {t("saved_professionals_count", { count: savedProfessionals.length })}
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="discover-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div style={{ aspectRatio: "4/3", background: "var(--surface)", borderRadius: 4, marginBottom: 12 }} />
                  <div style={{ height: 15, background: "var(--surface)", borderRadius: 3, width: "70%", marginBottom: 6 }} />
                  <div style={{ height: 13, background: "var(--surface)", borderRadius: 3, width: "50%" }} />
                </div>
              ))}
            </div>
          ) : savedProfessionals.length > 0 ? (
            <div className="discover-grid">
              {savedProfessionals.map((entry) => (
                <ProfessionalCard
                  key={entry.companyId}
                  professional={entry.card}
                  isSaved={savedProfessionalIds.has(entry.companyId)}
                  isMutating={mutatingProfessionalIds.has(entry.companyId)}
                  onToggleSave={handleToggleSave}
                />
              ))}
            </div>
          ) : (
            <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "80px 24px", textAlign: "center" }}>
              <h2 className="arco-section-title" style={{ marginBottom: 12 }}>{t("no_saved_professionals")}</h2>
              <p className="arco-body-text" style={{ marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                {t("no_saved_professionals_description")}
              </p>
              <Link href="/professionals" className="btn-primary" style={{ fontSize: 14, padding: "10px 20px" }}>
                {t("discover_professionals")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    style={{
      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
      background: checked ? "#016D75" : "#d4d4d2",
      position: "relative", transition: "background .2s", flexShrink: 0,
    }}
  >
    <span style={{
      position: "absolute", top: 2, left: checked ? 22 : 2,
      width: 20, height: 20, borderRadius: "50%", background: "#fff",
      transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
    }} />
  </button>
)

function EditBadge() {
  const t = useTranslations("homeowner")
  return (
    <span className="ec-badge">
      <span className="ec-ico">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </span>
      <span className="ec-txt">{t("edit")}</span>
    </span>
  )
}

export default function Homeowner() {
  return (
    <Suspense fallback={null}>
      <HomeownerContent />
    </Suspense>
  )
}
