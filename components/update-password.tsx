"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

interface UpdatePasswordProps {
  logo: {
    url: string
    src: string
    alt: string
    title?: string
  }
  loginUrl?: string
}

const UpdatePassword = ({
  logo = {
    url: "/",
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg",
    alt: "Arco Logo",
    title: "Arco",
  },
  loginUrl = "/login",
}: UpdatePasswordProps) => {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { supabase } = useAuth()
  const t = useTranslations("auth")

  // Check if user has a valid session from the reset link
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error(t("invalid_reset_link"), {
          description: t("request_new_reset"),
        })
        router.push("/reset-password")
      }
    }

    checkSession()
  }, [supabase, router, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password.trim()) {
      toast.error(t("please_enter_password"))
      return
    }

    if (password.length < 6) {
      toast.error(t("password_min_length"))
      return
    }

    if (password !== confirmPassword) {
      toast.error(t("passwords_no_match"))
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        toast.error(t("failed_update_password"), {
          description: error.message,
        })
        setIsLoading(false)
      } else {
        toast.success(t("password_updated"), {
          description: t("redirecting_dashboard"),
        })

        // User is already logged in after password reset, redirect to dashboard
        setTimeout(() => {
          router.push("/dashboard")
        }, 1000)
      }
    } catch (error) {
      toast.error(t("something_went_wrong"), {
        description: t("try_again_later"),
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
            <h3 className="heading-3">{t("update_password")}</h3>
            <p className="body-small text-muted-foreground text-center">{t("update_password_description")}</p>
            <Input
              type="password"
              placeholder={t("new_password")}
              className="text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
            <Input
              type="password"
              placeholder={t("confirm_password")}
              className="text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
            <Button type="submit" variant="secondary" className="w-full" disabled={isLoading}>
              {isLoading ? t("updating") : t("update_password")}
            </Button>
          </form>
          <div className="body-small text-muted-foreground flex justify-center gap-1">
            <p>{t("remember_password")}</p>
            <Link href={loginUrl} className="text-primary font-medium hover:underline">
              {t("login")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export { UpdatePassword }
