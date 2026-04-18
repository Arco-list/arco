"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

export function UpdatePassword() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const router = useRouter()
  const { supabase } = useAuth()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error("Invalid or expired reset link", {
          description: "Please request a new password reset.",
        })
        router.push("/")
        return
      }
      setHasSession(true)
    }
    checkSession()
  }, [supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password.trim()) {
      toast.error("Please enter a password")
      return
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        toast.error("Failed to update password", { description: error.message })
        setIsLoading(false)
      } else {
        toast.success("Password updated")
        router.push("/dashboard")
      }
    } catch {
      toast.error("Something went wrong", { description: "Please try again." })
      setIsLoading(false)
    }
  }

  if (!hasSession) return null

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--arco-off-white)", padding: "20px" }}>
      <div className="popup-card" style={{ maxWidth: 440, padding: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "20px 28px",
            background: "var(--arco-off-white)", borderRadius: "12px 12px 0 0", flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 500, color: "var(--arco-black)", fontFamily: "Georgia, 'Times New Roman', serif", margin: 0 }}>
            Set new password
          </h2>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px 32px" }}>
          <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 24, textAlign: "center" }}>
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                New password
              </label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                autoFocus
                required
                minLength={6}
                disabled={isLoading}
                style={{ marginBottom: 0 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                Confirm password
              </label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
                minLength={6}
                disabled={isLoading}
                style={{ marginBottom: 0 }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !password.trim() || !confirmPassword.trim()}
              className="btn-primary"
              style={{ width: "100%", fontSize: 14, padding: "12px 20px" }}
            >
              {isLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
