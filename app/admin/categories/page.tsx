import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
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
import { AdminCategoriesTable, type AdminCategoryRow } from "@/components/admin-categories-table"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const serviceSupabase = createServiceRoleSupabaseClient()

  const { data: categoriesData, error: categoriesError } = await serviceSupabase
    .from("categories")
    .select("id, name, slug, image_url, description, parent_id, is_active, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })

  if (categoriesError) {
    console.error("Failed to load categories", categoriesError)
  }

  // Build a map of category names for parent lookup
  const categoryMap = new Map<string, string>()
  ;(categoriesData ?? []).forEach((category) => {
    categoryMap.set(category.id, category.name)
  })

  const categories: AdminCategoryRow[] = (categoriesData ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    imageUrl: category.image_url,
    description: category.description,
    parentId: category.parent_id,
    parentName: category.parent_id ? categoryMap.get(category.parent_id) ?? null : null,
    isActive: category.is_active ?? true,
    sortOrder: category.sort_order,
    createdAt: category.created_at,
    updatedAt: category.updated_at,
  }))

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
                  <BreadcrumbPage>Categories</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4">
            <Button asChild variant="quaternary" size="quaternary">
              <a href="/admin/categories">Refresh</a>
            </Button>
          </div>
        </header>
        <Separator className="w-full" />
        <div className="flex flex-1 flex-col gap-6 p-6 overflow-hidden">
          <AdminCategoriesTable categories={categories} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
