"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const AVATAR_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const AVATAR_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"])
const AVATAR_MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}
const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024

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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

    if (initials) {
      return initials
    }

    const emailInitial = profileForm.email?.trim().charAt(0)?.toUpperCase()
    return emailInitial ?? "U"
  }, [profileForm.email, profileForm.firstName, profileForm.lastName])

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ""

    if (!file) return

    if (!user) {
      toast.error("You need to be signed in to update your profile photo")
      return
    }

    if (!AVATAR_ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error("Unsupported file type", {
        description: "Profile photos must be JPG, PNG, or WEBP images.",
      })
      return
    }

    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      toast.error("File too large", {
        description: "Profile photos must be 5 MB or smaller.",
      })
      return
    }

    const extensionFromMime = AVATAR_MIME_TO_EXTENSION[file.type]
    const extensionFromName = file.name.split(".").pop()?.toLowerCase() ?? ""
    const extension = extensionFromMime ?? extensionFromName

    if (!extension || !AVATAR_ALLOWED_EXTENSIONS.has(extension)) {
      toast.error("Unsupported file type", {
        description: "Profile photos must be JPG, PNG, or WEBP images.",
      })
      return
    }

    const uniqueId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    const objectKey = `${user.id}/${uniqueId}.${extension}`

    setIsUploadingAvatar(true)

    const previousStoragePath = profile?.avatar_storage_path ?? null

    try {
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(objectKey, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) {
        toast.error("Could not upload profile photo", {
          description: uploadError.message,
        })
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(objectKey)

      const publicUrl = publicUrlData?.publicUrl ? `${publicUrlData.publicUrl}?v=${Date.now()}` : null

      if (!publicUrl) {
        toast.error("Could not fetch profile photo URL")
        void supabase.storage.from("profile-photos").remove([objectKey])
        return
      }

      setAvatarPreview(publicUrl)

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_url: publicUrl,
          avatar_storage_path: objectKey,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (profileError) {
        toast.error("Could not update profile photo", {
          description: profileError.message,
        })
        void supabase.storage.from("profile-photos").remove([objectKey])
        return
      }

      if (previousStoragePath && previousStoragePath !== objectKey) {
        void supabase.storage.from("profile-photos").remove([previousStoragePath])
      }

      await refreshProfile()
      toast.success("Profile photo updated")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error"
      toast.error("Could not update profile photo", { description: message })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleAvatarRemove = async () => {
    if (!user) {
      toast.error("You need to be signed in to update your profile photo")
      return
    }

    if (!profile?.avatar_url && !profile?.avatar_storage_path) {
      toast("No profile photo to remove", {
        description: "Upload a photo before removing it.",
      })
      return
    }

    setIsUploadingAvatar(true)

    try {
      if (profile?.avatar_storage_path) {
        const { error: storageError } = await supabase.storage
          .from("profile-photos")
          .remove([profile.avatar_storage_path])

        if (storageError) {
          console.error(storageError)
        }
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_url: null,
          avatar_storage_path: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (profileError) {
        toast.error("Could not remove profile photo", {
          description: profileError.message,
        })
        return
      }

      setAvatarPreview(null)
      await refreshProfile()
      toast.success("Profile photo removed")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error"
      toast.error("Could not remove profile photo", { description: message })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  useEffect(() => {
    if (isLoading) return

    setProfileForm({
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      email: user?.email ?? "",
    })
  }, [isLoading, profile?.first_name, profile?.last_name, user?.email])

  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarPreview(profile.avatar_url)
    } else {
      setAvatarPreview(null)
    }
  }, [profile?.avatar_url])

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      toast.error("You need to be signed in to update your profile")
      return
    }

    const trimmedFirstName = profileForm.firstName.trim()
    const trimmedLastName = profileForm.lastName.trim()
    const trimmedEmail = profileForm.email.trim()

    const currentFirstName = profile?.first_name ?? ""
    const currentLastName = profile?.last_name ?? ""
    const currentEmail = user.email ?? ""

    const hasProfileChanges =
      trimmedFirstName !== currentFirstName || trimmedLastName !== currentLastName
    const hasEmailChange = trimmedEmail !== currentEmail

    if (!hasProfileChanges && !hasEmailChange) {
      toast("No changes to save", {
        description: "Update your profile details before submitting.",
      })
      return
    }

    if (!trimmedEmail) {
      toast.error("Email is required")
      return
    }

    setIsSavingProfile(true)

    try {
      if (hasProfileChanges) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              first_name: trimmedFirstName || null,
              last_name: trimmedLastName || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )

        if (profileError) {
          toast.error("Could not update profile", {
            description: profileError.message,
          })
          return
        }
      }

      const shouldUpdateAuth = hasEmailChange || hasProfileChanges

      if (shouldUpdateAuth) {
        const authPayload: {
          email?: string
          data?: Record<string, string | null>
        } = {}

        if (hasEmailChange) {
          authPayload.email = trimmedEmail
        }

        if (hasProfileChanges) {
          authPayload.data = {
            first_name: trimmedFirstName || null,
            last_name: trimmedLastName || null,
          }
        }

        const { error: authError } = await supabase.auth.updateUser(authPayload)

        if (authError) {
          toast.error("Could not update account", {
            description: authError.message,
          })
          return
        }

        if (hasEmailChange) {
          toast.warning("Check your inbox", {
            description: "Confirm the email change to complete the update.",
          })
        }
      }

      await refreshSession()

      setProfileForm({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
      })

      if (!hasEmailChange) {
        toast.success("Profile updated")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error"
      toast.error("Could not update profile", { description: message })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user?.email) {
      toast.error("Password updates require an email-based account")
      return
    }

    if (!isEmailAuthUser) {
      toast("Password managed by provider", {
        description: "Update your password with your single sign-on provider.",
      })
      return
    }

    if (!passwordForm.currentPassword.trim()) {
      toast.error("Enter your current password")
      return
    }

    if (passwordForm.newPassword.trim().length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      toast.error("Misconfigured Supabase credentials", {
        description: "Contact support to update your password.",
      })
      return
    }

    setIsSavingPassword(true)

    try {
      const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: user.email,
          password: passwordForm.currentPassword,
        }),
      })

      if (!verifyResponse.ok) {
        const payload = (await verifyResponse.json().catch(() => null)) as
          | { error?: string; error_description?: string }
          | null
        const reason = payload?.error_description ?? payload?.error ?? "Current password is incorrect"
        toast.error("Current password is incorrect", {
          description: reason,
        })
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      })

      if (updateError) {
        toast.error("Unable to change password", {
          description: updateError.message,
        })
        return
      }

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      await refreshSession()
      toast.success("Password updated")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error"
      toast.error("Unable to change password", { description: message })
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div className={cn("max-w-2xl", className)}>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-xl font-medium">Profile Information</CardTitle>
          <CardDescription>Update your personal information and contact details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label>Profile Photo</Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarPreview ?? undefined} alt="Profile avatar" />
                  <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar || isSavingProfile || isLoading}
                    >
                      {isUploadingAvatar ? "Uploading..." : "Upload Photo"}
                    </Button>
                    {avatarPreview ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleAvatarRemove}
                        disabled={isUploadingAvatar || isSavingProfile || isLoading}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG, or WEBP up to 5 MB.</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={profileForm.firstName}
                  onChange={(event) =>
                    setProfileForm((state) => ({ ...state, firstName: event.target.value }))
                  }
                  placeholder="Enter your first name"
                  disabled={isLoading || isSavingProfile}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={profileForm.lastName}
                  onChange={(event) =>
                    setProfileForm((state) => ({ ...state, lastName: event.target.value }))
                  }
                  placeholder="Enter your last name"
                  disabled={isLoading || isSavingProfile}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profileForm.email}
                onChange={(event) =>
                  setProfileForm((state) => ({ ...state, email: event.target.value }))
                }
                placeholder="Enter your email address"
                disabled={isLoading || isSavingProfile}
              />
            </div>

            <Button
              type="submit"
              className="w-full md:w-auto"
              disabled={isSavingProfile || isUploadingAvatar}
            >
              {isSavingProfile ? "Saving..." : "Update Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-medium">Change Password</CardTitle>
          <CardDescription>Update your password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((state) => ({ ...state, currentPassword: event.target.value }))
                }
                placeholder="Enter your current password"
                disabled={isSavingPassword || isLoading || !isEmailAuthUser}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((state) => ({ ...state, newPassword: event.target.value }))
                }
                placeholder="Enter your new password"
                disabled={isSavingPassword || isLoading || !isEmailAuthUser}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((state) => ({ ...state, confirmPassword: event.target.value }))
                }
                placeholder="Confirm your new password"
                disabled={isSavingPassword || isLoading || !isEmailAuthUser}
              />
            </div>

            <Button
              type="submit"
              className="w-full md:w-auto"
              disabled={isSavingPassword || !isEmailAuthUser}
            >
              {isSavingPassword ? "Updating..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
