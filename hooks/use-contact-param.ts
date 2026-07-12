"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * Reads/writes the shared `?contact=<email>` URL param that drives the
 * Contact Card slide-over. Phase 1 mount point is /admin/sales; the
 * hook is deliberately page-agnostic so /admin/companies and /admin/users
 * can reuse the same shell without inventing a second convention.
 *
 * Values are normalized to lowercase-trimmed on write so a manual
 * URL edit (or a share link from Slack) reaches the same contact
 * record as a row click.
 */
export function useContactParam(): {
  email: string | null
  open: (email: string) => void
  close: () => void
} {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const raw = params.get("contact")
  const email = useMemo(() => (raw ? normalize(raw) : null), [raw])

  const open = useCallback(
    (next: string) => {
      const normalized = normalize(next)
      if (!normalized) return
      const search = new URLSearchParams(params.toString())
      search.set("contact", normalized)
      router.replace(`${pathname}?${search.toString()}`, { scroll: false })
    },
    [params, pathname, router],
  )

  const close = useCallback(() => {
    const search = new URLSearchParams(params.toString())
    search.delete("contact")
    const q = search.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }, [params, pathname, router])

  return { email, open, close }
}

function normalize(v: string): string {
  return v.trim().toLowerCase()
}
