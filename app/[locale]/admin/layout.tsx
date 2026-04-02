import { ReactNode } from "react"
import { redirect } from "next/navigation"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { Header } from "@/components/header"

type AdminLayoutProps = {
  children: ReactNode
}

const ADMIN_NAV_LINKS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/professionals", label: "Companies" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/growth", label: "Growth" },
  { href: "/admin/prospects", label: "Sales" },
]

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return redirect(`/?redirectTo=/admin`)
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_types, admin_role, is_active")
    .eq("id", session.user.id)
    .maybeSingle()

  if (error) {
    console.error("Admin layout profile fetch failed", error)
    return redirect(`/dashboard?unauthorized=admin`)
  }

  if (profile?.is_active === false) {
    return redirect(`/dashboard?unauthorized=admin`)
  }

  if (!isAdminUser(profile?.user_types, profile?.admin_role)) {
    return redirect(`/dashboard?unauthorized=admin`)
  }

  return (
    <div className="min-h-screen">
      <Header navLinks={ADMIN_NAV_LINKS} />
      <main className="pt-[60px]">
        {children}
      </main>
    </div>
  )
}
