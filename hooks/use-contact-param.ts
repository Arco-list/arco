"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * Reads/writes the shared `?contact=<key>` URL param that drives the
 * Contact Card slide-over. Two key shapes:
 *
 *   ?contact=<email>              — normalized email address (default)
 *   ?contact=prospect:<uuid>      — prospect id when the row has no
 *                                    email yet (Sales rows for
 *                                    companies whose only contact is
 *                                    a Showcased prospect with an
 *                                    empty email — Duin Interior).
 *
 * The panel loads via the appropriate discovery action and lets the
 * rep fill the email in place. Once saved the caller flips the URL
 * from prospect:<uuid> to the new email.
 *
 * Values are normalized to lowercase-trimmed on write so a manual
 * URL edit (or a share link from Slack) reaches the same record as
 * a row click.
 */

const PROSPECT_PREFIX = "prospect:"

export function useContactParam(): {
  /** Normalized email when the URL carries an email key; null otherwise. */
  email: string | null
  /** Prospect id when the URL carries a prospect key; null otherwise. */
  prospectId: string | null
  open: (email: string) => void
  openProspect: (prospectId: string) => void
  close: () => void
} {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const raw = params.get("contact")

  const { email, prospectId } = useMemo(() => {
    if (!raw) return { email: null, prospectId: null }
    if (raw.startsWith(PROSPECT_PREFIX)) {
      const id = raw.slice(PROSPECT_PREFIX.length).trim()
      return { email: null, prospectId: id || null }
    }
    return { email: normalize(raw), prospectId: null }
  }, [raw])

  const setContact = useCallback(
    (next: string | null) => {
      const search = new URLSearchParams(params.toString())
      if (next) search.set("contact", next)
      else search.delete("contact")
      const q = search.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [params, pathname, router],
  )

  const open = useCallback((next: string) => {
    const normalized = normalize(next)
    if (!normalized) return
    setContact(normalized)
  }, [setContact])

  const openProspect = useCallback((id: string) => {
    const trimmed = id.trim()
    if (!trimmed) return
    setContact(`${PROSPECT_PREFIX}${trimmed}`)
  }, [setContact])

  const close = useCallback(() => setContact(null), [setContact])

  return { email, prospectId, open, openProspect, close }
}

function normalize(v: string): string {
  return v.trim().toLowerCase()
}
