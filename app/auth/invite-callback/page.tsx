"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Loader2 } from "lucide-react"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"

const parseHashParams = (hash: string) => {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash
  const params = new URLSearchParams(trimmed)
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    expiresIn: params.get("expires_in"),
    type: params.get("type"),
    error: params.get("error"),
    errorDescription: params.get("error_description"),
  }
}

export default function InviteCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"init" | "success" | "error">("init")
  const [message, setMessage] = useState<string>("Preparing your admin account…")

  const redirectTo = searchParams.get("redirectTo") ?? "/auth/admin-onboarding"
  const inviteType = searchParams.get("invite") ?? "admin"
  const invitedEmail = searchParams.get("email") ?? ""

  const callbackUrl = useMemo(() => {
    const url = new URL("/auth/callback", window.location.origin)
    url.searchParams.set("redirect_to", redirectTo)
    url.searchParams.set("invite", inviteType)
    if (invitedEmail) {
      url.searchParams.set("email", invitedEmail)
    }
    return url.toString()
  }, [inviteType, invitedEmail, redirectTo])

  useEffect(() => {
    const supabase = getBrowserSupabaseClient()
    const { accessToken, refreshToken, error, errorDescription } = parseHashParams(window.location.hash ?? "")

    if (error) {
      setStatus("error")
      setMessage(errorDescription ?? "Invite link is invalid or has expired.")
      const loginUrl = new URL("/login", window.location.origin)
      loginUrl.searchParams.set("error", "invite_invalid")
      loginUrl.searchParams.set("email", invitedEmail)
      setTimeout(() => router.replace(loginUrl.toString()), 2000)
      return
    }

    if (!accessToken || !refreshToken) {
      setStatus("error")
      setMessage("Invite link is missing required tokens. Request a new invitation.")
      const loginUrl = new URL("/login", window.location.origin)
      loginUrl.searchParams.set("error", "invite_missing_tokens")
      setTimeout(() => router.replace(loginUrl.toString()), 2000)
      return
    }

    void (async () => {
      try {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (sessionError) {
          setStatus("error")
          setMessage(sessionError.message ?? "Unable to activate the session.")
          const loginUrl = new URL("/login", window.location.origin)
          loginUrl.searchParams.set("error", "invite_session_failed")
          setTimeout(() => router.replace(loginUrl.toString()), 2000)
          return
        }

        setStatus("success")
        setMessage("Email confirmed. Redirecting to admin setup…")
        setTimeout(() => {
          router.replace(callbackUrl)
        }, 800)
      } catch (unexpectedError) {
        console.error("invite-callback error", unexpectedError)
        setStatus("error")
        setMessage("Unexpected error while processing the invite link.")
        const loginUrl = new URL("/login", window.location.origin)
        loginUrl.searchParams.set("error", "invite_unexpected_error")
        setTimeout(() => router.replace(loginUrl.toString()), 2000)
      }
    })()
  }, [callbackUrl, invitedEmail, router])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center bg-muted/30 px-4">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <h1 className="text-xl font-semibold">
            {status === "success" ? "Admin invite confirmed" : "Processing invitation"}
          </h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
