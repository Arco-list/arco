"use client"

import type React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"
import { Users, FolderOpen, UserCheck, Settings, FolderTree } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAuth } from "@/contexts/auth-context"

const NAV_ITEMS = [
  {
    title: "Users",
    url: "/admin/users",
    icon: Users,
    requiresSuperAdmin: true,
  },
  {
    title: "Projects",
    url: "/admin/projects",
    icon: FolderOpen,
  },
  {
    title: "Professionals",
    url: "/admin/professionals",
    icon: UserCheck,
  },
  {
    title: "Categories",
    url: "/admin/categories",
    icon: FolderTree,
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
  },
]

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { profile, user } = useAuth()

  const isSuperAdmin = profile?.admin_role === "super_admin"

  const displayName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || user?.email?.split("@")[0] || "Admin User"

  const email = user?.email ?? "admin@arco.com"
  const avatar = profile?.avatar_url ?? "/placeholder.svg?height=32&width=32"

  return (
    <div className="relative">
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <div className="flex items-center gap-3 px-3 py-4">
            <Link href="/" className="flex items-center gap-3 min-w-0">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
                alt="Arco Logo"
                className="h-8 w-auto max-w-full object-contain group-data-[collapsible=icon]:h-6"
              />
              <span className="font-semibold heading-6 group-data-[collapsible=icon]:hidden">Admin</span>
            </Link>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="gap-2">
            {NAV_ITEMS.filter((item) => (item.requiresSuperAdmin ? isSuperAdmin : true)).map((item) => {
              const isActive = pathname.startsWith(item.url)
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={`h-12 px-4 body-regular ${
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                    }`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <NavUser
            user={{
              name: displayName,
              email,
              avatar,
            }}
            showSavedLinks={false}
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </div>
  )
}
