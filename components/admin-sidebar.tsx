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
import { Users, FolderOpen, UserCheck } from "lucide-react"
import Link from "next/link"

const adminData = {
  user: {
    name: "Admin User",
    email: "admin@arco.com",
    avatar: "/placeholder.svg?height=32&width=32",
  },
  navItems: [
    {
      title: "Users",
      url: "/admin/users",
      icon: Users,
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
  ],
}

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <div className="relative">
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <div className="flex items-center gap-3 px-3 py-4">
            <Link href="/" className="flex items-center gap-3">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
                alt="Arco Logo"
                className="h-8 w-auto"
              />
              <span className="font-semibold text-lg">Admin</span>
            </Link>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="gap-2">
            {adminData.navItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild className="h-12 px-4 text-base">
                  <Link href={item.url}>
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={adminData.user} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </div>
  )
}
