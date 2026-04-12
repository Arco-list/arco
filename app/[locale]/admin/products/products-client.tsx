"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { MoreHorizontal } from "lucide-react"
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
  const [search, setSearch] = useState("")
  const [brandFilter, setBrandFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

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

  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="flex flex-col gap-1 mb-6">
        <h3 className="arco-section-title">Products</h3>
        <p className="text-xs text-[#a1a1a0] mt-0.5">
          {isFiltered
            ? `${filtered.length} of ${initialProducts.length} products`
            : `${initialProducts.length} ${initialProducts.length === 1 ? "product" : "products"}`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-6">
        <div className="flex flex-1 items-center">
          <input
            type="text"
            placeholder="Search by product, brand, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors placeholder:text-[#a1a1a0]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue>{brandFilter === "all" ? "All brands" : brandOptions.find((b) => b.id === brandFilter)?.name ?? brandFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {brandOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue>{categoryFilter === "all" ? "All categories" : categoryFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue>{statusFilter === "all" ? "All statuses" : STATUS_LABEL[statusFilter] ?? statusFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
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
        </div>
      </div>

      <div className="arco-table-wrap">
        <table className="arco-table" style={{ minWidth: 1000 }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Brand</th>
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
                <td colSpan={7} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  {isFiltered ? "No products match your filters." : "No products yet. Scrape products from a brand page in /admin/brands."}
                </td>
              </tr>
            ) : (
              filtered.map((product) => {
                const subtitle = [product.brand?.name, product.category?.name].filter(Boolean).join(" · ")
                return (
                  <tr key={product.id}>
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
                            <Link href={`/products/${product.slug}`} target="_blank">Open public page</Link>
                          </DropdownMenuItem>
                          {product.source_url && (
                            <DropdownMenuItem asChild>
                              <a href={product.source_url} target="_blank" rel="noopener noreferrer">View source URL</a>
                            </DropdownMenuItem>
                          )}
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
  )
}
