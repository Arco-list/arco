"use client"

import { useState, useRef, useEffect } from "react"
import { useLocale } from "next-intl"
import { Globe } from "lucide-react"
import { routing } from "@/i18n/routing"
import { FlagNL, FlagGB } from "@/components/flag-icons"

const languages = [
  { code: "nl", label: "Nederlands" },
  { code: "en", label: "English" },
] as const

const flags: Record<string, React.ReactNode> = {
  nl: <FlagNL size={18} />,
  en: <FlagGB size={18} />,
}

export function LanguageSwitcher() {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const switchLocale = (newLocale: string) => {
    // Use window.location.pathname for the real browser URL
    let path = window.location.pathname

    // Strip current locale prefix
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

    // Navigate with new locale prefix
    window.location.href = `/${newLocale}${path}`
  }

  const current = languages.find((l) => l.code === locale)

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-sm font-normal transition-colors flex items-center gap-1.5"
        style={{
          padding: "4px 8px",
          borderRadius: 3,
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "inherit",
          opacity: 0.6,
        }}
      >
        <Globe size={14} />
        {current?.label}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            right: 0,
            marginBottom: 4,
            background: "#232321",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: "4px 0",
            minWidth: 140,
            zIndex: 50,
          }}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => switchLocale(lang.code)}
              className="text-sm transition-colors"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                textAlign: "left",
                padding: "8px 14px",
                border: "none",
                background: lang.code === locale ? "rgba(255,255,255,0.06)" : "none",
                color: lang.code === locale ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.45)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  lang.code === locale ? "rgba(255,255,255,0.06)" : "transparent")
              }
            >
              {flags[lang.code]}
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
