"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useTranslations } from "next-intl"

interface Login1Props {
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

const Login1 = ({
  logo = {
    url: "https://www.shadcnblocks.com",
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblockscom-wordmark.svg",
    alt: "logo",
    title: "shadcnblocks.com",
  },
  signupUrl = "https://shadcnblocks.com",
}: Login1Props) => {
  const t = useTranslations("auth")
  return (
    <section className="bg-background h-screen">
      <div className="flex h-full items-center justify-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-6 lg:justify-start">
          <Link href={logo.url}>
            <img src={logo.src || "/placeholder.svg"} alt={logo.alt} title={logo.title} className="h-10 dark:invert" />
          </Link>
          <div className="min-w-sm border-border bg-background flex w-full max-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md">
            <h3>{t("login")}</h3>
            <Input type="email" placeholder={t("email")} className="text-sm" required />
            <Input type="password" placeholder={t("password")} className="text-sm" required />
            <Button type="submit" variant="secondary" className="w-full">
              {t("login")}
            </Button>
            <div className="text-center">
              <Link href="/reset-password" className="text-primary text-sm font-medium hover:underline">
                {t("forgot_your_password")}
              </Link>
            </div>
          </div>
          <div className="text-muted-foreground flex justify-center gap-1 text-sm">
            <p>{t("need_account")}</p>
            <Link href={signupUrl} className="text-primary font-medium hover:underline">
              {t("sign_up")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export { Login1 }
