"use client"

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AdminTabs, useAdminTab } from "@/components/admin/admin-tabs"
import { MoreHorizontal, Plus } from "lucide-react"
import { toast } from "sonner"

import {
  createCategoryAction,
  deleteCategoryAction,
  setPublishScopeAction,
  toggleCategoryStatusAction,
  toggleHomeCarrouselAction,
  toggleSpaceHomeCarrouselAction,
  toggleSpaceStatusAction,
  uploadSpaceCutoutAction,
  clearSpaceCutoutAction,
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
import { ConnectionsTab } from "@/components/admin-categories-connections"
import { ProfessionalsTab } from "@/components/admin-categories-professionals"
import { ProjectsTab } from "@/components/admin-categories-projects"
import { useLocale } from "next-intl"
import { publishScopeLabel, type PublishScope } from "@/lib/publish-scope"

export type AdminCategoryRow = {
  id: string
  name: string
  /** Nederlandse naam (categories.name_nl); null = valt terug op name. */
  nameNl: string | null
  /** Beroepsnaam, alleen voor diensten: Pool builder / Zwembadbouwer en
   *  het meervoud voor koppen en menu's. */
  proName: string | null
  proNameNl: string | null
  proNamePlural: string | null
  proNamePluralNl: string | null
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
  publishScope: PublishScope
  count: number
}

type TabKey = "project" | "professional" | "spaces" | "products" | "links"
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
  /** Uitsnede voor de cirkel op /projects (spaces.cutout_url). */
  cutoutUrl: string | null
  inHomeCarrousel: boolean
}

export type AdminProductCategoryRow = {
  id: string
  slug: string
  name: string
  parentId: string | null
  parentName: string | null
  orderIndex: number
}

interface Props {
  categories: AdminCategoryRow[]
  spaces?: AdminSpaceRow[]
  productCategories?: AdminProductCategoryRow[]
  /** Dienst ↔ ruimte en productgroep ↔ ruimte (migratie 297). */
  serviceSpaces?: Array<{ serviceId: string; spaceId: string }>
  productCategorySpaces?: Array<{ productCategoryId: string; spaceId: string }>
  /** Deelprojecten per ruimte-id (projects.kind = 'partial'). */
  partialCountBySpace?: Record<string, number>
}

export function AdminCategoriesDataTable({ categories, spaces = [], productCategories = [], serviceSpaces = [], productCategorySpaces = [], partialCountBySpace = {} }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // De paginakop, tabs en knoppen volgen de taalkeuze in de header
  // (EN/NL), zoals het merkdashboard. De inhoud van de Professionals-tab
  // doet dat ook; de andere tabs zijn nog Engels.
  const nl = useLocale() === "nl"
  // Tab lives in the URL (?tab=…) via the sticky bar; per-tab view state
  // resets on change (the old handleTabChange behaviour), skipping mount.
  const activeTab = useAdminTab(["project", "professional", "spaces", "products", "links"] as const)

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
  // De gebouwtypes voor de Projecten-tab: alle types, ook inactieve, zonder
  // de (lege) groepsrijen — de tab groepeert zelf in Projecten/Deelprojecten.
  const projectTypeRows = useMemo(
    () => categories.filter((c) => c.categoryType === "Project" && c.categoryHierarchy !== 1),
    [categories],
  )
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
  const activeCount = currentItems.filter((c) => c.isActive).length

  // Zoekterm — de tabs filteren er zelf op
  const [searchTerm, setSearchTerm] = useState("")

  // Dialogs
  const [editCategory, setEditCategory] = useState<AdminCategoryRow | null>(null)
  const [editName, setEditName] = useState("")
  const [editNameNl, setEditNameNl] = useState("")
  const [editPro, setEditPro] = useState({ en: "", nl: "", enPlural: "", nlPlural: "" })
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

  const firstTabRender = useRef(true)
  useEffect(() => {
    if (firstTabRender.current) { firstTabRender.current = false; return }
    setSearchTerm("")
  }, [activeTab])

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

  const handleToggleSpaceHomepage = (space: AdminSpaceRow, enabled: boolean) => {
    startTransition(async () => {
      const result = await toggleSpaceHomeCarrouselAction({ spaceId: space.id, enabled })
      if (!result.success) {
        toast.error("Failed to update", { description: result.error.message })
      } else {
        toast.success(enabled ? "Added to homepage" : "Removed from homepage")
        router.refresh()
      }
    })
  }

  const handleToggleSpaceStatus = (space: AdminSpaceRow, isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleSpaceStatusAction({ spaceId: space.id, enabled: isActive })
      if (!result.success) {
        toast.error("Failed to update", { description: result.error.message })
      } else {
        toast.success(`${space.name}: ${isActive ? "active" : "inactive"}`)
        router.refresh()
      }
    })
  }

  const handleSetPublishScope = (category: AdminCategoryRow, scope: PublishScope) => {
    startTransition(async () => {
      const result = await setPublishScopeAction({ categoryId: category.id, scope })
      if (!result.success) {
        toast.error("Failed to update", { description: result.error.message })
      } else {
        toast.success(`${category.name}: ${publishScopeLabel(scope, nl ? "nl" : "en").toLowerCase()}`)
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
        nameNl: editNameNl.trim() || null,
        slug: editSlug.trim() || undefined,
        parentId: editParentId,
        ...(editCategory.categoryType === "Professional" && editCategory.categoryHierarchy !== 1
          ? { proName: editPro.en.trim() || null, proNameNl: editPro.nl.trim() || null, proNamePlural: editPro.enPlural.trim() || null, proNamePluralNl: editPro.nlPlural.trim() || null }
          : {}),
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

  return (
    // min-w-0 + max-w-full + overflow-hidden matches the wrapper on
    // /admin/projects and /admin/users so no wide descendant expands
    // the page beyond the viewport on mobile.
    <>
      <AdminTabs
        title={nl ? "Categorieën" : "Categories"}
        tabs={[
          { key: "project", label: nl ? "Projecten" : "Projects" },
          { key: "professional", label: "Professionals" },
          { key: "spaces", label: nl ? "Ruimtes" : "Spaces" },
          { key: "products", label: nl ? "Productcategorieën" : "Product Categories" },
          { key: "links", label: nl ? "Samenhang" : "Connections" },
        ]}
        active={activeTab}
        actions={activeTab === "project" || activeTab === "professional" ? (
          <>
          <div className="relative shrink-0" style={{ width: 220 }}>
          <input
            type="text"
            placeholder={activeTab === "project" ? (nl ? "Zoek types\u2026" : "Search types\u2026") : nl ? "Zoek diensten\u2026" : "Search services\u2026"}
            className="w-full h-9 pl-8 pr-3 text-xs border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors placeholder:text-[#a1a1a0]"
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value
              setSearchTerm(value)
            }}
          />
            <svg className="absolute left-2.5 top-2.5 text-[#a1a1a0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          {activeTab === "professional" && (
            <button
              className="btn-tertiary shrink-0"
              style={{ fontSize: 13, padding: "6px 16px", borderRadius: 3 }}
              onClick={() => {
                setCreateMode("group")
                setCreateName("")
                setCreateParentId(null)
              }}
            >
              {nl && activeTab === "professional" ? "Groep toevoegen" : "Add group"}
            </button>
          )}
          <button
            className="btn-primary shrink-0"
            style={{ fontSize: 13, padding: "6px 16px", borderRadius: 3 }}
            onClick={() => {
              setCreateMode(activeTab === "project" ? "type" : "service")
              setCreateName("")
              setCreateParentId(null)
            }}
          >
            {activeTab === "project" ? (nl ? "Type toevoegen" : "Add type") : nl ? "Dienst toevoegen" : "Add service"}
          </button>
          </>
        ) : undefined}
      />

      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 48 }}>

    <div className="flex flex-col gap-6 min-w-0 max-w-full overflow-hidden">
      {/* Page meta — count in the discover style */}
      {activeTab !== "links" && (
        <div className="discover-results-meta" style={{ marginBottom: 0 }}>
          <p className="discover-results-count">
            <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{currentItems.length}</strong> {nl ? "totaal" : "total"} &middot; {activeCount} {nl ? "actief" : "active"}
          </p>
        </div>
      )}


      {/* Spaces tab — matches Types/Services table styling */}
      {activeTab === "spaces" && (
        <div className="arco-table-wrap max-w-full min-w-0">
          <table className="arco-table">
            <thead>
              <tr>
                <th>Space</th>
                <th>Status</th>
                <th>Homepage</th>
                <th>Image</th>
                <th>Cut-out</th>
                <th>Photos</th>
                <th>Order</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {spaces.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>No spaces found.</td>
                </tr>
              ) : (
                spaces.sort((a, b) => a.sortOrder - b.sortOrder).map((space) => (
                  <tr key={space.id}>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-[#1c1c1a]">{space.name}</span>
                        <span className="text-[11px] text-[#a1a1a0]">{space.slug}</span>
                      </div>
                    </td>
                    <td>
                      <Switch checked={space.isActive} onCheckedChange={(checked) => handleToggleSpaceStatus(space, checked)} />
                    </td>
                    <td>
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
                    <td>
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
                    <td>
                      {/* Uitsnede: object op witte of transparante achtergrond,
                          zonder bijsnijden geüpload; de cirkel op /projects
                          legt hem met multiply op de beige schijf. */}
                      <label className="cursor-pointer inline-flex items-center gap-2 group" title={space.cutoutUrl ? "Click to replace the cut-out" : "Click to upload a cut-out (PNG with transparency or a product photo on white)"}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#f5f5f4" }}>
                          {space.cutoutUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={space.cutoutUrl} alt="" className="group-hover:opacity-70 transition-opacity" style={{ width: "74%", height: "74%", objectFit: "contain", mixBlendMode: "multiply" }} />
                          ) : (
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#a1a1a0" strokeWidth="1.5"><path d="M8 3v10M3 8h10" strokeLinecap="round" /></svg>
                          )}
                        </div>
                        <input type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ""
                          if (!file) return
                          if (file.size > 5 * 1024 * 1024) { toast.error("Cut-out must be under 5MB"); return }
                          const fd = new FormData()
                          fd.append("file", file)
                          fd.append("spaceId", space.id)
                          startTransition(async () => {
                            const result = await uploadSpaceCutoutAction(fd)
                            if (!result.success) toast.error("Upload failed", { description: result.error.message })
                            else { toast.success("Cut-out saved"); router.refresh() }
                          })
                        }} />
                      </label>
                    </td>
                    <td>
                      <span className="text-xs text-[#6b6b68]">{space.photoCount}</span>
                    </td>
                    <td>
                      <span className="text-xs text-[#6b6b68]">{space.sortOrder}</span>
                    </td>
                    <td>
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
                          {space.cutoutUrl && (
                            <DropdownMenuItem
                              onClick={() => startTransition(async () => {
                                const result = await clearSpaceCutoutAction({ spaceId: space.id })
                                if (!result.success) toast.error("Failed to remove", { description: result.error.message })
                                else { toast.success("Cut-out removed"); router.refresh() }
                              })}
                            >
                              Remove cut-out
                            </DropdownMenuItem>
                          )}
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

      {/* Projects tab — building types and partial-project spaces as two collapsible groups */}
      {activeTab === "project" && (
        <ProjectsTab
          types={projectTypeRows}
          spaces={spaces}
          services={professionalItems}
          serviceSpaces={serviceSpaces}
          partialCounts={partialCountBySpace}
          search={searchTerm}
          pending={isPending}
          onEdit={(row) => {
            setEditCategory(row)
            setEditName(row.name)
            setEditNameNl(row.nameNl ?? "")
            setEditPro({ en: row.proName ?? "", nl: row.proNameNl ?? "", enPlural: row.proNamePlural ?? "", nlPlural: row.proNamePluralNl ?? "" })
            setEditSlug(row.slug)
            setEditParentId(row.parentId)
            setEditImageUrl(row.imageUrl)
          }}
          onDelete={(row) => setDeleteTarget(row)}
          onToggleStatus={handleToggleStatus}
          onToggleHomepage={handleToggleHomeCarrousel}
          onToggleSpaceStatus={handleToggleSpaceStatus}
          onToggleSpaceHomepage={handleToggleSpaceHomepage}
          onOpenSpaces={() => router.push("?tab=spaces")}
        />
      )}

      {/* Professionals tab — groups as collapsible rows, companies-table styling */}
      {activeTab === "professional" && (
        <ProfessionalsTab
          items={professionalItems}
          spaces={spaces}
          serviceSpaces={serviceSpaces}
          search={searchTerm}
          pending={isPending}
          onEdit={(row) => {
            setEditCategory(row)
            setEditName(row.name)
            setEditNameNl(row.nameNl ?? "")
            setEditPro({ en: row.proName ?? "", nl: row.proNameNl ?? "", enPlural: row.proNamePlural ?? "", nlPlural: row.proNamePluralNl ?? "" })
            setEditSlug(row.slug)
            setEditParentId(row.parentId)
            setEditImageUrl(row.imageUrl)
          }}
          onDelete={(row) => setDeleteTarget(row)}
          onToggleStatus={handleToggleStatus}
          onToggleHomepage={handleToggleHomeCarrousel}
          onSetPublishScope={handleSetPublishScope}
        />
      )}

      {/* Product Categories tab */}
      {activeTab === "products" && (
        <ProductCategoriesTab productCategories={productCategories} />
      )}

      {/* Connections tab — service ↔ space, product group ↔ space */}
      {activeTab === "links" && (
        <ConnectionsTab
          services={professionalItems}
          spaces={spaces}
          productCategories={productCategories}
          serviceSpaces={serviceSpaces}
          productCategorySpaces={productCategorySpaces}
        />
      )}


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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#6b6b68] block mb-1">Name (EN)</label>
                <input
                  className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Category name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#6b6b68] block mb-1">Name (NL)</label>
                <input
                  className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors"
                  value={editNameNl}
                  onChange={(e) => setEditNameNl(e.target.value)}
                  placeholder={editName || "Nederlandse naam"}
                />
              </div>
            </div>
            {editCategory?.categoryType === "Professional" && editCategory.categoryHierarchy !== 1 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#6b6b68] block mb-1">Professional (EN)</label>
                  <input className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors" value={editPro.en} onChange={(e) => setEditPro((p) => ({ ...p, en: e.target.value }))} placeholder="Pool builder" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#6b6b68] block mb-1">Professional (NL)</label>
                  <input className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors" value={editPro.nl} onChange={(e) => setEditPro((p) => ({ ...p, nl: e.target.value }))} placeholder="Zwembadbouwer" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#6b6b68] block mb-1">Plural (EN)</label>
                  <input className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors" value={editPro.enPlural} onChange={(e) => setEditPro((p) => ({ ...p, enPlural: e.target.value }))} placeholder="Pool builders" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#6b6b68] block mb-1">Plural (NL)</label>
                  <input className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors" value={editPro.nlPlural} onChange={(e) => setEditPro((p) => ({ ...p, nlPlural: e.target.value }))} placeholder="Zwembadbouwers" />
                </div>
                <p className="col-span-2 text-[11px] text-[#a1a1a0] -mt-1">The plural is the heading above the professionals discover, the home cards and the header menu. The category name stays in filters and on company pages.</p>
              </div>
            )}
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

      </div>
    </>
  )
}

/* ── Product Categories sub-component with expandable parents ──────── */

function ProductCategoriesTab({ productCategories }: { productCategories: AdminProductCategoryRow[] }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const parents = useMemo(
    () => productCategories.filter((c) => !c.parentId).sort((a, b) => a.orderIndex - b.orderIndex),
    [productCategories]
  )

  const childrenMap = useMemo(() => {
    const map = new Map<string, AdminProductCategoryRow[]>()
    for (const child of productCategories.filter((c) => c.parentId)) {
      const arr = map.get(child.parentId!) ?? []
      arr.push(child)
      map.set(child.parentId!, arr)
    }
    for (const [, arr] of map) arr.sort((a, b) => a.orderIndex - b.orderIndex)
    return map
  }, [productCategories])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSwap = (a: AdminProductCategoryRow, b: AdminProductCategoryRow) => {
    startTransition(async () => {
      const { swapProductCategoryOrderAction } = await import("@/app/admin/categories/actions")
      const result = await swapProductCategoryOrderAction(a.id, a.orderIndex, b.id, b.orderIndex)
      if (!result.success) {
        toast.error("Failed to reorder")
      } else {
        router.refresh()
      }
    })
  }

  const ArrowButtons = ({ item, siblings }: { item: AdminProductCategoryRow; siblings: AdminProductCategoryRow[] }) => {
    const idx = siblings.findIndex((s) => s.id === item.id)
    const isFirst = idx === 0
    const isLast = idx === siblings.length - 1
    return (
      <div style={{ display: "flex", gap: 2 }}>
        <button
          type="button"
          disabled={isFirst}
          onClick={() => handleSwap(item, siblings[idx - 1])}
          style={{ background: "none", border: "none", cursor: isFirst ? "default" : "pointer", padding: 2, opacity: isFirst ? 0.2 : 0.5, transition: "opacity 0.1s" }}
          title="Move up"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 15l-6-6-6 6" /></svg>
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => handleSwap(item, siblings[idx + 1])}
          style={{ background: "none", border: "none", cursor: isLast ? "default" : "pointer", padding: 2, opacity: isLast ? 0.2 : 0.5, transition: "opacity 0.1s" }}
          title="Move down"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
    )
  }

  return (
    <div className="arco-table-wrap max-w-full min-w-0">
      <table className="arco-table">
        <thead>
          <tr>
            <th>Category</th>
            <th style={{ width: 60 }}>Order</th>
          </tr>
        </thead>
        <tbody>
          {parents.length === 0 ? (
            <tr>
              <td colSpan={2} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>No product categories found.</td>
            </tr>
          ) : (
            parents.map((parent) => {
              const isExpanded = expanded.has(parent.id)
              const children = childrenMap.get(parent.id) ?? []
              const hasSubs = children.length > 0

              return (
                <Fragment key={parent.id}>
                  <tr>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {hasSubs ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(parent.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}
                          >
                            <svg
                              width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#a1a1a0" strokeWidth="1.2" strokeLinecap="round"
                              style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }}
                            >
                              <path d="M3 2L7 5L3 8" />
                            </svg>
                          </button>
                        ) : (
                          <div style={{ width: 14 }} />
                        )}
                        <div>
                          <div className="arco-table-primary" style={{ fontWeight: 500 }}>{parent.name}</div>
                          <div className="arco-table-secondary">{parent.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td><ArrowButtons item={parent} siblings={parents} /></td>
                  </tr>
                  {isExpanded && children.map((child) => {
                    const grandchildren = childrenMap.get(child.id) ?? []
                    const hasGrand = grandchildren.length > 0
                    const isChildExpanded = expanded.has(child.id)

                    return (
                      <Fragment key={child.id}>
                        <tr>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 24 }}>
                              {hasGrand ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(child.id)}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}
                                >
                                  <svg
                                    width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#a1a1a0" strokeWidth="1.2" strokeLinecap="round"
                                    style={{ transform: isChildExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }}
                                  >
                                    <path d="M3 2L7 5L3 8" />
                                  </svg>
                                </button>
                              ) : (
                                <div style={{ width: 14 }} />
                              )}
                              <div>
                                <div className="arco-table-primary">{child.name}</div>
                                <div className="arco-table-secondary">{child.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td><ArrowButtons item={child} siblings={children} /></td>
                        </tr>
                        {isChildExpanded && grandchildren.map((gc) => (
                          <tr key={gc.id}>
                            <td>
                              <div style={{ paddingLeft: 52 }}>
                                <div className="arco-table-primary">{gc.name}</div>
                                <div className="arco-table-secondary">{gc.slug}</div>
                              </div>
                            </td>
                            <td><ArrowButtons item={gc} siblings={grandchildren} /></td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
