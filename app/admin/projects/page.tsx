"use client"

import { useState } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ProjectsDataTable } from "@/components/projects-data-table"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Sample project data
const projectData = [
  {
    id: 1,
    title: "Modern Villa Renovation",
    subType: "Residential",
    features: ["Kitchen", "Living Room", "Bathroom"],
    year: 2024,
    dateCreated: "2024-01-15",
    featured: true,
    location: "Amsterdam",
    style: "Modern",
    category: "Renovation",
    metaTitle: "Modern Villa Renovation - Luxury Home Design",
    metaDescription: "Stunning modern villa renovation featuring contemporary design and premium finishes.",
    urlSlug: "modern-villa-renovation-amsterdam",
  },
  {
    id: 2,
    title: "Industrial Loft Conversion",
    subType: "Commercial",
    features: ["Open Space", "Kitchen", "Office"],
    year: 2023,
    dateCreated: "2024-02-20",
    featured: false,
    location: "Rotterdam",
    style: "Industrial",
    category: "Conversion",
    metaTitle: "Industrial Loft Conversion - Urban Living Space",
    metaDescription: "Creative loft conversion combining industrial elements with modern comfort.",
    urlSlug: "industrial-loft-conversion-rotterdam",
  },
  {
    id: 3,
    title: "Sustainable Family Home",
    subType: "Residential",
    features: ["Garden", "Solar Panels", "Kitchen", "Living Room"],
    year: 2024,
    dateCreated: "2024-03-01",
    featured: true,
    location: "Utrecht",
    style: "Contemporary",
    category: "New Build",
    metaTitle: "Sustainable Family Home - Eco-Friendly Design",
    metaDescription: "Environmentally conscious family home with sustainable materials and energy-efficient systems.",
    urlSlug: "sustainable-family-home-utrecht",
  },
]

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState("projects")

  return (
    <SidebarProvider>
      <AppSidebar />
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
                  <BreadcrumbPage>Projects</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </div>
        </header>
        <Separator className="w-full" />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="seo">Project SEO Mgmt</TabsTrigger>
            </TabsList>
            <TabsContent value="projects" className="space-y-4">
              <ProjectsDataTable data={projectData} view="projects" />
            </TabsContent>
            <TabsContent value="seo" className="space-y-4">
              <ProjectsDataTable data={projectData} view="seo" />
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
