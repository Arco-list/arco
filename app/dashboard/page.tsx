"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuth } from "@/contexts/auth-context"

export default function DashboardPage() {
  const router = useRouter()
  const { profile, session, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return

    const sessionMetadata = session?.user?.user_metadata ?? {}
    const metadataUserTypes = Array.isArray(sessionMetadata.user_types)
      ? (sessionMetadata.user_types as string[])
      : typeof sessionMetadata.user_types === "string"
        ? [sessionMetadata.user_types]
        : null
    const userTypes = profile?.user_types ?? metadataUserTypes
    const hasProfessionalAccess = userTypes?.includes("professional") ?? false

    router.replace(hasProfessionalAccess ? "/dashboard/listings" : "/homeowner")
  }, [isLoading, profile, router, session])

  return null
}
