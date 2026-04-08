"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  Plus,
} from "lucide-react"
import { toast } from "sonner"

import {
  createCategoryAction,
  deleteCategoryAction,
  toggleCanPublishProjectsAction,
  toggleCategoryStatusAction,
  toggleHomeCarrouselAction,
  toggleSpaceHomeCarrouselAction,
  updateCategoryAction,
  uploadCategoryImageAction,
} from "@/app/admin/categories/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export type AdminCategoryRow = {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
  parentName: string | null
  isActive: boolean
  sortOrder: number | null
  updatedAt: string | null
  categoryType: string | null
  categoryHierarchy: number | null
  inHomeCarrousel: boolean
  imageUrl: string | null
  canPublishProjects: boolean
  count: number
}

type TabKey = "project" | "professional" | "spaces"
type CreateMode = "type" | "service" | "group"

export type AdminSpaceRow = {
  id: string
  name: string
  slug: string
  iconKey: string | null
  sortOrder: number
  isActive: boolean
  photoCount: number
  imageUrl: string | null
  inHomeCarrousel: boolean
}

interface Props {
  categories: AdminCategoryRow[]
  spaces?: AdminSpaceRow[]
}

export function AdminCategoriesDataTable({ categories, spaces = [] }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<TabKey>("project")

  // Split categories by type, pre-sorted: parents first, then children grouped under each parent
  const buildSortedItems = (type: string) => {
    const items = categories.filter((c) => c.categoryType === type)
    const parents = items
      .filter((c) => c.categoryHierarchy === 1)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

    const childrenByParent = new Map<string, AdminCategoryRow[]>()
    for (const child of items.filter((c) => c.categoryHierarchy === 2)) {
      const key = child.parentId ?? ""
      const arr = childrenByParent.get(key) ?? []
      arr.push(child)
      childrenByParent.set(key, arr)
    }
    for (const [, arr] of childrenByParent) {
      arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    }

    const result: AdminCategoryRow[] = []
    for (const parent of parents) {
      result.push(parent)
      result.push(...(childrenByParent.get(parent.id) ?? []))
    }
    // Add orphan children (no matching parent)
    for (const [key, arr] of childrenByParent) {
      if (!parents.some((p) => p.id === key)) {
        result.push(...arr)
      }
    }
    return result
  }

  const projectItems = useMemo(() => buildSortedItems("Project").filter((c) => c.isActive), [categories])
  const professionalItems = useMemo(() => buildSortedItems("Professional"), [categories])

  const professionalGroups = useMemo(
    () =>
      categories
        .filter((c) => c.categoryType === "Professional" && c.categoryHierarchy === 1)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories]
  )

  const projectGroups = useMemo(
    () =>
      categories
        .filter((c) => c.categoryType === "Project" && c.categoryHierarchy === 1)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories]
  )

  const currentItems = activeTab === "project" ? projectItems : professionalItems
  const currentGroups = activeTab === "project" ? projectGroups : professionalGroups
  const activeCount = currentItems.filter((c) => c.isActive).length

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [searchTerm, setSearchTerm] = useState("")
  const [groupFilter, setGroupFilter] = useState("all")

  // Dialogs
  const [editCategory, setEditCategory] = useState<AdminCategoryRow | null>(null)
  const [editName, setEditName] = useState("")
  const [editSlug, setEditSlug] = useState("")
  const [editParentId, setEditParentId] = useState<string | null>(null)
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminCategoryRow | null>(null)
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [cropTargetId, setCropTargetId] = useState<string | null>(null)
  const [cropTargetType, setCropTargetType] = useState<"category" | "space">("category")
  const [createMode, setCreateMode] = useState<CreateMode | null>(null)
  const [createName, setCreateName] = useState("")
  const [createParentId, setCreateParentId] = useState<string | null>(null)

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
    setSearchTerm("")
    setGroupFilter("all")
    setSorting([])
    setColumnFilters([])
    setPagination({ pageIndex: 0, pageSize: 50 })
  }

  // Action handlers
  const handleToggleStatus = (category: AdminCategoryRow, isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleCategoryStatusAction({ categoryId: category.id, isActive })
      if (!result.success) {
        toast.error("Failed to update status", { description: result.error.message })
      } else {
        toast.success(`Category ${isActive ? "activated" : "deactivated"}`)
        router.refresh()
      }
    })
  }

  const handleToggleHomeCarrousel = (category: AdminCategoryRow, enabled: boolean) => {
    startTransition(async () => {
      const result = await toggleHomeCarrouselAction({
        categoryId: category.id,
        enabled,
        categoryType: category.categoryType ?? "Project",
      })
      if (!result.success) {
        toast.error("Failed to update", { description: result.error.message })
      } else {
        toast.success(enabled ? "Added to homepage" : "Removed from homepage")
        router.refresh()
      }
    })
  }

  const handleToggleCanPublish = (category: AdminCategoryRow, enabled: boolean) => {
    startTransition(async () => {
      const result = await toggleCanPublishProjectsAction({ categoryId: category.id, enabled })
      if (!result.success) {
        toast.error("Failed to update", { description: result.error.message })
      } else {
        toast.success(enabled ? "Project publishing enabled" : "Project publishing disabled")
        router.refresh()
      }
    })
  }

  const handleEditSubmit = () => {
    if (!editCategory || !editName.trim()) return
    startTransition(async () => {
      const result = await updateCategoryAction({
        categoryId: editCategory.id,
        name: editName.trim(),
        slug: editSlug.trim() || undefined,
        parentId: editParentId,
      })
      if (!result.success) {
        toast.error("Failed to update category", { description: result.error.message })
      } else {
        toast.success("Category updated")
        setEditCategory(null)
        router.refresh()
      }
    })
  }

  // Crop state
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [cropScale, setCropScale] = useState(1)
  const cropDragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null)
  const cropImgRef = useRef<HTMLImageElement | null>(null)
  const cropContainerRef = useRef<HTMLDivElement | null>(null)

  const CROP_W = 300
  const CROP_H = 450 // 2:3 portrait

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return
    const file = e.target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB")
      return
    }
    // Store target before opening crop (edit dialog may close)
    if (editCategory) {
      setCropTargetId(editCategory.id)
      setCropTargetType("category")
    }
    const reader = new FileReader()
    reader.onload = () => {
      setCropImageSrc(reader.result as string)
      setCropOffset({ x: 0, y: 0 })
      setCropScale(1)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    cropDragRef.current = { startX: e.clientX, startY: e.clientY, startOffsetX: cropOffset.x, startOffsetY: cropOffset.y }
    const handleMove = (ev: MouseEvent) => {
      if (!cropDragRef.current) return
      setCropOffset({
        x: cropDragRef.current.startOffsetX + (ev.clientX - cropDragRef.current.startX),
        y: cropDragRef.current.startOffsetY + (ev.clientY - cropDragRef.current.startY),
      })
    }
    const handleUp = () => {
      cropDragRef.current = null
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
  }

  const handleCropSave = async () => {
    if (!cropImageSrc || !cropTargetId) return
    const targetId = cropTargetId
    const isSpace = cropTargetType === "space"
    setIsUploadingImage(true)

    try {
      // Draw cropped image to canvas
      const img = document.createElement("img")
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Failed to load image"))
        img.src = cropImageSrc
      })

      const canvas = document.createElement("canvas")
      const outputW = 600
      const outputH = 900 // 2:3
      canvas.width = outputW
      canvas.height = outputH
      const ctx = canvas.getContext("2d")!

      // Calculate source crop from the visual preview
      const displayScale = Math.max(CROP_W / img.width, CROP_H / img.height) * cropScale
      const drawW = img.width * displayScale
      const drawH = img.height * displayScale
      const drawX = (CROP_W - drawW) / 2 + cropOffset.x
      const drawY = (CROP_H - drawH) / 2 + cropOffset.y

      // Map from display coords to source coords
      const srcX = -drawX / displayScale
      const srcY = -drawY / displayScale
      const srcW = CROP_W / displayScale
      const srcH = CROP_H / displayScale

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH)

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9)
      )

      const formData = new FormData()
      formData.append("file", new File([blob], "crop.jpg", { type: "image/jpeg" }))
      formData.append("targetId", targetId)
      formData.append("targetType", isSpace ? "space" : "category")

      const result = await uploadCategoryImageAction(formData)
      if (result.success && result.imageUrl) {
        if (!isSpace) setEditImageUrl(result.imageUrl)
        setCropImageSrc(null)
        setCropTargetId(null)
        setEditingSpaceId(null)
        toast.success("Image uploaded")
        router.refresh()
      } else {
        toast.error((result as any).error?.message ?? "Failed to save image")
      }
    } catch (err) {
      console.error("Image crop/upload failed:", err)
      toast.error("Failed to upload image")
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteCategoryAction({ categoryId: deleteTarget.id })
      if (!result.success) {
        toast.error("Failed to delete", { description: result.error.message })
      } else {
        toast.success("Category deleted")
        setDeleteTarget(null)
        router.refresh()
      }
    })
  }

  const handleCreateSubmit = () => {
    if (!createName.trim()) return
    if (createMode === "service" && !createParentId) {
      toast.error("Please select a group")
      return
    }

    startTransition(async () => {
      const categoryType = activeTab === "project" ? "Project" : "Professional"
      const parentId = createMode === "service" || createMode === "type" ? createParentId : null

      const result = await createCategoryAction({
        name: createName.trim(),
        parentId,
        categoryType,
      })

      if (!result.success) {
        toast.error("Failed to create", { description: result.error.message })
      } else {
        toast.success(
          createMode === "group"
            ? "Group created"
            : createMode === "service"
              ? "Service created"
              : "Type created"
        )
        setCreateMode(null)
        setCreateName("")
        setCreateParentId(null)
        router.refresh()
      }
    })
  }

  // Column definitions
  const columns: ColumnDef<AdminCategoryRow>[] = useMemo(
    () => [
      {
        id: "name",
        header: activeTab === "project" ? "Type" : "Service",
        accessorFn: (row) => row.name,
        filterFn: (row, _columnId, filterValue) => {
          if (!filterValue) return true
          const q = (filterValue as string).toLowerCase()
          return (
            row.original.name.toLowerCase().includes(q) ||
            row.original.slug.toLowerCase().includes(q)
          )
        },
        cell: ({ row }) => {
          const { name, slug, categoryHierarchy, parentId } = row.original
          const isParent = categoryHierarchy === 1
          const isChild = !!parentId
          return (
            <div className={`flex flex-col gap-0.5 ${isChild ? "pl-4" : ""}`}>
              <span
                className={`text-sm ${isParent ? "font-semibold" : "font-medium"} text-[#1c1c1a]`}
              >
                {name}
              </span>
              <span className="text-[11px] text-[#a1a1a0]">{slug}</span>
            </div>
          )
        },
      },
      {
        id: "group",
        header: "Group",
        accessorFn: (row) => row.parentName ?? "",
        filterFn: (row, _columnId, filterValue) => {
          if (!filterValue) return true
          // Show the parent row itself and its children
          return (
            row.original.parentId === filterValue || row.original.id === filterValue
          )
        },
        cell: ({ row }) => {
          if (row.original.categoryHierarchy === 1) {
            return (
              <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-sm bg-[#f5f5f4] text-[#6b6b68]">
                Group
              </span>
            )
          }
          return row.original.parentName ? (
            <span className="text-xs text-[#6b6b68]">{row.original.parentName}</span>
          ) : (
            <span className="text-xs text-[#a1a1a0]">&mdash;</span>
          )
        },
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <Switch
            checked={row.original.isActive}
            onCheckedChange={(checked) => handleToggleStatus(row.original, checked)}
          />
        ),
        enableSorting: false,
      },
      {
        id: "homepage",
        header: "Homepage",
        cell: ({ row }) => {
          // Only show toggle for child categories (not groups)
          if (row.original.categoryHierarchy === 1) return null
          return (
            <Switch
              checked={row.original.inHomeCarrousel}
              onCheckedChange={(checked) => handleToggleHomeCarrousel(row.original, checked)}
            />
          )
        },
        enableSorting: false,
      },
      {
        id: "image",
        header: "Image",
        cell: ({ row }) => {
          const category = row.original
          const url = category.imageUrl
          return (
            <label className="cursor-pointer inline-flex items-center gap-2 group" title={url ? "Click to change image" : "Click to upload image"}>
              {url ? (
                <img src={url} alt="" className="w-10 h-7 object-cover rounded-[2px] group-hover:opacity-70 transition-opacity" />
              ) : (
                <div className="w-10 h-7 rounded-[2px] bg-[#f5f5f4] group-hover:bg-[#e5e5e4] transition-colors flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#a1a1a0" strokeWidth="1.5"><path d="M8 3v10M3 8h10" strokeLinecap="round" /></svg>
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  if (!e.target.files?.[0]) return
                  const file = e.target.files[0]
                  if (file.size > 10 * 1024 * 1024) {
                    toast.error("Image must be under 10MB")
                    return
                  }
                  setCropTargetId(category.id)
                  setCropTargetType("category")
                  const reader = new FileReader()
                  reader.onload = () => {
                    setCropImageSrc(reader.result as string)
                    setCropOffset({ x: 0, y: 0 })
                    setCropScale(1)
                  }
                  reader.readAsDataURL(file)
                  e.target.value = ""
                }}
              />
            </label>
          )
        },
        enableSorting: false,
      },
      {
        id: "count",
        header: activeTab === "project" ? "Projects" : "Companies",
        cell: ({ row }) => {
          const count = row.original.count
          return <span className="text-xs text-[#6b6b68]">{count}</span>
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => rowA.original.count - rowB.original.count,
      },
      {
        id: "canPublish",
        header: "Can publish",
        cell: ({ row }) => {
          // Only show for Professional Services child categories
          if (row.original.categoryType !== "Professional") return null
          if (row.original.categoryHierarchy === 1) return null
          return (
            <Switch
              checked={row.original.canPublishProjects}
              onCheckedChange={(checked) => handleToggleCanPublish(row.original, checked)}
            />
          )
        },
        enableSorting: false,
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        sortingFn: (a, b) => {
          const at = a.original.updatedAt ? new Date(a.original.updatedAt).getTime() : 0
          const bt = b.original.updatedAt ? new Date(b.original.updatedAt).getTime() : 0
          return at - bt
        },
        cell: ({ row }) => {
          const d = row.original.updatedAt
          if (!d) return <span className="text-xs text-[#a1a1a0]">&mdash;</span>
          try {
            return (
              <span className="text-xs text-[#6b6b68] whitespace-nowrap">
                {format(new Date(d), "PP")}
              </span>
            )
          } catch {
            return <span className="text-xs text-[#a1a1a0]">&mdash;</span>
          }
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 w-7 items-center justify-center rounded-[3px] text-[#a1a1a0] hover:bg-[#f5f5f4] hover:text-[#1c1c1a] transition-colors">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  setEditCategory(row.original)
                  setEditName(row.original.name)
                  setEditSlug(row.original.slug)
                  setEditParentId(row.original.parentId)
                  setEditImageUrl(row.original.imageUrl)
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => setDeleteTarget(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [activeTab]
  )

  const columnVisibility = useMemo(() => ({
    canPublish: activeTab === "professional",
  }), [activeTab])

  const table = useReactTable({
    data: currentItems,
    columns,
    state: { sorting, columnFilters, pagination, columnVisibility },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h3 className="arco-section-title">Categories</h3>
        <p className="text-xs text-[#a1a1a0] mt-0.5">
          {currentItems.length} total &middot; {activeCount} active
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#e5e5e4]">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "project"
              ? "border-[#1c1c1a] text-[#1c1c1a]"
              : "border-transparent text-[#a1a1a0] hover:text-[#6b6b68]"
          }`}
          onClick={() => handleTabChange("project")}
        >
          Project Types
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "professional"
              ? "border-[#1c1c1a] text-[#1c1c1a]"
              : "border-transparent text-[#a1a1a0] hover:text-[#6b6b68]"
          }`}
          onClick={() => handleTabChange("professional")}
        >
          Professional Services
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "spaces"
              ? "border-[#1c1c1a] text-[#1c1c1a]"
              : "border-transparent text-[#a1a1a0] hover:text-[#6b6b68]"
          }`}
          onClick={() => handleTabChange("spaces")}
        >
          Spaces
        </button>
      </div>

      {/* Spaces tab — matches Types/Services table styling */}
      {activeTab === "spaces" && (
        <div className="border border-[#e5e5e4] overflow-x-auto max-w-full min-w-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e5e4]">
                <th className="h-10 px-4 text-left align-middle text-xs font-medium text-[#6b6b68]">Space</th>
                <th className="h-10 px-4 text-left align-middle text-xs font-medium text-[#6b6b68]">Status</th>
                <th className="h-10 px-4 text-left align-middle text-xs font-medium text-[#6b6b68]">Homepage</th>
                <th className="h-10 px-4 text-left align-middle text-xs font-medium text-[#6b6b68]">Image</th>
                <th className="h-10 px-4 text-left align-middle text-xs font-medium text-[#6b6b68]">Photos</th>
                <th className="h-10 px-4 text-left align-middle text-xs font-medium text-[#6b6b68]">Order</th>
                <th className="h-10 px-4 text-left align-middle text-xs font-medium text-[#6b6b68]"></th>
              </tr>
            </thead>
            <tbody>
              {spaces.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-24 text-center text-sm text-[#a1a1a0]">No spaces found.</td>
                </tr>
              ) : (
                spaces.sort((a, b) => a.sortOrder - b.sortOrder).map((space) => (
                  <tr key={space.id} className="border-b border-[#e5e5e4] last:border-0 transition-colors hover:bg-[#FAFAF9]">
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-[#1c1c1a]">{space.name}</span>
                        <span className="text-[11px] text-[#a1a1a0]">{space.slug}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Switch checked={space.isActive} onCheckedChange={() => { /* TODO: hook up toggle */ }} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Switch
                        checked={space.inHomeCarrousel}
                        onCheckedChange={(checked) => {
                          startTransition(async () => {
                            const result = await toggleSpaceHomeCarrouselAction({ spaceId: space.id, enabled: checked })
                            if (!result.success) {
                              toast.error("Failed to update", { description: result.error.message })
                            } else {
                              toast.success(checked ? "Added to homepage" : "Removed from homepage")
                              router.refresh()
                            }
                          })
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <label className="cursor-pointer inline-flex items-center gap-2 group" title={space.imageUrl ? "Click to change image" : "Click to upload image"}>
                        {space.imageUrl ? (
                          <img src={space.imageUrl} alt="" className="w-10 h-7 object-cover rounded-[2px] group-hover:opacity-70 transition-opacity" />
                        ) : (
                          <div className="w-10 h-7 rounded-[2px] bg-[#f5f5f4] group-hover:bg-[#e5e5e4] transition-colors flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#a1a1a0" strokeWidth="1.5"><path d="M8 3v10M3 8h10" strokeLinecap="round" /></svg>
                          </div>
                        )}
                        <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => {
                          if (!e.target.files?.[0]) return
                          const file = e.target.files[0]
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error("Image must be under 10MB")
                            return
                          }
                          setEditingSpaceId(space.id)
                          setCropTargetId(space.id)
                          setCropTargetType("space")
                          const reader = new FileReader()
                          reader.onload = () => {
                            setCropImageSrc(reader.result as string)
                            setCropOffset({ x: 0, y: 0 })
                            setCropScale(1)
                          }
                          reader.readAsDataURL(file)
                          e.target.value = ""
                        }} />
                      </label>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className="text-xs text-[#6b6b68]">{space.photoCount}</span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className="text-xs text-[#6b6b68]">{space.sortOrder}</span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 w-7 items-center justify-center rounded-[3px] text-[#a1a1a0] hover:bg-[#f5f5f4] hover:text-[#1c1c1a] transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <label className="cursor-pointer">
                              {space.imageUrl ? "Change image" : "Upload image"}
                              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => {
                                if (!e.target.files?.[0]) return
                                setEditingSpaceId(space.id)
                                setCropTargetId(space.id)
                                setCropTargetType("space")
                                const reader = new FileReader()
                                reader.onload = () => {
                                  setCropImageSrc(reader.result as string)
                                  setCropOffset({ x: 0, y: 0 })
                                  setCropScale(1)
                                }
                                reader.readAsDataURL(e.target.files[0])
                                e.target.value = ""
                              }} />
                            </label>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Filters */}
      {activeTab !== "spaces" && <><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center">
          <input
            type="text"
            placeholder={activeTab === "project" ? "Search types\u2026" : "Search services\u2026"}
            className="w-full max-w-sm px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors placeholder:text-[#a1a1a0]"
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value
              setSearchTerm(value)
              table.getColumn("name")?.setFilterValue(value || undefined)
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={groupFilter}
            onValueChange={(value) => {
              setGroupFilter(value)
              table.getColumn("group")?.setFilterValue(value === "all" ? undefined : value)
            }}
          >
            <SelectTrigger className="w-[180px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue placeholder="All groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {currentGroups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            className="arco-nav-text h-9 px-3 rounded-[3px] border border-[#e5e5e4] hover:bg-[#f5f5f4] transition-colors inline-flex items-center gap-1.5"
            onClick={() => {
              setCreateMode("group")
              setCreateName("")
              setCreateParentId(null)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add group
          </button>
          <button
            className="arco-nav-text h-9 px-3 rounded-[3px] btn-scrolled inline-flex items-center gap-1.5"
            onClick={() => {
              setCreateMode(activeTab === "project" ? "type" : "service")
              setCreateName("")
              setCreateParentId(null)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            {activeTab === "project" ? "Add type" : "Add service"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div key={activeTab} className="border border-[#e5e5e4] overflow-x-auto max-w-full min-w-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e5e4]">
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className="h-10 px-4 text-left align-middle text-xs font-medium text-[#6b6b68]"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          className="inline-flex items-center gap-1 hover:text-[#1c1c1a] transition-colors select-none"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })
              )}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const isGroupRow = row.original.categoryHierarchy === 1
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-[#e5e5e4] last:border-0 transition-colors ${
                      isGroupRow ? "bg-[#FAFAF9]" : "hover:bg-[#FAFAF9]"
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-sm text-[#a1a1a0]">
                  No categories found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-[#a1a1a0]">
        <span>
          {table.getFilteredRowModel().rows.length}{" "}
          {table.getFilteredRowModel().rows.length === 1 ? "result" : "results"}
        </span>
        <div className="flex items-center gap-3">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="h-7 w-7 flex items-center justify-center border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#f5f5f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              &lsaquo;
            </button>
            <button
              className="h-7 w-7 flex items-center justify-center border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#f5f5f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              &rsaquo;
            </button>
          </div>
        </div>
      </div>

      </>}

      {/* Edit Name Dialog */}
      <Dialog
        open={!!editCategory}
        onOpenChange={(open) => {
          if (!open) setEditCategory(null)
        }}
      >
        <DialogContent className="max-w-md" style={{ overflow: "visible" }}>
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-normal">Edit category</DialogTitle>
            <DialogDescription>
              Update details for &ldquo;{editCategory?.name}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-[#6b6b68] block mb-1">Name</label>
              <input
                className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Category name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6b6b68] block mb-1">Slug</label>
              <input
                className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors"
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                placeholder="category-slug"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6b6b68] block mb-1">Parent</label>
              <Select value={editParentId ?? "__none__"} onValueChange={(v) => setEditParentId(v === "__none__" ? null : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No parent</SelectItem>
                  {categories
                    .filter((c) => !c.parentId && c.id !== editCategory?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#6b6b68] block mb-1">Image</label>
              <div className="flex items-center gap-3">
                {editImageUrl ? (
                  <img src={editImageUrl} alt="" className="w-12 h-[72px] object-cover rounded-[3px] border border-[#e5e5e4]" />
                ) : (
                  <div className="w-12 h-[72px] bg-[#f5f5f4] rounded-[3px] border border-[#e5e5e4] flex items-center justify-center text-[10px] text-[#a1a1a0]">
                    No image
                  </div>
                )}
                <div>
                  <label className="text-xs px-3 py-1.5 rounded-[3px] border border-[#e5e5e4] hover:bg-[#f5f5f4] transition-colors cursor-pointer inline-block">
                    {isUploadingImage ? "Uploading…" : "Upload & crop"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleImageSelect} disabled={isUploadingImage} />
                  </label>
                  <p className="text-[10px] text-[#a1a1a0] mt-1">Portrait 2:3, output 600×900px</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              className="arco-nav-text px-[18px] py-[7px] rounded-[3px] border border-[#e5e5e4] hover:bg-[#f5f5f4] transition-colors"
              onClick={() => setEditCategory(null)}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              className="arco-nav-text px-[18px] py-[7px] rounded-[3px] btn-scrolled disabled:opacity-50"
              onClick={handleEditSubmit}
              disabled={isPending || !editName.trim()}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This will
              deactivate the category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending ? "Deleting\u2026" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Dialog */}
      <Dialog
        open={!!createMode}
        onOpenChange={(open) => {
          if (!open) {
            setCreateMode(null)
            setCreateName("")
            setCreateParentId(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-normal">
              {createMode === "type"
                ? "Add project type"
                : createMode === "service"
                  ? "Add professional service"
                  : "Add group"}
            </DialogTitle>
            <DialogDescription>
              {createMode === "type"
                ? "Create a new project type category."
                : createMode === "service"
                  ? "Create a new professional service under a group."
                  : "Create a new group to organize categories."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6b6b68]">Name</label>
              <input
                className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={
                  createMode === "type"
                    ? "e.g., Penthouse"
                    : createMode === "service"
                      ? "e.g., Landscape Architect"
                      : "e.g., Specialty Services"
                }
              />
            </div>
            {createMode === "service" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b6b68]">Group</label>
                <Select
                  value={createParentId ?? ""}
                  onValueChange={(value) => setCreateParentId(value || null)}
                >
                  <SelectTrigger className="w-full h-9 text-sm border-[#e5e5e4] rounded-[3px]">
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {professionalGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {createMode === "type" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b6b68]">
                  Group <span className="font-normal text-[#a1a1a0]">(optional)</span>
                </label>
                <Select
                  value={createParentId ?? "none"}
                  onValueChange={(value) => setCreateParentId(value === "none" ? null : value)}
                >
                  <SelectTrigger className="w-full h-9 text-sm border-[#e5e5e4] rounded-[3px]">
                    <SelectValue placeholder="No group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No group</SelectItem>
                    {projectGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              className="arco-nav-text px-[18px] py-[7px] rounded-[3px] border border-[#e5e5e4] hover:bg-[#f5f5f4] transition-colors"
              onClick={() => {
                setCreateMode(null)
                setCreateName("")
                setCreateParentId(null)
              }}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              className="arco-nav-text px-[18px] py-[7px] rounded-[3px] btn-scrolled disabled:opacity-50"
              onClick={handleCreateSubmit}
              disabled={
                isPending ||
                !createName.trim() ||
                (createMode === "service" && !createParentId)
              }
            >
              {isPending ? "Creating\u2026" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Crop Modal */}
      {cropImageSrc && (
        <div className="popup-overlay" onClick={() => { setCropImageSrc(null); setEditingSpaceId(null); setCropTargetId(null) }} style={{ zIndex: 600 }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Crop image</h3>
              <button className="popup-close" onClick={() => { setCropImageSrc(null); setEditingSpaceId(null); setCropTargetId(null) }} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 12 }}>Drag to position. Scroll to zoom. Output: 600×900px (2:3 portrait)</p>

            {/* Crop area */}
            <div
              ref={cropContainerRef}
              style={{
                width: CROP_W, height: CROP_H,
                margin: "0 auto", overflow: "hidden", position: "relative",
                borderRadius: 3, cursor: "grab", background: "#1c1c1a",
                border: "1px solid #e5e5e4",
              }}
              onMouseDown={handleCropMouseDown}
              onWheel={(e) => {
                e.preventDefault()
                setCropScale((prev) => Math.max(0.5, Math.min(3, prev + (e.deltaY > 0 ? -0.05 : 0.05))))
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={cropImgRef}
                src={cropImageSrc}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: "50%", top: "50%",
                  transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px)) scale(${cropScale})`,
                  maxWidth: "none", maxHeight: "none",
                  width: "100%", height: "auto",
                  minHeight: "100%", objectFit: "cover",
                  userSelect: "none", pointerEvents: "none",
                }}
              />
            </div>

            {/* Zoom slider */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px auto", width: CROP_W }}>
              <span style={{ fontSize: 10, color: "#a1a1a0" }}>−</span>
              <input
                type="range" min="0.5" max="3" step="0.05"
                value={cropScale}
                onChange={(e) => setCropScale(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, color: "#a1a1a0" }}>+</span>
            </div>

            {/* Actions */}
            <div className="popup-actions">
              <button
                className="btn-tertiary"
                onClick={() => { setCropImageSrc(null); setEditingSpaceId(null); setCropTargetId(null) }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCropSave}
                disabled={isUploadingImage}
                style={{ flex: 1 }}
              >
                {isUploadingImage ? "Uploading…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
