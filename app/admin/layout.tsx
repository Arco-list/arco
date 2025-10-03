import { ReactNode } from "react"
import { redirect } from "next/navigation"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"

type AdminLayoutProps = {
  children: ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const redirectToLogin = () => {
    redirect(`/login?redirectTo=/admin`)
  }

  const redirectToDashboard = () => {
    redirect(`/dashboard?unauthorized=admin`)
  }

  if (!session?.user) {
    redirectToLogin()
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", session!.user.id)
    .maybeSingle()

  if (error) {
    console.error("Admin layout profile fetch failed", error)
    redirectToDashboard()
  }

  if (!isAdminUser(profile?.user_types)) {
    redirectToDashboard()
  }

  return <>{children}</>
}
