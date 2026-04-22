import { ReactNode } from "react"
import { redirect } from "next/navigation"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { Header, type NavItem } from "@/components/header"

type AdminLayoutProps = {
  children: ReactNode
}

const iconProps = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

const ICONS = {
  users: (
    <svg {...iconProps}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
  ),
  companies: (
    <svg {...iconProps}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
  ),
  projects: (
    <svg {...iconProps}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
  ),
  brands: (
    <svg {...iconProps}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
  ),
  products: (
    <svg {...iconProps}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
  ),
  sales: (
    <svg {...iconProps}><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
  ),
  growth: (
    <svg {...iconProps}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
  ),
  emails: (
    <svg {...iconProps}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
  ),
  categories: (
    <svg {...iconProps}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
  ),
  design: (
    <svg {...iconProps}><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.52-4.5-10-10-10z" /></svg>
  ),
}

const ADMIN_NAV_LINKS: NavItem[] = [
  {
    label: "Marketplace",
    children: [
      { href: "/admin/users", label: "Users", icon: ICONS.users },
      { href: "/admin/professionals", label: "Companies", icon: ICONS.companies },
      { href: "/admin/projects", label: "Projects", icon: ICONS.projects },
    ],
  },
  {
    label: "Catalog",
    children: [
      { href: "/admin/brands", label: "Brands", icon: ICONS.brands },
      { href: "/admin/products", label: "Products", icon: ICONS.products },
    ],
  },
  {
    label: "Growth",
    children: [
      { href: "/admin/sales", label: "Sales", icon: ICONS.sales },
      { href: "/admin/growth", label: "Growth", icon: ICONS.growth },
      { href: "/admin/emails", label: "Emails", icon: ICONS.emails },
    ],
  },
  {
    label: "Platform",
    children: [
      { href: "/admin/categories", label: "Categories", icon: ICONS.categories },
      { href: "/admin/design", label: "Design", icon: ICONS.design },
    ],
  },
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
