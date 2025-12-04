"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

interface UpdatePasswordProps {
  heading?: string
  logo: {
    url: string
    src: string
    alt: string
    title?: string
  }
  buttonText?: string
  loginUrl?: string
  description?: string
}

const UpdatePassword = ({
  heading = "Update Password",
  logo = {
    url: "/",
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg",
    alt: "Arco Logo",
    title: "Arco",
  },
  buttonText = "Update Password",
  loginUrl = "/login",
  description = "Enter your new password below.",
}: UpdatePasswordProps) => {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { supabase } = useAuth()

  // Check if user has a valid session from the reset link
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error("Invalid or expired reset link", {
          description: "Please request a new password reset link",
        })
        router.push("/reset-password")
      }
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
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        toast.error("Failed to update password", {
          description: error.message,
        })
        setIsLoading(false)
      } else {
        toast.success("Password updated successfully", {
          description: "Redirecting to your dashboard...",
        })

        // User is already logged in after password reset, redirect to dashboard
        setTimeout(() => {
          router.push("/dashboard")
        }, 1000)
      }
    } catch (error) {
      toast.error("Something went wrong", {
        description: "Please try again later",
      })
      setIsLoading(false)
    }
  }

  return (
    <section className="bg-background h-screen">
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-6 lg:justify-start">
          <Link href={logo.url}>
            <img src={logo.src || "/placeholder.svg"} alt={logo.alt} title={logo.title} className="h-10 dark:invert" />
          </Link>
          <form
            onSubmit={handleSubmit}
            className="min-w-sm border-border bg-background flex w-full max-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md"
          >
            <h3 className="heading-3">{heading}</h3>
            <p className="body-small text-muted-foreground text-center">{description}</p>
            <Input
              type="password"
              placeholder="New Password"
              className="text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
            <Input
              type="password"
              placeholder="Confirm Password"
              className="text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
            <Button type="submit" variant="secondary" className="w-full" disabled={isLoading}>
              {isLoading ? "Updating..." : buttonText}
            </Button>
          </form>
          <div className="body-small text-muted-foreground flex justify-center gap-1">
            <p>Remember your password?</p>
            <Link href={loginUrl} className="text-primary font-medium hover:underline">
              Login
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export { UpdatePassword }
