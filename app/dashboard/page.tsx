"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuth } from "@/contexts/auth-context"

export default function DashboardPage() {
  const router = useRouter()
  const { profile, user, isLoading } = useAuth()

  const sessionMetadata = user?.user_metadata ?? {}
  const metadataUserTypes = Array.isArray(sessionMetadata.user_types)
    ? (sessionMetadata.user_types as string[])
    : typeof sessionMetadata.user_types === "string"
      ? [sessionMetadata.user_types]
      : null
  const userTypes = profile?.user_types ?? metadataUserTypes
  const isAdmin = userTypes?.includes("admin") ?? false
  const hasProfessionalRole = userTypes?.includes("professional") ?? false
  const canAccessProfessionalDashboard = isAdmin || hasProfessionalRole

  useEffect(() => {
    if (isLoading) return

    if (isAdmin) {
      router.replace("/admin")
      return
    }

    router.replace(canAccessProfessionalDashboard ? "/dashboard/listings" : "/homeowner")
  }, [canAccessProfessionalDashboard, isAdmin, isLoading, router])

  return null
}
