"use client"

import type * as React from "react"
import { Users, Building, UserCheck } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Admin",
    email: "admin@arco.com",
    avatar: "/avatars/admin.jpg",
  },
  navMain: [
    {
      title: "Users",
      url: "/admin/users",
      icon: Users,
      isActive: true,
    },
    {
      title: "Projects",
      url: "/admin/projects",
      icon: Building,
    },
    {
      title: "Professionals",
      url: "/admin/professionals",
      icon: UserCheck,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex h-12 items-center justify-center px-4">
          <img
            src="/images/design-mode/Arco%20Logo%20Large%20%281%29(1).svg"
            alt="Arco Logo"
            className="h-6 w-auto"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
