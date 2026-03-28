"use client"

import { useLocale } from "next-intl"
import { usePathname, useRouter } from "next/navigation"
import { routing } from "@/i18n/routing"

export function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const switchLocale = (newLocale: string) => {
    // Remove current locale prefix if present
    let path = pathname
    for (const l of routing.locales) {
      if (path.startsWith(`/${l}/`)) {
        path = path.slice(l.length + 1)
        break
      }
      if (path === `/${l}`) {
        path = "/"
        break
      }
    }

    // Add new locale prefix (skip for default locale)
    const newPath = newLocale === routing.defaultLocale ? path : `/${newLocale}${path}`
    router.push(newPath)
  }

  return (
    <button
      type="button"
      onClick={() => switchLocale(locale === "nl" ? "en" : "nl")}
      className="text-sm font-normal transition-colors"
      style={{
        padding: "4px 8px",
        borderRadius: 3,
        border: "none",
        background: "none",
        cursor: "pointer",
        color: "inherit",
        opacity: 0.6,
      }}
      title={locale === "nl" ? "Switch to English" : "Schakel naar Nederlands"}
    >
      {locale === "nl" ? "EN" : "NL"}
    </button>
  )
}
