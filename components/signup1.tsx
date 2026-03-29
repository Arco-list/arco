"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useState } from "react"
import { Check, X } from "lucide-react"
import { useTranslations } from "next-intl"

interface Signup1Props {
  heading?: string
  logo: {
    url: string
    src: string
    alt: string
    title?: string
  }
  buttonText?: string
  googleText?: string
  signupText?: string
  signupUrl?: string
}

const Signup1 = ({
  logo = {
    url: "https://www.shadcnblocks.com",
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblockscom-wordmark.svg",
    alt: "logo",
    title: "shadcnblocks.com",
  },
  signupUrl = "https://shadcnblocks.com",
}: Signup1Props) => {
  const [password, setPassword] = useState("")
  const t = useTranslations("auth")

  const hasMinLength = password.length >= 7
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  const hasNumber = /\d/.test(password)

  const isPasswordValid = hasMinLength && hasSymbol && hasNumber

  return (
    <section className="bg-background h-screen">
      <div className="flex h-full items-center justify-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-6 lg:justify-start">
          <Link href={logo.url}>
            <img src={logo.src || "/placeholder.svg"} alt={logo.alt} title={logo.title} className="h-10 dark:invert" />
          </Link>
          <div className="min-w-sm border-border bg-background flex w-full max-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md">
            <h3>{t("signup")}</h3>
            <Input type="email" placeholder={t("email")} className="text-sm" required />
            <div className="w-full space-y-2">
              <Input
                type="password"
                placeholder={t("password")}
                className="text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {password && (
                <div className="text-xs space-y-1 px-1">
                  <div className="flex items-center gap-2">
                    {hasMinLength ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <X className="h-3 w-3 text-red-500" />
                    )}
                    <span className={hasMinLength ? "text-green-600" : "text-red-500"}>{t("at_least_7_chars")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasSymbol ? <Check className="h-3 w-3 text-green-600" /> : <X className="h-3 w-3 text-red-500" />}
                    <span className={hasSymbol ? "text-green-600" : "text-red-500"}>{t("at_least_1_symbol")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasNumber ? <Check className="h-3 w-3 text-green-600" /> : <X className="h-3 w-3 text-red-500" />}
                    <span className={hasNumber ? "text-green-600" : "text-red-500"}>{t("at_least_1_number")}</span>
                  </div>
                </div>
              )}
            </div>
            <Button type="submit" variant="secondary" size="sm" className="w-full" disabled={!isPasswordValid}>
              {t("create_account")}
            </Button>
          </div>
          <div className="text-muted-foreground flex justify-center gap-1 text-sm">
            <p>{t("already_user")}</p>
            <Link href={signupUrl} className="text-primary font-medium hover:underline">
              {t("login")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export { Signup1 }
