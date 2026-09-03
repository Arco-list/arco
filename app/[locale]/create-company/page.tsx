"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/contexts/auth-context"

/**
 * Legacy entry — every "create your company" path now leads to the
 * /claim funnel (search → verify → claim or create), which handles the
 * signed-out case itself, so no login gate here anymore. This page
 * stays as a redirect shim for old links, bookmarks, and the
 * redirectTo=/create-company still baked into circulating mails.
 * Professionals who already have a company go to their dashboard.
 */
export default function CreateCompanyPage() {
  const router = useRouter()
  const { profile } = useAuth()

  useEffect(() => {
    const userTypes = profile?.user_types ?? []
    if (Array.isArray(userTypes) && userTypes.includes("professional")) {
      router.replace("/dashboard/company")
      return
    }
    router.replace("/claim")
  }, [profile?.user_types, router])

  return null
}
