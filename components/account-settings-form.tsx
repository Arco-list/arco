"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { useTranslations } from "next-intl"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const AVATAR_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const AVATAR_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"])
const AVATAR_MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}
const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

interface ProfileFormState {
  firstName: string
  lastName: string
  email: string
}

interface PasswordFormState {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface AccountSettingsFormProps {
  className?: string
}

export function AccountSettingsForm({ className }: AccountSettingsFormProps) {
  const t = useTranslations("dashboard")
  const { user, profile, supabase, refreshSession, refreshProfile, isLoading } = useAuth()

  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    firstName: "",
    lastName: "",
    email: "",
  })
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeEditField, setActiveEditField] = useState<string | null>(null)

  const isEmailAuthUser = useMemo(() => {
    if (!user) return false
    const provider = user.app_metadata?.provider
    const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata?.providers : []
    return provider === "email" || providers?.includes("email") || Boolean(user.email)
  }, [user])

  const avatarFallback = useMemo(() => {
    const firstInitial = profileForm.firstName?.trim().charAt(0) ?? ""
    const lastInitial = profileForm.lastName?.trim().charAt(0) ?? ""
    const initials = `${firstInitial}${lastInitial}`.toUpperCase()
    if (initials) return initials
    const emailInitial = profileForm.email?.trim().charAt(0)?.toUpperCase()
    return emailInitial ?? "U"
  }, [profileForm.email, profileForm.firstName, profileForm.lastName])

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!file) return
    if (!user) { toast.error("You need to be signed in to update your profile photo"); return }
    if (!AVATAR_ALLOWED_MIME_TYPES.has(file.type)) { toast.error("Unsupported file type", { description: "Profile photos must be JPG, PNG, or WEBP images." }); return }
    if (file.size > AVATAR_MAX_SIZE_BYTES) { toast.error("File too large", { description: "Profile photos must be 5 MB or smaller." }); return }

    const extensionFromMime = AVATAR_MIME_TO_EXTENSION[file.type]
    const extensionFromName = file.name.split(".").pop()?.toLowerCase() ?? ""
    const extension = extensionFromMime ?? extensionFromName
    if (!extension || !AVATAR_ALLOWED_EXTENSIONS.has(extension)) { toast.error("Unsupported file type"); return }

    const uniqueId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    const objectKey = `${user.id}/${uniqueId}.${extension}`

    setIsUploadingAvatar(true)
    const previousStoragePath = profile?.avatar_storage_path ?? null

    try {
      const { error: uploadError } = await supabase.storage.from("profile-photos").upload(objectKey, file, { cacheControl: "3600", upsert: false, contentType: file.type })
      if (uploadError) { toast.error("Could not upload profile photo", { description: uploadError.message }); return }

      const { data: publicUrlData } = supabase.storage.from("profile-photos").getPublicUrl(objectKey)
      const publicUrl = publicUrlData?.publicUrl ? `${publicUrlData.publicUrl}?v=${Date.now()}` : null
      if (!publicUrl) { toast.error("Could not fetch profile photo URL"); void supabase.storage.from("profile-photos").remove([objectKey]); return }

      setAvatarPreview(publicUrl)
      const { error: profileError } = await supabase.from("profiles").update({ avatar_url: publicUrl, avatar_storage_path: objectKey, updated_at: new Date().toISOString() }).eq("id", user.id)
      if (profileError) { toast.error("Could not update profile photo", { description: profileError.message }); void supabase.storage.from("profile-photos").remove([objectKey]); return }

      if (previousStoragePath && previousStoragePath !== objectKey) {
        void supabase.storage.from("profile-photos").remove([previousStoragePath])
      }
      await refreshProfile()
      toast.success(t("settings_profile_photo_updated"))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error"
      toast.error("Could not update profile photo", { description: message })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleAvatarRemove = async () => {
    if (!user) { toast.error("You need to be signed in"); return }
    if (!profile?.avatar_url && !profile?.avatar_storage_path) { toast("No profile photo to remove"); return }

    setIsUploadingAvatar(true)
    try {
      if (profile?.avatar_storage_path) {
        await supabase.storage.from("profile-photos").remove([profile.avatar_storage_path])
      }
      const { error: profileError } = await supabase.from("profiles").update({ avatar_url: null, avatar_storage_path: null, updated_at: new Date().toISOString() }).eq("id", user.id)
      if (profileError) { toast.error("Could not remove profile photo", { description: profileError.message }); return }
      setAvatarPreview(null)
      await refreshProfile()
      toast.success(t("settings_profile_photo_removed"))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error"
      toast.error("Could not remove profile photo", { description: message })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  useEffect(() => {
    if (isLoading) return
    setProfileForm({ firstName: profile?.first_name ?? "", lastName: profile?.last_name ?? "", email: user?.email ?? "" })
  }, [isLoading, profile?.first_name, profile?.last_name, user?.email])

  useEffect(() => {
    if (profile?.avatar_url) setAvatarPreview(profile.avatar_url)
    else setAvatarPreview(null)
  }, [profile?.avatar_url])

  const handleNameBlur = (field: "firstName" | "lastName", value: string) => {
    setActiveEditField(null)
    const trimmed = value.trim()
    const current = field === "firstName" ? profile?.first_name ?? "" : profile?.last_name ?? ""
    if (trimmed === current) return

    setProfileForm(s => ({ ...s, [field]: trimmed }))
    // Auto-save name
    if (!user) return
    const updates: Record<string, string | null> = { updated_at: new Date().toISOString() }
    if (field === "firstName") updates.first_name = trimmed || null
    else updates.last_name = trimmed || null

    supabase.from("profiles").update(updates).eq("id", user.id).then(({ error }) => {
      if (error) toast.error(t("settings_could_not_update_name"))
      else { toast.success(t("settings_name_updated")); refreshProfile() }
    })
  }

  const handleEmailUpdate = async () => {
    const trimmed = newEmail.trim()
    if (!trimmed || !isValidEmail(trimmed)) { toast.error("Please enter a valid email address"); return }
    if (trimmed === user?.email) { toast(t("settings_no_change")); setEmailModalOpen(false); return }

    setIsSavingProfile(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed }, { emailRedirectTo: window.location.origin })
      if (error) { toast.error("Could not update email", { description: error.message }); return }
      toast.warning(t("settings_check_inbox"), { description: t("settings_confirm_email_change") })
      setEmailModalOpen(false)
      await refreshSession()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error"
      toast.error("Could not update email", { description: message })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user?.email) { toast.error("Password updates require an email-based account"); return }
    if (!isEmailAuthUser) { toast("Password managed by provider"); return }
    if (!passwordForm.currentPassword.trim()) { toast.error("Enter your current password"); return }
    if (passwordForm.newPassword.trim().length < 8) { toast.error("New password must be at least 8 characters"); return }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error("New passwords do not match"); return }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) { toast.error("Misconfigured Supabase credentials"); return }

    setIsSavingPassword(true)
    try {
      const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ email: user.email, password: passwordForm.currentPassword }),
      })
      if (!verifyResponse.ok) { toast.error("Current password is incorrect"); return }

      const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.newPassword })
      if (updateError) { toast.error("Unable to change password", { description: updateError.message }); return }

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      setPasswordModalOpen(false)
      await refreshSession()
      toast.success(t("settings_password_updated"))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error"
      toast.error("Unable to change password", { description: message })
    } finally {
      setIsSavingPassword(false)
    }
  }

  const displayName = [profileForm.firstName, profileForm.lastName].filter(Boolean).join(" ").trim()

  const authProvider = user?.app_metadata?.provider ?? "email"
  const connectedProviders = Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers as string[] : []

  return (
    <div className={cn("", className)}>
      {/* ── Header: Avatar + Name (matches company edit) ── */}
      <section className="professional-header">
        <div className="company-icon" onClick={() => fileInputRef.current?.click()} style={{ display: "inline-block", cursor: "pointer" }}>
          <Avatar style={{ width: 100, height: 100 }}>
            <AvatarImage src={avatarPreview ?? undefined} alt="Profile avatar" style={{ width: 100, height: 100 }} />
            <AvatarFallback style={{ width: 100, height: 100, fontSize: 32, fontWeight: 300 }}>{avatarFallback}</AvatarFallback>
          </Avatar>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarFileChange} />
        </div>

        {/* Editable first name + last name (inline, like company name) */}
        <div className={`ec${activeEditField === "name" ? " on" : ""}`}>
          <h1
            className="arco-page-title"
            contentEditable
            suppressContentEditableWarning
            onFocus={() => setActiveEditField("name")}
            onBlur={(e) => {
              const parts = (e.currentTarget.textContent ?? "").trim().split(/\s+/)
              const first = parts[0] ?? ""
              const last = parts.slice(1).join(" ")
              handleNameBlur("firstName", first)
              if (last || profileForm.lastName) {
                setProfileForm(s => ({ ...s, lastName: last }))
                if (user) {
                  supabase.from("profiles").update({ last_name: last || null, updated_at: new Date().toISOString() }).eq("id", user.id)
                }
              }
            }}
            data-placeholder={t("settings_your_name")}
          >
            {displayName || ""}
          </h1>
        </div>

        {/* Email badge — click to open email change popup (like service selector) */}
        <p
          className="professional-badge service-popup-badge"
          onClick={() => { setNewEmail(profileForm.email); setEmailModalOpen(true) }}
          style={{ cursor: "pointer" }}
        >
          {profileForm.email || t("settings_add_email")}
        </p>
      </section>

      {/* ── Detail bar ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 32,
        padding: "32px 0",
        borderTop: "1px solid #e8e8e6",
        borderBottom: "1px solid #e8e8e6",
      }}>
        <div style={{ textAlign: "center" }}>
          <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("settings_member_since")}</span>
          <p style={{ fontSize: 15, fontWeight: 300, margin: 0, color: "var(--arco-black)" }}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
          </p>
        </div>
        <div style={{ textAlign: "center" }}>
          <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("settings_sign_in_method")}</span>
          <p style={{ fontSize: 15, fontWeight: 300, margin: 0, color: "var(--arco-black)", textTransform: "capitalize" }}>
            {authProvider === "google" ? "Google" : authProvider === "email" ? t("settings_email_password") : authProvider}
          </p>
        </div>
        <div
          style={{ textAlign: "center", cursor: isEmailAuthUser ? "pointer" : "default" }}
          onClick={() => { if (isEmailAuthUser) setPasswordModalOpen(true) }}
        >
          <span className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("settings_password")}</span>
          {isEmailAuthUser ? (
            <p style={{ fontSize: 13, fontWeight: 300, margin: 0, color: "var(--primary)", cursor: "pointer" }}>
              {t("settings_update_password")}
            </p>
          ) : (
            <p style={{ fontSize: 15, fontWeight: 300, margin: 0, color: "var(--arco-mid-grey)" }}>
              {t("settings_managed_by", { provider: authProvider })}
            </p>
          )}
        </div>
      </div>

      {/* ── Actions row ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", padding: "24px 0" }}>
        {avatarPreview ? (
          <button
            type="button"
            onClick={handleAvatarRemove}
            disabled={isUploadingAvatar || isSavingProfile || isLoading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 13, fontWeight: 300, padding: 0,
              color: "var(--arco-mid-grey)", background: "none",
              border: "none", cursor: "pointer",
            }}
          >
            {t("settings_remove_photo")}
          </button>
        ) : null}
      </div>

      {/* ── Notification Preferences ── */}
      <section style={{ maxWidth: 600, margin: "48px auto 0" }}>
        <h2 className="arco-section-title" style={{ textAlign: "center", marginBottom: 12 }}>{t("settings_notifications_title")}</h2>
        <p className="arco-body-text" style={{ textAlign: "center", marginBottom: 32 }}>
          {t("settings_notifications_description")}
        </p>
        <div style={{ textAlign: "center" }}>
          <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)" }}>{t("settings_notifications_coming_soon")}</p>
        </div>
      </section>

      {/* ── Connected Accounts ── */}
      <section style={{ maxWidth: 600, margin: "48px auto 0" }}>
        <h2 className="arco-section-title" style={{ textAlign: "center", marginBottom: 12 }}>{t("settings_connected_accounts")}</h2>
        <p className="arco-body-text" style={{ textAlign: "center", marginBottom: 32 }}>
          {t("settings_connected_accounts_description")}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {connectedProviders.length > 0 ? connectedProviders.map(p => (
            <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--arco-rule)" }}>
              <span style={{ fontSize: 14, fontWeight: 400, textTransform: "capitalize" }}>{p === "google" ? "Google" : p}</span>
              <span style={{ fontSize: 12, color: "var(--arco-mid-grey)" }}>{t("settings_connected")}</span>
            </div>
          )) : (
            <p className="arco-body-text" style={{ textAlign: "center", color: "var(--arco-mid-grey)" }}>{t("settings_no_connected")}</p>
          )}
        </div>
      </section>

      {/* ── Delete Account (matches Delete Company design) ── */}
      <section style={{ maxWidth: 600, margin: "48px auto 0", paddingBottom: 60 }}>
        <hr style={{ border: "none", borderTop: "1px solid var(--arco-rule)", margin: "0 0 24px" }} />
        <button
          onClick={() => { setDeleteModalOpen(true); setDeleteConfirmText("") }}
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
          {t("settings_delete_account")}
        </button>
      </section>

      {/* ══════ Email Change Modal ══════ */}
      {emailModalOpen && (
        <div className="popup-overlay" onClick={() => setEmailModalOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{t("settings_update_email")}</h3>
              <button className="popup-close" onClick={() => setEmailModalOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 20 }}>
              {t("settings_update_email_description")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                  {t("settings_new_email")}
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleEmailUpdate() }}
                  placeholder="new@email.com"
                  autoFocus
                  style={{ marginBottom: 0 }}
                />
              </div>
              <button
                onClick={handleEmailUpdate}
                disabled={isSavingProfile || !newEmail.trim()}
                className="btn-primary"
                style={{ width: "100%", marginTop: 4, fontSize: 14, padding: "12px 20px" }}
              >
                {isSavingProfile ? t("settings_updating") : t("settings_update_email")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Password Change Modal ══════ */}
      {passwordModalOpen && (
        <div className="popup-overlay" onClick={() => setPasswordModalOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{t("settings_update_password")}</h3>
              <button className="popup-close" onClick={() => setPasswordModalOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 20 }}>
              {t("settings_update_password_description")}
            </p>
            <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                  {t("settings_current_password")}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm(s => ({ ...s, currentPassword: e.target.value }))}
                  placeholder={t("settings_enter_current_password")}
                  autoFocus
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                  {t("settings_new_password")}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm(s => ({ ...s, newPassword: e.target.value }))}
                  placeholder={t("settings_at_least_8_chars")}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                  {t("settings_confirm_password")}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm(s => ({ ...s, confirmPassword: e.target.value }))}
                  placeholder={t("settings_confirm_new_password")}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <button
                type="submit"
                disabled={isSavingPassword}
                className="btn-primary"
                style={{ width: "100%", marginTop: 4, fontSize: 14, padding: "12px 20px" }}
              >
                {isSavingPassword ? t("settings_updating") : t("settings_update_password")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════ Delete Account Modal — matches Delete Project design ══════ */}
      {deleteModalOpen && (
        <div className="popup-overlay" onClick={() => { if (!isDeletingAccount) { setDeleteModalOpen(false); setDeleteConfirmText("") } }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{t("settings_delete_account")}</h3>
              <button type="button" className="popup-close" onClick={() => { setDeleteModalOpen(false); setDeleteConfirmText("") }} aria-label="Close">
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13, fontWeight: 300, color: "var(--arco-light)", margin: "0 0 16px" }}>
              {t("settings_delete_description")}
            </p>

            <div className="arco-alert arco-alert--danger">
              <AlertTriangle className="arco-alert-icon" />
              <span>{t("settings_delete_warning")}</span>
            </div>

            <div className="arco-alert arco-alert--warn">
              <AlertTriangle className="arco-alert-icon" />
              <span>{t("settings_delete_warning_secondary")}</span>
            </div>

            <p className="body-small text-text-secondary mb-3">
              {t.rich("settings_delete_confirm", { strong: (chunks) => <strong>{chunks}</strong> })}
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 text-sm border border-border rounded-[3px] mb-4 focus:outline-none focus:border-foreground"
            />

            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => { setDeleteModalOpen(false); setDeleteConfirmText("") }}
                disabled={isDeletingAccount}
                style={{ flex: 1 }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
                onClick={async () => {
                  setIsDeletingAccount(true)
                  // Account deletion would need a server action
                  toast.error(t("settings_delete_unavailable"))
                  setIsDeletingAccount(false)
                }}
                className={`flex-1 font-normal py-3 px-4 border-none rounded-[3px] cursor-pointer transition-opacity ${
                  deleteConfirmText === "DELETE"
                    ? "bg-red-600 text-white"
                    : "bg-surface text-text-secondary"
                } ${isDeletingAccount ? "opacity-60" : ""}`}
                style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 15 }}
              >
                {isDeletingAccount ? t("settings_deleting") : t("settings_delete_account")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
