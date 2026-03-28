import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { AdminOnboardingForm } from "@/components/admin-onboarding-form"
import { resolveRedirectPath } from "@/lib/auth-redirect"
import { isAdminUser } from "@/lib/auth-utils"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Finish admin setup",
  description: "Set a password to activate your Arco admin account.",
}

type AdminOnboardingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

const toQueryString = (params: Record<string, string | string[] | undefined>) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item))
    } else if (typeof value === "string" && value.length > 0) {
      query.set(key, value)
    }
  }
  const serialized = query.toString()
  return serialized ? `?${serialized}` : ""
}

export default async function AdminOnboardingPage({ searchParams = {} }: AdminOnboardingPageProps) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const currentPath = `/auth/admin-onboarding${toQueryString(searchParams)}`

  if (!session) {
    return redirect(`/login?redirectTo=${encodeURIComponent(currentPath)}`)
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_types, admin_role, is_active")
    .eq("id", session.user.id)
    .maybeSingle()

  if (error || !profile || profile.is_active === false || !isAdminUser(profile.user_types, profile.admin_role)) {
    return redirect("/dashboard?unauthorized=admin")
  }

  const redirectParam = typeof searchParams.redirectTo === "string" ? searchParams.redirectTo : undefined
  const redirectTo = resolveRedirectPath(redirectParam ?? "/admin/users")
  const emailParam = typeof searchParams.email === "string" ? decodeURIComponent(searchParams.email) : session.user.email

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-12">
        <div className="container max-w-3xl">
          <AdminOnboardingForm email={emailParam ?? null} redirectTo={redirectTo} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
