"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useState } from "react"
import { resetPasswordAction } from "@/app/(auth)/actions"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

interface ResetPassword1Props {
  logo: {
    url: string
    src: string
    alt: string
    title?: string
  }
  loginUrl?: string
}

const ResetPassword1 = ({
  logo = {
    url: "/",
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg",
    alt: "Arco Logo",
    title: "Arco",
  },
  loginUrl = "/login",
}: ResetPassword1Props) => {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const t = useTranslations("auth")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error(t("please_enter_email"))
      return
    }

    setIsLoading(true)

    try {
      const result = await resetPasswordAction(email)

      if (result.error) {
        toast.error(t("failed_send_reset"), {
          description: result.error.message,
        })
        setIsLoading(false)
      } else {
        setIsSubmitted(true)
      }
    } catch (error) {
      toast.error(t("something_went_wrong"), {
        description: t("try_again_later"),
      })
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <section className="bg-background h-screen">
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-6 lg:justify-start">
            <Link href={logo.url}>
              <img
                src={logo.src || "/placeholder.svg"}
                alt={logo.alt}
                title={logo.title}
                className="h-10 dark:invert"
              />
            </Link>
            <div className="min-w-sm border-border bg-background flex w-full max-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md text-center">
              <h3 className="heading-3">{t("check_your_email")}</h3>
              <p className="body-small text-muted-foreground">{t("reset_link_sent", { email })}</p>
              <Button asChild variant="secondary" className="w-full">
                <Link href={loginUrl}>{t("back_to_login")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    )
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
            <h3 className="heading-3">{t("reset_password")}</h3>
            <p className="body-small text-muted-foreground text-center">{t("reset_description")}</p>
            <Input
              type="email"
              placeholder={t("email")}
              className="text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
            <Button type="submit" variant="secondary" className="w-full" disabled={isLoading}>
              {isLoading ? t("sending") : t("send_reset_link")}
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

export { ResetPassword1 }
