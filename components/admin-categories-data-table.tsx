"use client"

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AdminTabs, useAdminTab } from "@/components/admin/admin-tabs"
import { MoreHorizontal, Plus } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import {
  createCategoryAction,
  deleteCategoryAction,
  setPublishScopeAction,
  toggleCategoryStatusAction,
  toggleHomeCarrouselAction,
  toggleSpaceHomeCarrouselAction,
  toggleSpaceStatusAction,
  toggleServiceSpaceAction,
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
import { ProfessionalsTab } from "@/components/admin-categories-professionals"
import { ProjectsTab } from "@/components/admin-categories-projects"
import { SpacesTab } from "@/components/admin-categories-spaces"
import { useLocale } from "next-intl"
import { publishScopeLabel, type PublishScope } from "@/lib/publish-scope"

export type AdminCategoryRow = {
  id: string
  name: string
  /** Nederlandse naam (categories.name_nl); null = valt terug op name. */
  nameNl: string | null
  /** Beroepsnaam, alleen voor diensten: Pool builder / Zwembadbouwer en
   *  het meervoud voor koppen en menu's. */
  proNamePlural: string | null
  proNamePluralNl: string | null
  /** Marktomvang NL: bedrijven in de dienst (TAM) en daarvan geschikt voor Arco (SAM). */
  tamNl: number | null
  samNl: number | null
  /** Bedrijven met deze hoofddienst die in Sales staan (niet verwijderd). */
  inSales?: number
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
  /** Scopes die deze dienst in het scopevak ziet (migratie 314); leeg = alle. */
  projectScopes?: string[]
  count: number
}

type TabKey = "project" | "professional" | "spaces" | "products"
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
  nameNl?: string | null
  /** Inactief: niet in menu en filters (migratie 320). */
  isActive: boolean
  /** Merken en collecties in deze categorie en alles eronder. */
  brandCount: number
  collectionCount: number
  /** Eigen beeld voor de schijf op /products (migratie 321). */
  imageUrl?: string | null
  /** Wat /products zonder eigen beeld toont: een productfoto uit de groep. */
  autoImageUrl?: string | null
}

interface Props {
  categories: AdminCategoryRow[]
  spaces?: AdminSpaceRow[]
  productCategories?: AdminProductCategoryRow[]
  /** Dienst ↔ ruimte en productgroep ↔ ruimte (migratie 297). */
  serviceSpaces?: Array<{ serviceId: string; spaceId: string }>
  /** Deelprojecten per ruimte-id (projects.kind = 'partial'). */
  partialCountBySpace?: Record<string, number>
  /** Aantal projecten per scope (new_build, renovation, interior_design). */
  scopeCounts?: Record<string, number>
}

export function AdminCategoriesDataTable({ categories, spaces = [], productCategories = [], serviceSpaces = [], scopeCounts = {}, partialCountBySpace = {} }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // De paginakop, tabs en knoppen volgen de taalkeuze in de header
  // (EN/NL), zoals het merkdashboard. De inhoud van de Professionals-tab
  // doet dat ook; de andere tabs zijn nog Engels.
  const nl = useLocale() === "nl"
  // Tab lives in the URL (?tab=…) via the sticky bar; per-tab view state
  // resets on change (the old handleTabChange behaviour), skipping mount.
  const activeTab = useAdminTab(["project", "professional", "spaces", "products"] as const)

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
  const [editMarket, setEditMarket] = useState({ tam: "", sam: "" })
  // Ruimtes waaronder een dienst deelprojecten publiceert (service_spaces),
  // direct bewerkbaar in het bewerkvenster van de dienst.
  const [editSpaceIds, setEditSpaceIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!editCategory) return
    setEditSpaceIds(new Set(serviceSpaces.filter((l) => l.serviceId === editCategory.id).map((l) => l.spaceId)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCategory?.id])
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
          ? { tamNl: editMarket.tam.trim() === "" ? null : Number(editMarket.tam), samNl: editMarket.sam.trim() === "" ? null : Number(editMarket.sam), proNamePlural: editPro.enPlural.trim() || null, proNamePluralNl: editPro.nlPlural.trim() || null }
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
          { key: "products", label: nl ? "Producten" : "Products" },
        ]}
        active={activeTab}
        actions={activeTab === "project" || activeTab === "professional" || activeTab === "spaces" ? (
          <>
          <div className="relative shrink-0" style={{ width: 220 }}>
          <input
            type="text"
            placeholder={activeTab === "project" ? (nl ? "Zoek types\u2026" : "Search types\u2026") : activeTab === "spaces" ? (nl ? "Zoek ruimtes\u2026" : "Search spaces\u2026") : nl ? "Zoek diensten\u2026" : "Search services\u2026"}
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
          {activeTab !== "spaces" && (
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
          )}
          </>
        ) : undefined}
      />

      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 48 }}>

    <div className="flex flex-col gap-6 min-w-0 max-w-full overflow-hidden">
      {/* Page meta — count in the discover style */}
      {activeTab !== "spaces" && (
        <div className="discover-results-meta" style={{ marginBottom: 0 }}>
          <p className="discover-results-count">
            <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{currentItems.length}</strong> {nl ? "totaal" : "total"} &middot; {activeCount} {nl ? "actief" : "active"}
          </p>
        </div>
      )}


      {/* Spaces tab — same design as Projects and Professionals */}
      {activeTab === "spaces" && (
        <SpacesTab
          spaces={spaces}
          services={professionalItems}
          serviceSpaces={serviceSpaces}
          search={searchTerm}
          pending={isPending}
          onToggleStatus={handleToggleSpaceStatus}
          onToggleHomepage={handleToggleSpaceHomepage}
          onPickImage={(space, file) => {
            if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10MB"); return }
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
          }}
          onUploadCutout={(space, file) => {
            if (file.size > 5 * 1024 * 1024) { toast.error("Cut-out must be under 5MB"); return }
            const fd = new FormData()
            fd.append("file", file)
            fd.append("spaceId", space.id)
            startTransition(async () => {
              const result = await uploadSpaceCutoutAction(fd)
              if (!result.success) toast.error("Upload failed", { description: result.error.message })
              else { toast.success("Cut-out saved"); router.refresh() }
            })
          }}
          onClearCutout={(space) => startTransition(async () => {
            const result = await clearSpaceCutoutAction({ spaceId: space.id })
            if (!result.success) toast.error("Failed to remove", { description: result.error.message })
            else { toast.success("Cut-out removed"); router.refresh() }
          })}
        />
      )}

      {/* Projects tab — building types and partial-project spaces as two collapsible groups */}
      {activeTab === "project" && (
        <ProjectsTab
          types={projectTypeRows}
          spaces={spaces}
          services={professionalItems}
          serviceSpaces={serviceSpaces}
          partialCounts={partialCountBySpace}
          scopeCounts={scopeCounts}
          search={searchTerm}
          pending={isPending}
          onEdit={(row) => {
            setEditCategory(row)
            setEditName(row.name)
            setEditNameNl(row.nameNl ?? "")
            setEditMarket({ tam: row.tamNl == null ? "" : String(row.tamNl), sam: row.samNl == null ? "" : String(row.samNl) })
            setEditPro({ en: "", nl: "", enPlural: row.proNamePlural ?? "", nlPlural: row.proNamePluralNl ?? "" })
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
            setEditMarket({ tam: row.tamNl == null ? "" : String(row.tamNl), sam: row.samNl == null ? "" : String(row.samNl) })
            setEditPro({ en: "", nl: "", enPlural: row.proNamePlural ?? "", nlPlural: row.proNamePluralNl ?? "" })
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
        <ProductCategoriesTab productCategories={productCategories} nl={nl} />
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
                  <label className="text-xs font-medium text-[#6b6b68] block mb-1">Plural (EN)</label>
                  <input className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors" value={editPro.enPlural} onChange={(e) => setEditPro((p) => ({ ...p, enPlural: e.target.value }))} placeholder="Pool builders" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#6b6b68] block mb-1">Plural (NL)</label>
                  <input className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors" value={editPro.nlPlural} onChange={(e) => setEditPro((p) => ({ ...p, nlPlural: e.target.value }))} placeholder="Zwembadbouwers" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#6b6b68] block mb-1">TAM NL</label>
                  <input type="number" min={0} className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors" value={editMarket.tam} onChange={(e) => setEditMarket((m) => ({ ...m, tam: e.target.value }))} placeholder={nl ? "Bedrijven in NL" : "Companies in NL"} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#6b6b68] block mb-1">SAM NL</label>
                  <input type="number" min={0} className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors" value={editMarket.sam} onChange={(e) => setEditMarket((m) => ({ ...m, sam: e.target.value }))} placeholder={nl ? "Geschikt voor Arco" : "Suitable for Arco"} />
                </div>
                <p className="col-span-2 text-[11px] text-[#a1a1a0] -mt-1">The name is the category everywhere: filter, picker and company page. The plural is the heading above the professionals discover, the home cards and the header menu.</p>
              </div>
            )}
            {editCategory?.categoryType === "Professional" && editCategory.categoryHierarchy !== 1 && editCategory.publishScope === "partial" && (
              <div>
                <label className="text-xs font-medium text-[#6b6b68] block mb-1">{nl ? "Publiceert deelprojecten onder" : "Publishes partial projects under"}</label>
                <div className="flex flex-wrap gap-1.5">
                  {spaces.filter((s) => s.isActive && !["exterior", "other"].includes(s.slug)).sort((a, b) => a.sortOrder - b.sortOrder).map((s) => {
                    const on = editSpaceIds.has(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className="filter-pill"
                        data-active={on ? "true" : undefined}
                        style={{ fontSize: 12 }}
                        onClick={() => {
                          const target = editCategory
                          const next = new Set(editSpaceIds)
                          if (on) next.delete(s.id); else next.add(s.id)
                          setEditSpaceIds(next)
                          startTransition(async () => {
                            const result = await toggleServiceSpaceAction({ serviceId: target.id, spaceId: s.id, enabled: !on })
                            if (!result.success) {
                              toast.error("Failed to update", { description: result.error.message })
                              setEditSpaceIds(editSpaceIds)
                            } else {
                              router.refresh()
                            }
                          })
                        }}
                      >
                        {s.name}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-[#a1a1a0] mt-1.5">{nl ? "Een deelproject van deze dienst verschijnt onder deze ruimtefilters; het scopevak in de editor biedt deze ruimtes aan." : "A partial project from this service appears under these space filters; the scope field in the editor offers these spaces."}</p>
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

function ProductCategoriesTab({ productCategories, nl }: { productCategories: AdminProductCategoryRow[]; nl: boolean }) {
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

  const label = (c: AdminProductCategoryRow) => (nl ? c.nameNl ?? c.name : c.name)

  // Status zoals bij diensten: klik wisselt. Inactief haalt de categorie en
  // alles eronder uit menu en filters; koppelingen blijven staan.
  const handleToggleActive = (item: AdminProductCategoryRow) => {
    startTransition(async () => {
      const { setProductCategoryActiveAction } = await import("@/app/admin/categories/actions")
      const result = await setProductCategoryActiveAction(item.id, !item.isActive)
      if (!result.success) toast.error(nl ? "Status wijzigen mislukt" : "Failed to change status")
      else router.refresh()
    })
  }

  // Beeld voor de schijf op /products (alleen hoofdgroepen staan daar):
  // eigen uitsnede, anders automatisch een productfoto uit de groep.
  const handleImage = (item: AdminProductCategoryRow, file: File | null) => {
    startTransition(async () => {
      const { uploadProductCategoryImageAction, clearProductCategoryImageAction } = await import("@/app/admin/categories/actions")
      let ok = false
      if (file) {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("categoryId", item.id)
        ok = (await uploadProductCategoryImageAction(fd)).success
      } else {
        ok = (await clearProductCategoryImageAction(item.id)).success
      }
      if (!ok) toast.error(nl ? "Beeld opslaan mislukt" : "Failed to save image")
      else router.refresh()
    })
  }

  const imageCell = (item: AdminProductCategoryRow) => {
    const url = item.imageUrl ?? item.autoImageUrl ?? null
    return (
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            title={item.imageUrl ? (nl ? "Eigen beeld" : "Custom image") : (nl ? "Automatisch: productfoto uit de groep" : "Automatic: product photo from the group")}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--arco-surface)", overflow: "hidden", flexShrink: 0, opacity: item.imageUrl ? 1 : 0.6 }}
          >
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "12%", boxSizing: "border-box", mixBlendMode: "multiply" }} />
            )}
          </div>
          <label className="arco-table-secondary" style={{ cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
            {item.imageUrl ? (nl ? "Wijzig" : "Change") : (nl ? "Upload" : "Upload")}
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; if (f) handleImage(item, f) }}
            />
          </label>
          {item.imageUrl && (
            <button type="button" className="arco-table-secondary" onClick={() => handleImage(item, null)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }} title={nl ? "Terug naar automatisch" : "Back to automatic"}>
              ✕
            </button>
          )}
        </div>
      </td>
    )
  }

  const cells = (item: AdminProductCategoryRow) => (
    <>
      <td>
        <button
          type="button"
          className="arco-table-status"
          title={item.isActive ? (nl ? "Klik om te verbergen" : "Click to hide") : (nl ? "Klik om te tonen" : "Click to show")}
          onClick={() => handleToggleActive(item)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span className={cn("arco-table-status-dot", item.isActive ? "bg-emerald-500" : "bg-[#d4d4d3]")} />
          <span>{item.isActive ? (nl ? "Actief" : "Active") : (nl ? "Inactief" : "Inactive")}</span>
        </button>
      </td>
      <td className="arco-table-nowrap" style={{ fontVariantNumeric: "tabular-nums", color: item.brandCount ? undefined : "var(--text-disabled)" }}>{item.brandCount}</td>
      <td className="arco-table-nowrap" style={{ fontVariantNumeric: "tabular-nums", color: item.collectionCount ? undefined : "var(--text-disabled)" }}>{item.collectionCount}</td>
    </>
  )

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
            <th>{nl ? "Categorie" : "Category"}</th>
            <th style={{ width: 150 }}>{nl ? "Beeld" : "Image"}</th>
            <th style={{ width: 120 }}>Status</th>
            <th style={{ width: 100 }}>{nl ? "Merken" : "Brands"}</th>
            <th style={{ width: 100 }}>{nl ? "Collecties" : "Collections"}</th>
            <th style={{ width: 60 }}>{nl ? "Volgorde" : "Order"}</th>
          </tr>
        </thead>
        <tbody>
          {parents.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>No product categories found.</td>
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
                          <div className="arco-table-primary" style={{ fontWeight: 500 }}>{label(parent)}</div>
                          <div className="arco-table-secondary">{parent.slug}</div>
                        </div>
                      </div>
                    </td>
                    {imageCell(parent)}
                    {cells(parent)}
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
                                <div className="arco-table-primary">{label(child)}</div>
                                <div className="arco-table-secondary">{child.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td />
                          {cells(child)}
                          <td><ArrowButtons item={child} siblings={children} /></td>
                        </tr>
                        {isChildExpanded && grandchildren.map((gc) => (
                          <tr key={gc.id}>
                            <td>
                              <div style={{ paddingLeft: 52 }}>
                                <div className="arco-table-primary">{label(gc)}</div>
                                <div className="arco-table-secondary">{gc.slug}</div>
                              </div>
                            </td>
                            <td />
                            {cells(gc)}
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
