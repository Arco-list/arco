"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/contexts/auth-context"
import { useCreateCompanyModal } from "@/contexts/create-company-modal-context"

export default function CreateCompanyPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { openCreateCompanyModal } = useCreateCompanyModal()

  useEffect(() => {
    if (!user) {
      router.replace("/login?redirectTo=/create-company")
      return
    }

    const userTypes = profile?.user_types ?? []
    if (Array.isArray(userTypes) && userTypes.includes("professional")) {
      router.replace("/dashboard/company")
      return
    }

    // Open the modal and navigate back so the dialog overlays the previous page
    openCreateCompanyModal()
    router.back()
  }, [user, profile?.user_types, router, openCreateCompanyModal])

  // Render nothing — the modal handles the UI
  return null
}
