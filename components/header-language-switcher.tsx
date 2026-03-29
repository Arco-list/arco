"use client"

import { useState, useRef, useEffect } from "react"
import { useLocale } from "next-intl"
import { Globe } from "lucide-react"
import { routing } from "@/i18n/routing"
import { FlagNL, FlagGB } from "@/components/flag-icons"

const languages = [
  { code: "nl", label: "Nederlands", short: "NL" },
  { code: "en", label: "English", short: "EN" },
] as const

const flags: Record<string, React.ReactNode> = {
  nl: <FlagNL size={18} />,
  en: <FlagGB size={18} />,
}

export function HeaderLanguageSwitcher({ isLight }: { isLight?: boolean }) {
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
    let path = window.location.pathname
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
    window.location.href = `/${newLocale}${path}`
  }

  const current = languages.find((l) => l.code === locale)

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-center gap-1.5 h-8 text-sm font-normal transition-opacity hover:opacity-70 ${
          isLight ? "text-white" : "text-black"
        }`}
        style={{
          border: "none",
          background: "none",
          cursor: "pointer",
          opacity: 0.6,
        }}
        aria-label="Switch language"
      >
        <Globe size={14} />
        {current?.short}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 6,
            padding: "4px 0",
            minWidth: 160,
            zIndex: 50,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
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
                background: lang.code === locale ? "rgba(0,0,0,0.04)" : "transparent",
                color: lang.code === locale ? "#111" : "#666",
                fontWeight: lang.code === locale ? 500 : 400,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.06)")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  lang.code === locale ? "rgba(0,0,0,0.04)" : "transparent")
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
