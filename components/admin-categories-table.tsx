"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Image from "next/image"
import { format } from "date-fns"
import {
  ArrowUpDown,
  CheckCircle,
  Eye,
  EyeOff,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import {
  createCategoryAction,
  deleteCategoryAction,
  toggleCategoryStatusAction,
  updateCategoryImageAction,
  updateCategoryNameAction,
} from "@/app/admin/categories/actions"
import { ImageUploadDialog } from "@/components/image-upload-dialog"
import { sanitizeImageUrl, IMAGE_SIZES } from "@/lib/image-security"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type AdminCategoryRow = {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  description: string | null
  parentId: string | null
  parentName: string | null
  isActive: boolean
  sortOrder: number | null
  createdAt: string | null
  updatedAt: string | null
}

interface AdminCategoriesTableProps {
  categories: AdminCategoryRow[]
}

type SortColumn = "name" | "slug" | "status" | "parent" | "created" | "updated"
type SortDirection = "asc" | "desc"

const PAGE_SIZE_OPTIONS = [10, 25, 50]

export function AdminCategoriesTable({ categories }: AdminCategoriesTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [sortColumn, setSortColumn] = useState<SortColumn>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0])
  const [isPending, startTransition] = useTransition()

  // Edit name modal
  const [editNameCategory, setEditNameCategory] = useState<AdminCategoryRow | null>(null)
  const [editNameValue, setEditNameValue] = useState("")

  // Image upload modal
  const [uploadImageCategory, setUploadImageCategory] = useState<AdminCategoryRow | null>(null)

  // Delete modal
  const [deleteCategory, setDeleteCategory] = useState<AdminCategoryRow | null>(null)

  // Create modal
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [createParentId, setCreateParentId] = useState<string | null>(null)

  const totalCount = categories.length

  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortColumn === column) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
      } else {
        setSortColumn(column)
        setSortDirection("asc")
      }
    },
    [sortColumn, sortDirection]
  )

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase()

    return categories.filter((category) => {
      const matchesSearch =
        !query ||
        category.name.toLowerCase().includes(query) ||
        category.slug.toLowerCase().includes(query) ||
        category.description?.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && category.isActive) ||
        (statusFilter === "inactive" && !category.isActive)

      return matchesSearch && matchesStatus
    })
  }, [categories, search, statusFilter])

  const sortedCategories = useMemo(() => {
    const sorted = [...filteredCategories]

    sorted.sort((a, b) => {
      let comparison = 0

      switch (sortColumn) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "slug":
          comparison = a.slug.localeCompare(b.slug)
          break
        case "status":
          comparison = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0)
          break
        case "parent":
          comparison = (a.parentName || "").localeCompare(b.parentName || "")
          break
        case "created":
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
          break
        case "updated":
          comparison = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime()
          break
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredCategories, sortColumn, sortDirection])

  useEffect(() => {
    setPage(0)
  }, [search, statusFilter])

  const pageCount = Math.max(1, Math.ceil(sortedCategories.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const pageItems = useMemo(
    () => sortedCategories.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [sortedCategories, currentPage, pageSize]
  )

  useEffect(() => {
    if (page !== currentPage) {
      setPage(currentPage)
    }
  }, [currentPage, page])

  const handleToggleStatus = (category: AdminCategoryRow, isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleCategoryStatusAction({
        categoryId: category.id,
        isActive,
      })

      if (!result.success) {
        toast.error("Unable to update status", {
          description: result.error.message,
        })
      } else {
        toast.success(`Category ${isActive ? "activated" : "deactivated"}`)
      }
    })
  }

  const handleEditNameOpen = (category: AdminCategoryRow) => {
    setEditNameCategory(category)
    setEditNameValue(category.name)
  }

  const handleEditNameSubmit = () => {
    if (!editNameCategory || !editNameValue.trim()) return

    startTransition(async () => {
      const result = await updateCategoryNameAction({
        categoryId: editNameCategory.id,
        name: editNameValue.trim(),
      })

      if (!result.success) {
        toast.error("Unable to update name", {
          description: result.error.message,
        })
      } else {
        toast.success("Category name updated")
        setEditNameCategory(null)
        setEditNameValue("")
      }
    })
  }

  const handleImageUploadComplete = async (imageUrl: string) => {
    if (!uploadImageCategory) return

    startTransition(async () => {
      const result = await updateCategoryImageAction({
        categoryId: uploadImageCategory.id,
        imageUrl,
      })

      if (!result.success) {
        toast.error("Unable to update image", {
          description: result.error.message,
        })
      } else {
        toast.success("Category image updated")
        setUploadImageCategory(null)
      }
    })
  }

  const handleDelete = () => {
    if (!deleteCategory) return

    startTransition(async () => {
      const result = await deleteCategoryAction({
        categoryId: deleteCategory.id,
      })

      if (!result.success) {
        toast.error("Unable to delete category", {
          description: result.error.message,
        })
      } else {
        toast.success("Category deleted")
        setDeleteCategory(null)
      }
    })
  }

  const handleCreateSubmit = () => {
    if (!createName.trim()) {
      toast.error("Category name is required")
      return
    }

    startTransition(async () => {
      const result = await createCategoryAction({
        name: createName.trim(),
        description: createDescription.trim() || null,
        parentId: createParentId,
      })

      if (!result.success) {
        toast.error("Unable to create category", {
          description: result.error.message,
        })
      } else {
        toast.success("Category created successfully")
        setShowCreateDialog(false)
        setCreateName("")
        setCreateDescription("")
        setCreateParentId(null)
      }
    })
  }

  const activeCategories = categories.filter((c) => c.isActive)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex w-full flex-1 gap-2 md:w-auto md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, slug, or description"
            className="min-w-[240px] pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive only</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add category
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border max-w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Image</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort("name")}
                >
                  Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort("slug")}
                >
                  Slug
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort("parent")}
                >
                  Parent
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort("status")}
                >
                  Status
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[140px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort("updated")}
                >
                  Updated
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No categories match your filters.
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((category) => (
                <TableRow key={category.id} className={cn(isPending && "opacity-70")}>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      {category.imageUrl ? (
                        <Image
                          src={sanitizeImageUrl(category.imageUrl)}
                          alt={category.name}
                          width={IMAGE_SIZES.thumbnail.width}
                          height={IMAGE_SIZES.thumbnail.height}
                          className="h-16 w-16 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{category.name}</span>
                      {category.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {category.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {category.slug}
                  </TableCell>
                  <TableCell>
                    {category.parentName ? (
                      <Badge variant="quaternary" size="quaternary">
                        {category.parentName}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Root</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={category.isActive}
                      onCheckedChange={(checked) => handleToggleStatus(category, checked)}
                      disabled={isPending}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {category.updatedAt ? format(new Date(category.updatedAt), "PP") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => handleEditNameOpen(category)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit name
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setUploadImageCategory(category)}>
                          <Upload className="mr-2 h-4 w-4" /> Upload image
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setDeleteCategory(category)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>
          Showing {pageItems.length} of {filteredCategories.length} filtered categories (
          {totalCount} total)
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="categories-rows" className="text-sm font-medium text-foreground">
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPage(0)
              }}
            >
              <SelectTrigger id="categories-rows" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="quaternary"
              size="quaternary"
              className="h-8"
              onClick={() => setPage(0)}
              disabled={currentPage === 0}
            >
              First
            </Button>
            <Button
              variant="quaternary"
              size="quaternary"
              className="h-8"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
            >
              Prev
            </Button>
            <span className="px-2">
              Page {currentPage + 1} of {pageCount}
            </span>
            <Button
              variant="quaternary"
              size="quaternary"
              className="h-8"
              onClick={() => setPage((prev) => Math.min(pageCount - 1, prev + 1))}
              disabled={currentPage + 1 >= pageCount}
            >
              Next
            </Button>
            <Button
              variant="quaternary"
              size="quaternary"
              className="h-8"
              onClick={() => setPage(pageCount - 1)}
              disabled={currentPage + 1 >= pageCount}
            >
              Last
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Name Dialog */}
      <Dialog
        open={Boolean(editNameCategory)}
        onOpenChange={(open) => {
          if (!open) {
            setEditNameCategory(null)
            setEditNameValue("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit category name</DialogTitle>
            <DialogDescription>
              Update the name for &ldquo;{editNameCategory?.name ?? "this category"}&rdquo;. The
              slug will be automatically updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Category name</Label>
              <Input
                id="edit-name"
                value={editNameValue}
                onChange={(event) => setEditNameValue(event.target.value)}
                placeholder="Enter category name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="quaternary"
              size="quaternary"
              onClick={() => {
                setEditNameCategory(null)
                setEditNameValue("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEditNameSubmit} disabled={!editNameValue.trim() || isPending}>
              {isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Upload Dialog */}
      <ImageUploadDialog
        open={Boolean(uploadImageCategory)}
        onOpenChange={(open) => {
          if (!open) setUploadImageCategory(null)
        }}
        onUploadComplete={handleImageUploadComplete}
        title="Upload category image"
        description={`Upload an image for "${uploadImageCategory?.name ?? "this category"}"`}
        bucketName="category-images"
        maxSizeMB={2}
      />

      {/* Delete Dialog */}
      <Dialog
        open={Boolean(deleteCategory)}
        onOpenChange={(open) => {
          if (!open) setDeleteCategory(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete category</DialogTitle>
            <DialogDescription>
              This action will deactivate &ldquo;{deleteCategory?.name ?? "this category"}&rdquo;.
              It will no longer appear in the marketplace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="quaternary"
              size="quaternary"
              onClick={() => setDeleteCategory(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new category</DialogTitle>
            <DialogDescription>
              Add a new category to the marketplace. The slug will be automatically generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Category name *</Label>
              <Input
                id="create-name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="e.g., Architecture"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-parent">Parent category (optional)</Label>
              <Select value={createParentId || "none"} onValueChange={(value) => setCreateParentId(value === "none" ? null : value)}>
                <SelectTrigger id="create-parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (root category)</SelectItem>
                  {activeCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="quaternary"
              size="quaternary"
              onClick={() => {
                setShowCreateDialog(false)
                setCreateName("")
                setCreateDescription("")
                setCreateParentId(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={!createName.trim() || isPending}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
