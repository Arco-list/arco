"use client"

import { AdminTabs } from "@/components/admin/admin-tabs"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import { MoreHorizontal } from "lucide-react"
import { deleteProduct, deleteProducts } from "@/app/admin/brands/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AdminProductRow } from "./page"

const STATUS_DOT: Record<string, string> = {
  listed: "#7c3aed",
  unlisted: "#a1a1a0",
}

const STATUS_LABEL: Record<string, string> = {
  listed: "Listed",
  unlisted: "Unlisted",
}

type BrandOption = { id: string; name: string }
type CategoryOption = { name: string }

interface Props {
  initialProducts: AdminProductRow[]
  brandOptions: BrandOption[]
  categoryOptions: CategoryOption[]
}

export function ProductsClient({ initialProducts, brandOptions, categoryOptions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [brandFilter, setBrandFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const handleDeleteOne = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteProduct(id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Product deleted")
        router.refresh()
      }
    })
  }

  const handleDeleteSelected = () => {
    if (!confirm(`Delete ${selected.size} products? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteProducts([...selected])
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(`Deleted ${result.deleted} products`)
        setSelected(new Set())
        router.refresh()
      }
    })
  }

  const filtered = useMemo(() => {
    return initialProducts.filter((p) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const match =
          p.name.toLowerCase().includes(q) ||
          (p.brand?.name ?? "").toLowerCase().includes(q) ||
          (p.category?.name ?? "").toLowerCase().includes(q)
        if (!match) return false
      }
      if (brandFilter !== "all" && p.brand?.id !== brandFilter) return false
      if (categoryFilter !== "all" && (p.category?.name ?? "") !== categoryFilter) return false
      if (statusFilter !== "all" && p.status !== statusFilter) return false
      return true
    })
  }, [initialProducts, search, brandFilter, categoryFilter, statusFilter])

  const isFiltered = search.trim() || brandFilter !== "all" || categoryFilter !== "all" || statusFilter !== "all"

  const allFilteredIds = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered])
  const allSelected = selected.size > 0 && filtered.every((p) => selected.has(p.id))
  const someSelected = selected.size > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((p) => p.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <AdminTabs
        title="Products"
        actions={
          <>
          <div className="relative shrink-0" style={{ width: 260 }}>
            <input
              type="text"
              placeholder="Search by product, brand, or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-8 text-xs border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors placeholder:text-[#a1a1a0]"
            />
            <svg className="absolute left-2.5 top-2.5 text-[#a1a1a0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-[3px] text-[#a1a1a0] hover:text-[#1c1c1a] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs shrink-0 border-[#e5e5e4] rounded-[3px]">
              <SelectValue>{brandFilter === "all" ? "All brands" : brandOptions.find((b) => b.id === brandFilter)?.name ?? brandFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent className="z-[120]">
              <SelectItem value="all">All brands</SelectItem>
              {brandOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs shrink-0 border-[#e5e5e4] rounded-[3px]">
              <SelectValue>{categoryFilter === "all" ? "All categories" : categoryFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent className="z-[120]">
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs shrink-0 border-[#e5e5e4] rounded-[3px]">
              <SelectValue>{statusFilter === "all" ? "All statuses" : STATUS_LABEL[statusFilter] ?? statusFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent className="z-[120]">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="listed">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT.listed }} />
                  Listed
                </span>
              </SelectItem>
              <SelectItem value="unlisted">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT.unlisted }} />
                  Unlisted
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          </>
        }
      />

      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 48 }}>

    <div style={{ paddingBottom: 80 }}>
      {/* Page meta — count in the discover style */}
      <div className="discover-results-meta" style={{ marginBottom: 16 }}>
        <p className="discover-results-count">
          <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{isFiltered ? filtered.length : initialProducts.length}</strong>
          {isFiltered ? ` of ${initialProducts.length} products` : ` ${initialProducts.length === 1 ? "product" : "products"}`}
        </p>
      </div>


      {/* Selection bar */}
      {someSelected && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", marginBottom: 8, background: "var(--arco-surface)", borderRadius: 4 }}>
          <span className="arco-small-text">
            <strong style={{ color: "var(--text-primary)" }}>{selected.size}</strong> selected
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-tertiary"
              style={{ fontSize: 12, padding: "4px 12px" }}
              onClick={() => setSelected(new Set())}
            >
              Deselect all
            </button>
            <button
              type="button"
              className="btn-tertiary"
              style={{ fontSize: 12, padding: "4px 12px", color: "var(--destructive)" }}
              onClick={handleDeleteSelected}
              disabled={isPending}
            >
              {isPending ? "Deleting…" : `Delete ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      <div className="arco-table-wrap">
        <table className="arco-table" style={{ minWidth: 1000 }}>
          <thead>
            <tr>
              <th style={{ width: 32, paddingRight: 0 }}>
                <input
                  type="checkbox"
                  className="arco-table-checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              <th>Product</th>
              <th>Brand</th>
              <th>Family</th>
              <th>Category</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Photos</th>
              <th>Created</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  {isFiltered ? "No products match your filters." : "No products yet. Scrape products from a brand page in /admin/brands."}
                </td>
              </tr>
            ) : (
              filtered.map((product) => {
                const subtitle = [product.brand?.name, product.category?.name].filter(Boolean).join(" · ")
                return (
                  <tr key={product.id}>
                    <td style={{ paddingRight: 0 }}>
                      <input
                        type="checkbox"
                        className="arco-table-checkbox"
                        checked={selected.has(product.id)}
                        onChange={() => toggleOne(product.id)}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {product.primary_photo ? (
                          <div className="arco-table-avatar">
                            <img src={product.primary_photo} alt={product.name} />
                          </div>
                        ) : (
                          <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/admin/products/${product.id}`} className="arco-table-primary arco-table-primary--wrap hover:text-[#016D75] transition-colors">
                            {product.name}
                          </Link>
                          {subtitle && (
                            <div className="arco-table-secondary">{subtitle}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {product.brand ? (
                        <Link href={`/admin/brands/${product.brand.id}`} className="arco-table-primary hover:opacity-70 transition-opacity" style={{ fontWeight: 400 }}>
                          {product.brand.name}
                        </Link>
                      ) : (
                        <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>
                      )}
                    </td>
                    <td>{product.family?.name ?? <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>}</td>
                    <td>{product.category?.name ?? <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>}</td>
                    <td>
                      <span className="arco-table-status">
                        <span className="arco-table-status-dot" style={{ background: STATUS_DOT[product.status] ?? "#a1a1a0" }} />
                        <span style={{ fontWeight: 500 }}>{STATUS_LABEL[product.status] ?? product.status}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>{product.photo_count}</td>
                    <td className="arco-table-nowrap">{format(new Date(product.created_at), "dd MMM yyyy")}</td>
                    <td style={{ textAlign: "center" }}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="arco-table-action" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/products/${product.id}`}>View product</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/products/${product.brand?.slug ?? "_"}/${product.slug}`} target="_blank">Open public page</Link>
                          </DropdownMenuItem>
                          {product.source_url && (
                            <DropdownMenuItem asChild>
                              <a href={product.source_url} target="_blank" rel="noopener noreferrer">View source URL</a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDeleteOne(product.id, product.name)}
                            className="text-red-600"
                          >
                            Delete product
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>

      </div>
    </>
  )
}
