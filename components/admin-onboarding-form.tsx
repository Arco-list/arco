"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"

const MIN_PASSWORD_LENGTH = 12

type AdminOnboardingFormProps = {
  email: string | null
  redirectTo: string
}

const maskEmail = (email: string | null) => {
  if (!email) return ""
  const [local, domain] = email.split("@")
  if (!local || !domain) return email
  const visible = local.slice(0, 2)
  return `${visible}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`
}

export function AdminOnboardingForm({ email, redirectTo }: AdminOnboardingFormProps) {
  const { supabase, refreshSession } = useAuth()
  const router = useRouter()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const maskedEmail = useMemo(() => maskEmail(email), [email])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setError(null)

      const trimmedPassword = password.trim()
      const trimmedConfirm = confirmPassword.trim()

      if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
        return
      }

      if (trimmedPassword !== trimmedConfirm) {
        setError("Passwords do not match.")
        return
      }

      setIsSubmitting(true)
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          password: trimmedPassword,
        })

        if (updateError) {
          setError(updateError.message ?? "Unable to set password. Please try again.")
          toast.error("Could not save password", {
            description: updateError.message,
          })
          return
        }

        await refreshSession()
        setSuccess(true)
        toast.success("Password saved", {
          description: "You can now access the admin portal.",
        })

        setTimeout(() => {
          router.replace(redirectTo)
        }, 1200)
      } catch (submitError) {
        console.error(submitError)
        const message = submitError instanceof Error ? submitError.message : "Unexpected error"
        setError(message)
        toast.error("Could not save password", {
          description: message,
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [confirmPassword, password, redirectTo, refreshSession, router, supabase.auth],
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <h1 className="heading-3">Welcome to the Arco admin portal</h1>
        <p className="body-small text-muted-foreground">
          {maskedEmail ? `Account verified for ${maskedEmail}.` : "Your admin account has been verified."} Choose a strong
          password to finish setup and access the dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="new-password"
            value={password}
            minLength={MIN_PASSWORD_LENGTH}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter a secure password"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-password-confirm">Confirm password</Label>
          <Input
            id="admin-password-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            minLength={MIN_PASSWORD_LENGTH}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter your password"
            required
          />
        </div>

        <ul className="body-small space-y-1 rounded-lg bg-muted/60 p-3 text-muted-foreground">
          <li>• Use at least {MIN_PASSWORD_LENGTH} characters.</li>
          <li>• Combine uppercase, lowercase, numbers, and symbols.</li>
          <li>• Avoid reusing passwords from other services.</li>
        </ul>

        {error ? <p className="body-small font-medium text-destructive">{error}</p> : null}
        {success ? <p className="body-small font-medium text-green-600">Password saved — redirecting…</p> : null}

        <Button type="submit" variant="secondary" size="sm" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save password and continue"}
        </Button>
      </form>

      <div className="body-small rounded-xl border border-border bg-muted/30 p-4 text-muted-foreground">
        <p className="font-medium text-foreground">Need help?</p>
        <p>
          If the browser says the link expired, ask an existing super admin to resend the invitation and try again within one
          hour of receiving it.
        </p>
      </div>
    </div>
  )
}
