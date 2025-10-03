"use client"

import { useState } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { ProfessionalsDataTable } from "@/components/professionals-data-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { AdminSidebar } from "@/components/admin-sidebar"

// Sample professionals data
const professionalsData = [
  {
    id: 1,
    name: "FX Domotica",
    profilePicture: "/placeholder.svg?height=40&width=40",
    categories: ["Smart Home", "Automation", "Security"],
    projectCount: 12,
    rating: 4.8,
    location: "Amsterdam",
    status: "Active",
  },
  {
    id: 2,
    name: "Green Garden Solutions",
    profilePicture: "/placeholder.svg?height=40&width=40",
    categories: ["Landscaping", "Garden Design"],
    projectCount: 8,
    rating: 4.6,
    location: "Utrecht",
    status: "Active",
  },
  {
    id: 3,
    name: "Modern Kitchen Co",
    profilePicture: "/placeholder.svg?height=40&width=40",
    categories: ["Kitchen Design", "Interior"],
    projectCount: 15,
    rating: 4.9,
    location: "Rotterdam",
    status: "Active",
  },
  {
    id: 4,
    name: "Elite Bathrooms",
    profilePicture: "/placeholder.svg?height=40&width=40",
    categories: ["Bathroom Design", "Plumbing"],
    projectCount: 6,
    rating: 4.5,
    location: "The Hague",
    status: "Pending",
  },
  {
    id: 5,
    name: "Solar Energy Pro",
    profilePicture: "/placeholder.svg?height=40&width=40",
    categories: ["Solar Panels", "Energy", "Sustainability"],
    projectCount: 20,
    rating: 4.7,
    location: "Eindhoven",
    status: "Active",
  },
]

export default function ProfessionalsPage() {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")

  const handleInviteProfessional = () => {
    // Handle invite logic here
    console.log("Inviting professional:", inviteEmail)
    setInviteEmail("")
    setIsInviteModalOpen(false)
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/admin">Admin Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Professionals</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4">
            <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add professional
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Invite Professional</DialogTitle>
                  <DialogDescription>
                    Send an invitation to a new professional. They will receive an email with instructions to set up
                    their account and create their profile.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="professional@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-sm text-muted-foreground">Role</Label>
                    <div className="col-span-3 text-sm">Professional (Fixed)</div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInviteProfessional} disabled={!inviteEmail}>
                    Send Invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>
        <Separator className="w-full" />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-[10x]">
          <ProfessionalsDataTable data={professionalsData} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
