"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useTranslations } from "next-intl"
import { getUserCompaniesAction, switchCompanyAction } from "@/app/dashboard/company/actions"

type Company = { id: string; name: string; logo_url: string | null; role: "owner" | "member" }

export function CompanySwitcher() {
  const router = useRouter()
  const t = useTranslations("dashboard")
  const [companies, setCompanies] = useState<Company[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [switching, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  // Load companies on first render
  useEffect(() => {
    getUserCompaniesAction()
      .then(({ companies: c, activeId: id }) => {
        console.log("[CompanySwitcher] loaded", c.length, "companies, activeId:", id)
        setCompanies(c)
        setActiveId(id)
        setLoaded(true)
      })
      .catch((err) => {
        console.error("[CompanySwitcher] failed to load companies:", err)
        setLoaded(true)
      })
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleSwitch = useCallback((companyId: string) => {
    setOpen(false)
    startTransition(async () => {
      const result = await switchCompanyAction(companyId)
      if (result.success) {
        setActiveId(companyId)
        router.refresh()
      } else {
        toast.error(result.error ?? t("could_not_switch_company"))
      }
    })
  }, [router])

  // Don't render if no companies
  if (!loaded || companies.length === 0) return null

  const active = companies.find((c) => c.id === activeId) ?? companies[0]

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex items-center gap-2 h-8 rounded-full border px-3 border-border hover:bg-surface text-sm font-medium"
        style={{ opacity: switching ? 0.6 : 1 }}
      >
        {active.logo_url ? (
          <img src={active.logo_url} alt="" className="w-4 h-4 rounded-full object-cover" />
        ) : (
          <span className="w-4 h-4 rounded-full bg-surface flex items-center justify-center text-[9px] font-semibold text-text-secondary">
            {active.name.charAt(0)}
          </span>
        )}
        <span className="max-w-[120px] truncate">{active.name}</span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-50 w-56 rounded-md border border-border bg-white shadow-lg py-1">
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => c.id !== activeId && handleSwitch(c.id)}
              className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-surface ${
                c.id === activeId ? "font-medium text-foreground" : "text-text-secondary"
              }`}
            >
              {c.logo_url ? (
                <img src={c.logo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-surface flex items-center justify-center text-[10px] font-semibold text-text-secondary">
                  {c.name.charAt(0)}
                </span>
              )}
              <span className="truncate flex-1">{c.name}</span>
              {c.id === activeId && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 8l4 4 6-7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
