"use client"

import { Suspense, useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Camera } from "lucide-react"
import { ShareModal } from "@/components/share-modal"

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

const TAB_ITEMS: { value: HomeownerTab; label: string }[] = [
  { value: "saved-projects", label: "Saved projects" },
  { value: "saved-professionals", label: "Saved professionals" },
  { value: "account", label: "Account" },
]

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

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Your Name"
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null
  const userTypes = profile?.user_types ?? []
  const accountType = userTypes.includes("professional")
    ? "Professional"
    : userTypes.includes("client")
      ? "Client"
      : "Member"

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
        .ec::before { content: ''; position: absolute; inset: -10px -14px; border: 1px solid transparent; border-radius: 5px; transition: border-color .18s; pointer-events: none; z-index: 0; }
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
                Uploading...
              </div>
            )}
          </div>

          {/* Name (contentEditable) */}
          <div className={`ec${activeEditField === "name" ? " on" : ""}`}>
            <EditBadge />
            <h1
              className="arco-page-title"
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setActiveEditField("name")}
              onBlur={handleNameBlur}
              data-placeholder="Your name"
            >
              {displayName !== "Your Name" ? displayName : ""}
            </h1>
          </div>

          {/* Email (contentEditable) */}
          <div className={`ec${activeEditField === "email" ? " on" : ""}`} style={{ marginTop: -4 }}>
            <EditBadge />
            <p
              className="arco-body-text"
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setActiveEditField("email")}
              onBlur={(e) => {
                const newEmail = (e.currentTarget.textContent ?? "").trim()
                setActiveEditField(null)
                if (newEmail && newEmail !== email) {
                  setEmail(newEmail)
                  saveEmail(newEmail)
                }
              }}
              data-placeholder="your@email.com"
              style={{ margin: 0, color: "var(--arco-mid-grey)" }}
            >
              {email}
            </p>
          </div>

          {/* Update password link */}
          {isEmailAuthUser ? (
            <button
              onClick={() => setPasswordExpanded(!passwordExpanded)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                fontSize: 13, color: "var(--arco-mid-grey)", textDecoration: "underline",
                marginTop: 4, fontFamily: "inherit",
              }}
            >
              Update password
            </button>
          ) : (
            <p style={{ fontSize: 13, color: "var(--arco-mid-grey)", margin: "4px 0 0" }}>
              Password managed by your sign-in provider
            </p>
          )}

          {/* Inline password form */}
          {passwordExpanded && isEmailAuthUser && (
            <form onSubmit={handlePasswordSubmit} style={{ marginTop: 16, maxWidth: 400, textAlign: "left" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                    Current password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    disabled={isSavingPassword}
                    placeholder="Enter current password"
                    style={{
                      width: "100%", padding: "10px 12px", fontSize: 14,
                      border: "1px solid var(--arco-light-grey)", borderRadius: 3,
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                    New password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    disabled={isSavingPassword}
                    placeholder="At least 8 characters"
                    style={{
                      width: "100%", padding: "10px 12px", fontSize: 14,
                      border: "1px solid var(--arco-light-grey)", borderRadius: 3,
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    disabled={isSavingPassword}
                    placeholder="Confirm new password"
                    style={{
                      width: "100%", padding: "10px 12px", fontSize: 14,
                      border: "1px solid var(--arco-light-grey)", borderRadius: 3,
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="btn-primary"
                  style={{ fontSize: 14, padding: "10px 20px", marginTop: 4, alignSelf: "flex-start" }}
                >
                  {isSavingPassword ? "Updating..." : "Update password"}
                </button>
              </div>
            </form>
          )}
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
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Location</span>
            {editingSpecBar === "location" ? (
              <div style={{ position: "relative" }}>
                <input
                  autoFocus
                  className="spec-inp"
                  value={locationQuery}
                  onChange={(e) => searchLocation(e.target.value)}
                  placeholder="Search city..."
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
                      <div style={{ padding: "10px 14px", fontSize: 13, color: "#a1a1a0" }}>Searching...</div>
                    )}
                    {!isLocationSearching && locationResults.length === 0 && (
                      <div style={{ padding: "10px 14px", fontSize: 13, color: "#a1a1a0" }}>No results found</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="arco-card-title" style={{ color: location ? undefined : "#b0b0ae" }}>
                {location || "Add location"}
              </div>
            )}
          </div>

          {/* Phone */}
          <div
            className={`spec-item-edit${editingSpecBar === "phone" ? " editing" : ""}`}
            onClick={() => { if (editingSpecBar !== "phone") setEditingSpecBar("phone") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Phone</span>
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
                {phone || "Add phone"}
              </div>
            )}
          </div>

          {/* Member Since (read-only) */}
          <div className="spec-item-edit" style={{ cursor: "default" }}>
            <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>Member Since</span>
            <div className="arco-card-title" style={{ color: memberSince ? undefined : "#b0b0ae" }}>
              {memberSince ?? "—"}
            </div>
          </div>

          {/* Account Type (read-only) */}
          <div className="spec-item-edit" style={{ cursor: "default" }}>
            <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>Account Type</span>
            <div className="arco-card-title">{accountType}</div>
          </div>
        </div>

        {/* ── Notification Preferences ── */}
        <div style={{ padding: "48px 0" }}>
          <h2 className="arco-section-title" style={{ marginBottom: 8 }}>
            Notification Preferences
          </h2>
          <p style={{ fontSize: 14, color: "var(--arco-mid-grey)", marginBottom: 32 }}>
            Choose which email notifications you receive.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 400 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--arco-black)" }}>Project updates</div>
                <div style={{ fontSize: 13, color: "var(--arco-mid-grey)" }}>Receive updates about your projects</div>
              </div>
              <ToggleSwitch checked={notifPrefs.project_updates} onChange={() => handleNotifToggle("project_updates")} />
            </label>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--arco-black)" }}>Marketing emails</div>
                <div style={{ fontSize: 13, color: "var(--arco-mid-grey)" }}>Tips, inspiration, and platform news</div>
              </div>
              <ToggleSwitch checked={notifPrefs.marketing} onChange={() => handleNotifToggle("marketing")} />
            </label>
          </div>
        </div>

        <div style={{ borderBottom: "1px solid #e8e8e6" }} />

        {/* ── Connected Accounts ── */}
        <div style={{ padding: "48px 0" }}>
          <h2 className="arco-section-title" style={{ marginBottom: 8 }}>
            Connected Accounts
          </h2>
          <p style={{ fontSize: 14, color: "var(--arco-mid-grey)", marginBottom: 32 }}>
            Sign-in providers linked to your account.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
            {/* Google */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f0f0ee" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span style={{ fontSize: 15, fontWeight: 500 }}>Google</span>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 12,
                background: connectedProviders.includes("google") ? "#e6f4f5" : "#f5f5f4",
                color: connectedProviders.includes("google") ? "#016D75" : "#b0b0ae",
              }}>
                {connectedProviders.includes("google") ? "Connected" : "Not connected"}
              </span>
            </div>
            {/* Apple */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#1c1c1a">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                <span style={{ fontSize: 15, fontWeight: 500 }}>Apple</span>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 12,
                background: connectedProviders.includes("apple") ? "#e6f4f5" : "#f5f5f4",
                color: connectedProviders.includes("apple") ? "#016D75" : "#b0b0ae",
              }}>
                {connectedProviders.includes("apple") ? "Connected" : "Not connected"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ borderBottom: "1px solid #e8e8e6" }} />

        {/* ── Delete Account ── */}
        <div style={{ padding: "48px 0" }}>
          <h2 className="arco-section-title" style={{ marginBottom: 8, color: "#b91c1c" }}>
            Delete Account
          </h2>
          <p style={{ fontSize: 14, color: "var(--arco-mid-grey)", marginBottom: 32 }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <div>
            <button
              onClick={handleOpenDeleteDialog}
              style={{
                background: "none", border: "1px solid #b91c1c", color: "#b91c1c",
                padding: "10px 24px", borderRadius: 3, fontSize: 14, cursor: "pointer",
                fontFamily: "inherit", fontWeight: 500,
              }}
            >
              Delete my account
            </button>
          </div>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>

              {isCheckingDeletion ? (
                <p style={{ fontSize: 14, color: "var(--arco-mid-grey)" }}>Checking account status...</p>
              ) : deletionCheck ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {deletionCheck.warnings.length > 0 && (
                    <div style={{ background: "#fef3c7", padding: 12, borderRadius: 4, fontSize: 13 }}>
                      <strong>The following data will be deleted:</strong>
                      <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                        {deletionCheck.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}

                  {deletionCheck.blockers.length > 0 && (
                    <div style={{ background: "#fee2e2", padding: 12, borderRadius: 4, fontSize: 13 }}>
                      <strong>Cannot delete account:</strong>
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
                            Enter your password
                          </label>
                          <input
                            type="password"
                            value={deletePassword}
                            onChange={e => setDeletePassword(e.target.value)}
                            placeholder="Your current password"
                            style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid var(--arco-light-grey)", borderRadius: 3, fontFamily: "inherit", outline: "none" }}
                          />
                        </div>
                      )}

                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                          Type <strong>DELETE</strong> to confirm
                        </label>
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
                  Cancel
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
                    {isDeletingAccount ? "Deleting..." : "Delete my account"}
                  </button>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      )}

      <Footer />
    </div>
  )
}

/* ── Saved Projects Tab ── */
function SavedProjectCard({ entry, isMutating, onRemove }: {
  entry: { projectId: string; summary: any }
  isMutating: boolean
  onRemove: (id: string) => void
}) {
  const [shareOpen, setShareOpen] = useState(false)
  const summary = entry.summary
  if (!summary) return null

  const imageUrl = summary.primary_photo_url || "/placeholder.svg"
  const title = summary.title || "Project"
  const location = summary.location || null

  return (
    <>
      <Link href={summary.slug ? `/projects/${summary.slug}` : "#"} className="discover-card">
        <div className="discover-card-image-wrap">
          <div className="discover-card-image-layer">
            <img src={imageUrl} alt={title} />
          </div>
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
        {location && <p className="discover-card-sub">{location}</p>}
      </Link>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title={title}
        subtitle={location ?? ""}
        imageUrl={imageUrl}
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

  return (
    <main style={{ flex: 1 }}>
      <div className="discover-page-title">
        <div className="wrap">
          <h2 className="arco-section-title">Saved projects</h2>
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
                saved {savedProjects.length === 1 ? "project" : "projects"}
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
                />
              ))}
            </div>
          ) : (
            <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "80px 24px", textAlign: "center" }}>
              <h2 className="arco-section-title" style={{ marginBottom: 12 }}>No saved projects yet</h2>
              <p className="arco-body-text" style={{ marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                Save projects you love and they will appear here.
              </p>
              <Link href="/projects" className="btn-primary" style={{ fontSize: 14, padding: "10px 20px" }}>
                Discover projects
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
          <h2 className="arco-section-title">Saved professionals</h2>
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
                saved {savedProfessionals.length === 1 ? "professional" : "professionals"}
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
              <h2 className="arco-section-title" style={{ marginBottom: 12 }}>No saved professionals yet</h2>
              <p className="arco-body-text" style={{ marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                Save professionals you like and they will appear here.
              </p>
              <Link href="/professionals" className="btn-primary" style={{ fontSize: 14, padding: "10px 20px" }}>
                Discover professionals
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

const EditBadge = () => (
  <span className="ec-badge">
    <span className="ec-ico">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
      </svg>
    </span>
    <span className="ec-txt">Edit</span>
  </span>
)

export default function Homeowner() {
  return (
    <Suspense fallback={null}>
      <HomeownerContent />
    </Suspense>
  )
}
