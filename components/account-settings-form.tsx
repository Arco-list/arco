"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

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
  const { user, profile, supabase, refreshSession, isLoading } = useAuth()

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

  const isEmailAuthUser = useMemo(() => {
    if (!user) return false

    const provider = user.app_metadata?.provider
    const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata?.providers : []

    return provider === "email" || providers?.includes("email") || Boolean(user.email)
  }, [user])

  useEffect(() => {
    if (isLoading) return

    setProfileForm({
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      email: user?.email ?? "",
    })
  }, [isLoading, profile?.first_name, profile?.last_name, user?.email])

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

    setIsSavingPassword(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.currentPassword,
      })

      if (signInError) {
        toast.error("Current password is incorrect")
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

            <Button type="submit" className="w-full md:w-auto" disabled={isSavingProfile}>
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
