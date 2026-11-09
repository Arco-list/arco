"use client"

import { Fragment, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, Check, MoreHorizontal, X } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

import { AdminTabs } from "@/components/admin/admin-tabs"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { addBrandFromSite, deleteBrand, discoverBrandSeries, fetchSeriesFromBrandPage, updateBrandStatus } from "./actions"
import type { AdminBrandRow } from "./page"
import { ALL_STATUSES, STATUS_DESC, STATUS_DOT, STATUS_LABEL, type BrandStatus } from "./status"

/**
 * Merken in admin — dezelfde werkbank als Companies: sticky balk met
 * zoeken, statusfilter en de primaire actie; statusfunnel als
 * klikbare kaarten; de tabel eronder.
 *
 * De funnel is korter dan die van bedrijven: Added → Showcased →
 * Listed, met Unlisted en Deactivated geparkeerd. Labels, kleuren
 * en uitleg staan in ./status, gedeeld met de merkpagina.
 */

type TaggedFilter = "all" | "tagged" | "untagged"

type StepStatus = "pending" | "active" | "done" | "error"
type AddPhase = "input" | "processing" | "done" | "error"
const ADD_STEPS = ["Brand from the homepage", "Series on the page", "Photos from each series page"] as const

export function BrandsClient({ initialBrands }: { initialBrands: AdminBrandRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Filters ──────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<BrandStatus[]>([])
  const [taggedFilter, setTaggedFilter] = useState<TaggedFilter>("all")

  const toggleStatus = (s: BrandStatus) =>
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  // Alles behalve status — de funnelkaarten zíjn het statusfilter, dus
  // ze tellen over de cohort die zoeken en tagging overlaten.
  const funnelData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return initialBrands.filter((b) => {
      if (taggedFilter === "tagged" && b.project_count === 0) return false
      if (taggedFilter === "untagged" && b.project_count > 0) return false
      if (!q) return true
      return [b.name, b.domain ?? "", b.country ?? "", b.owner_name ?? ""].join(" ").toLowerCase().includes(q)
    })
  }, [initialBrands, searchTerm, taggedFilter])

  const rows = useMemo(
    () => (statusFilter.length === 0 ? funnelData : funnelData.filter((b) => statusFilter.includes(b.status as BrandStatus))),
    [funnelData, statusFilter],
  )

  // ── Funnel ───────────────────────────────────────────────────────────
  const countAt = (s: BrandStatus) => funnelData.filter((b) => b.status === s).length
  // Cohort = alles dat in of voorbij deze stap zit. Deactivated is een
  // afrit en telt nergens in door.
  const cohortFor = (s: BrandStatus): number => {
    switch (s) {
      case "unclaimed": return countAt("unclaimed") + countAt("prospected") + countAt("unlisted") + countAt("listed")
      case "prospected": return countAt("prospected") + countAt("unlisted") + countAt("listed")
      case "listed": return countAt("listed") + countAt("unlisted")
      case "unlisted": return countAt("unlisted")
      case "deactivated": return countAt("deactivated")
    }
  }
  const rate = (from: number, to: number) => (from === 0 ? "0%" : `${Math.round((to / from) * 100)}%`)

  const FUNNEL: { status: BrandStatus; driver: "prospect" | "retention" | null }[] = [
    { status: "unclaimed", driver: null },
    { status: "prospected", driver: "prospect" },
    { status: "listed", driver: "retention" },
  ]
  const DRIVER_COLORS = { prospect: "#f59e0b", retention: "#7c3aed" }
  const CARD_WIDTH = 132

  // ── Add brand (scrape) ───────────────────────────────────────────────
  // ── Add brand: drie stappen, elk een eigen server action, zodat de
  //    popup kan laten zien waar hij is — zoals de projectupload. ────────
  const [showAdd, setShowAdd] = useState(false)
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [addPhase, setAddPhase] = useState<AddPhase>("input")
  const [addSteps, setAddSteps] = useState<StepStatus[]>(["pending", "pending", "pending"])
  const [addNotes, setAddNotes] = useState<string[]>(["", "", ""])
  const [addError, setAddError] = useState<string | null>(null)
  const [addBrand, setAddBrand] = useState<{ id: string; name: string } | null>(null)
  const [photoProgress, setPhotoProgress] = useState({ done: 0, total: 0, current: "" })
  const isScraping = addPhase === "processing"

  const openAdd = () => {
    setAddPhase("input"); setAddSteps(["pending", "pending", "pending"]); setAddNotes(["", "", ""])
    setAddError(null); setAddBrand(null); setPhotoProgress({ done: 0, total: 0, current: "" })
    setShowAdd(true)
  }
  const closeAdd = () => { if (!isScraping) { setShowAdd(false); setScrapeUrl("") } }
  const setStep = (i: number, status: StepStatus, note?: string) => {
    setAddSteps((prev) => prev.map((s, j) => (j === i ? status : s)))
    if (note !== undefined) setAddNotes((prev) => prev.map((n, j) => (j === i ? note : n)))
  }

  const handleScrape = async () => {
    const url = scrapeUrl.trim()
    if (!url) return
    setAddPhase("processing")
    setAddSteps(["active", "pending", "pending"]); setAddNotes(["", "", ""]); setAddError(null)

    // 1. Het merk, van de homepage.
    const brand = await addBrandFromSite(url)
    if ("error" in brand) { setStep(0, "error"); setAddError(brand.error); setAddPhase("error"); return }
    setAddBrand({ id: brand.brandId, name: brand.name })
    setStep(0, "done", brand.created ? `${brand.name} — added from the homepage` : `${brand.name} — already in the list`)

    // 2. De series van de geplakte pagina.
    setStep(1, "active")
    const series = await discoverBrandSeries(brand.brandId, url)
    if ("error" in series) { setStep(1, "error"); setAddError(series.error); setAddPhase("error"); return }
    setStep(1, "done", `${series.seriesFound} found · ${series.seriesAdded} new`)

    // 3. Elke seriepagina: foto's, designer, jaar, omschrijving — drie
    //    tegelijk, elk een eigen call, zodat de teller echt loopt.
    const queue = series.pending
    if (queue.length === 0) {
      setStep(2, "done", "Nothing left to read")
    } else {
      setStep(2, "active")
      setPhotoProgress({ done: 0, total: queue.length, current: queue[0].name })
      let next = 0, done = 0, photos = 0, failed = 0
      const worker = async () => {
        while (next < queue.length) {
          const item = queue[next++]
          setPhotoProgress((p) => ({ ...p, current: item.name }))
          const r = await fetchSeriesFromBrandPage(item.id)
          if ("error" in r) failed++
          else photos += r.photos
          done++
          setPhotoProgress((p) => ({ ...p, done }))
        }
      }
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker))
      setStep(2, "done", `${photos} photos from ${done - failed} series${failed > 0 ? ` · ${failed} could not be read` : ""}`)
    }

    setAddPhase("done")
    router.refresh()
  }

  // ── Status / delete dialogs ──────────────────────────────────────────
  const [statusBrand, setStatusBrand] = useState<AdminBrandRow | null>(null)
  const [statusValue, setStatusValue] = useState<BrandStatus>("unclaimed")
  const [deleteTarget, setDeleteTarget] = useState<AdminBrandRow | null>(null)

  const openStatus = (b: AdminBrandRow) => { setStatusBrand(b); setStatusValue(b.status as BrandStatus) }
  const saveStatus = () => {
    if (!statusBrand) return
    startTransition(async () => {
      const result = await updateBrandStatus(statusBrand.id, statusValue)
      if ("error" in result) { toast.error(result.error); return }
      toast.success(`${statusBrand.name} → ${STATUS_LABEL[statusValue]}`)
      setStatusBrand(null)
      router.refresh()
    })
  }
  const confirmDelete = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteBrand(deleteTarget.id)
      if ("error" in result) { toast.error(result.error); return }
      toast.success(`Deleted ${deleteTarget.name}`)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  const dash = <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>

  return (
    <>
      <AdminTabs
        title="Brands"
        actions={
          <>
            <div className="relative shrink-0" style={{ width: 260 }}>
              <input
                type="text"
                placeholder="Search by brand, domain, or owner…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-8 pr-8 text-xs border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
              />
              <svg className="absolute left-2.5 top-2.5 text-[#a1a1a0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {searchTerm && (
                <button type="button" aria-label="Clear search" onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-[3px] text-[#a1a1a0] hover:text-[#1c1c1a] transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {/* Statusfilter — meerkeuze, gesynchroniseerd met de funnelkaarten. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`w-[140px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${statusFilter.length > 0 ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"}`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {statusFilter.length === 0 ? (
                      <span className="text-[#6b6b68]">All statuses</span>
                    ) : statusFilter.length === 1 ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT[statusFilter[0]] }} />
                        <span className="truncate">{STATUS_LABEL[statusFilter[0]]}</span>
                      </>
                    ) : (
                      <span>{statusFilter.length} statuses</span>
                    )}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[180px] z-[120]">
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); if (statusFilter.length > 0) setStatusFilter([]) }} className="text-xs">
                  Clear selection
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(["listed", "unlisted", "prospected", "unclaimed", "deactivated"] as BrandStatus[]).map((s) => (
                  <DropdownMenuCheckboxItem key={s} checked={statusFilter.includes(s)} onCheckedChange={() => toggleStatus(s)} onSelect={(e) => e.preventDefault()} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT[s] }} />
                      {STATUS_LABEL[s]}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Getagd of niet — het merk-equivalent van "heeft gepubliceerd werk". */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`w-[150px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${taggedFilter !== "all" ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"}`}
                >
                  <span className={taggedFilter === "all" ? "text-[#6b6b68]" : ""}>
                    {taggedFilter === "all" ? "All brands" : taggedFilter === "tagged" ? "In projects" : "Not in projects"}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[180px] z-[120]">
                {([["all", "All brands"], ["tagged", "In projects"], ["untagged", "Not in projects"]] as [TaggedFilter, string][]).map(([v, label]) => (
                  <DropdownMenuCheckboxItem key={v} checked={taggedFilter === v} onCheckedChange={() => setTaggedFilter(v)} onSelect={(e) => e.preventDefault()} className="text-xs">
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button type="button" className="btn-primary shrink-0" style={{ height: 36, fontSize: 13, padding: "0 16px" }} onClick={() => openAdd()}>
              Add brand
            </button>
          </>
        }
      />

      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 80 }}>
        {/* ── Statusfunnel — zelfde tekening als Companies ───────────── */}
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0" style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: FUNNEL.map((_, i) => (i === 0 ? "auto" : "1fr auto")).join(" "),
              gridTemplateRows: "auto auto auto",
              gap: 0,
              alignItems: "start",
            }}
          >
            {/* Driver-labels, rij 1 */}
            {FUNNEL.map((stage, i) => stage.driver && (
              <p key={`driver-${stage.status}`} className="arco-eyebrow" style={{ gridRow: 1, gridColumn: i * 2 + 1, color: DRIVER_COLORS[stage.driver], marginBottom: 8 }}>
                {stage.driver.charAt(0).toUpperCase() + stage.driver.slice(1)}
              </p>
            ))}

            {/* Kaarten + connectors, rij 2 */}
            {FUNNEL.map((stage, i) => {
              const isActive = statusFilter.includes(stage.status)
              const r = i > 0 ? rate(cohortFor(FUNNEL[i - 1].status), cohortFor(stage.status)) : ""
              return (
                <Fragment key={stage.status}>
                  {i > 0 && (
                    <div className="relative px-1 self-center" style={{ gridRow: 2, minWidth: 32 }}>
                      <div className="w-full border-t border-[#d4d4d3]" />
                      <span className="absolute text-[10px] font-medium text-[#6b6b68]" style={{ top: -16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>{r}</span>
                    </div>
                  )}
                  <div style={{ gridRow: 2 }} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => toggleStatus(stage.status)}
                      className={`rounded-[3px] border bg-white px-3 py-3 transition-colors hover:border-[#c4c4c2] ${isActive ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
                      style={{ width: CARD_WIDTH }}
                    >
                      <div className="flex items-center gap-[6px] mb-1.5">
                        <span className="status-pill-dot shrink-0" style={{ background: STATUS_DOT[stage.status] }} />
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 400, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{STATUS_LABEL[stage.status]}</span>
                      </div>
                      <p className="arco-card-title text-left">{countAt(stage.status)}</p>
                    </button>
                  </div>
                </Fragment>
              )
            })}

            {/* Geparkeerde eindstanden, rij 3: Unlisted onder Listed, Deactivated onder Added */}
            {([
              { status: "unlisted" as BrandStatus, col: 5 },
              { status: "deactivated" as BrandStatus, col: 1 },
            ]).map((sub) => {
              const active = statusFilter.includes(sub.status)
              return (
                <div key={sub.status} style={{ gridRow: 3, gridColumn: sub.col, display: "flex", flexDirection: "column" }}>
                  <div style={{ height: 6 }} />
                  <button
                    type="button"
                    onClick={() => toggleStatus(sub.status)}
                    className={`rounded-[3px] border bg-white px-3 py-1.5 transition-colors hover:border-[#c4c4c2] flex items-center gap-[6px] ${active ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
                    style={{ width: CARD_WIDTH }}
                  >
                    <span className="status-pill-dot shrink-0" style={{ background: STATUS_DOT[sub.status] }} />
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 400, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{STATUS_LABEL[sub.status]}</span>
                    <span className="text-xs ml-auto" style={{ color: "var(--text-primary)" }}>{countAt(sub.status)}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Tabel ──────────────────────────────────────────────────── */}
        <div className="discover-results-meta" style={{ marginBottom: 16 }}>
          <p className="discover-results-count">
            <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{rows.length}</strong> {rows.length === 1 ? "brand" : "brands"}
            {rows.length !== initialBrands.length && <span className="arco-table-secondary" style={{ marginLeft: 6, marginTop: 0 }}>of {initialBrands.length}</span>}
          </p>
        </div>

        <div className="arco-table-wrap">
          <table className="arco-table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Domain</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Series</th>
                <th style={{ textAlign: "right" }}>Projects</th>
                <th>Owner</th>
                <th>Last change</th>
                <th>Added</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                    {initialBrands.length === 0 ? "No brands yet — add one from a brand's homepage." : "No brands match these filters."}
                  </td>
                </tr>
              ) : rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {b.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <div className="arco-table-avatar"><img src={b.logo_url} alt={b.name} /></div>
                      ) : (
                        <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>{b.name.charAt(0).toUpperCase()}</div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <Link href={`/admin/brands/${b.id}`} className="arco-table-primary arco-table-primary--wrap hover:text-[#016D75] transition-colors">{b.name}</Link>
                        {b.country && <div className="arco-table-secondary">{b.country}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    {b.website && b.domain ? (
                      <a href={b.website} target="_blank" rel="noopener noreferrer" className="arco-table-primary hover:opacity-70 transition-opacity" style={{ fontWeight: 400 }}>{b.domain}</a>
                    ) : (b.domain ?? dash)}
                  </td>
                  <td>
                    <button type="button" onClick={() => openStatus(b)} className="arco-table-status" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }} title="Update status">
                      <span className="arco-table-status-dot" style={{ background: STATUS_DOT[b.status as BrandStatus] ?? "#a1a1a0" }} />
                      <span style={{ fontWeight: 500 }}>{STATUS_LABEL[b.status as BrandStatus] ?? b.status}</span>
                    </button>
                  </td>
                  <td style={{ textAlign: "right" }}>{b.series_count || dash}</td>
                  <td style={{ textAlign: "right" }}>
                    {b.project_count ? (
                      <>
                        <span>{b.project_count}</span>
                        {b.pinned_count > 0 && <div className="arco-table-secondary" style={{ color: "#016D75" }}>{b.pinned_count} with photo</div>}
                      </>
                    ) : dash}
                  </td>
                  <td>{b.owner_name ?? dash}</td>
                  <td className="arco-table-nowrap">{b.updated_at ? format(new Date(b.updated_at), "dd MMM yyyy") : dash}</td>
                  <td className="arco-table-nowrap">{format(new Date(b.created_at), "dd MMM yyyy")}</td>
                  <td style={{ textAlign: "center" }}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="arco-table-action" style={{ display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem asChild><Link href={`/admin/brands/${b.id}`}>Edit brand</Link></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openStatus(b)}>Update status</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteTarget(b)} className="text-red-600">Delete brand</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add brand ───────────────────────────────────────────────── */}
      {showAdd && (
        <div className="popup-overlay" onClick={closeAdd}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">
                {addPhase === "input" ? "Add brand" : addPhase === "processing" ? "Reading the site…" : addPhase === "done" ? "Brand added" : "That did not work"}
              </h3>
              {!isScraping && (
                <button type="button" className="popup-close" onClick={closeAdd} aria-label="Close">✕</button>
              )}
            </div>

            {addPhase === "input" && (
              <>
                <p className="arco-body-text" style={{ marginBottom: 16 }}>
                  Paste the brand&rsquo;s products or collections overview — or its homepage. The brand comes from the homepage; the series from the page you paste, and their photos from each series&rsquo; own page.
                </p>
                <input
                  type="url"
                  autoFocus
                  placeholder="https://www.occhio.com/products"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleScrape() }}
                  className="input-base input-default"
                  style={{ width: "100%", marginBottom: 20 }}
                />
                <div className="popup-actions">
                  <button type="button" className="btn-tertiary" style={{ flex: 1 }} onClick={closeAdd}>Cancel</button>
                  <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => void handleScrape()} disabled={!scrapeUrl.trim()}>
                    Add brand
                  </button>
                </div>
              </>
            )}

            {addPhase !== "input" && (
              <>
                <div className="scrape-url-pill" style={{ marginBottom: 20 }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6.5 9.5l3-3" /><path d="M9 10.5l1.5-1.5a2.83 2.83 0 0 0-4-4L5 6.5" /><path d="M7 5.5L5.5 7a2.83 2.83 0 0 0 4 4L11 9.5" />
                  </svg>
                  <span className="scrape-url-text">{scrapeUrl.replace(/^https?:\/\//i, "")}</span>
                </div>

                <div className="scrape-steps">
                  {ADD_STEPS.map((label, i) => {
                    const status = addSteps[i]
                    const note = i === 2 && status === "active"
                      ? `${photoProgress.done} / ${photoProgress.total}${photoProgress.current ? ` · ${photoProgress.current}` : ""}`
                      : addNotes[i]
                    return (
                      <div key={label} className="scrape-step">
                        <StepIcon status={status} />
                        <span className={`scrape-step-label scrape-step-label--${status}`}>
                          {label}
                          {note && <span style={{ color: "#a1a1a0", fontWeight: 300 }}> — {note}</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {isScraping && (
                  <div className="scrape-progress-track" style={{ marginTop: 20 }}>
                    {/* Echte voortgang: stap 1 en 2 elk een derde, stap 3
                        de teller over de seriepagina's. */}
                    <div
                      className="scrape-progress-bar"
                      style={{
                        width: `${Math.max(3, Math.round(
                          addSteps[2] === "active"
                            ? 66 + (photoProgress.total ? (photoProgress.done / photoProgress.total) * 34 : 0)
                            : addSteps[1] === "active" ? 40 : addSteps[0] === "done" ? 33 : 8,
                        ))}%`,
                        transition: "width .4s ease",
                      }}
                    />
                  </div>
                )}

                {addPhase === "error" && addError && (
                  <div className="arco-alert arco-alert--danger" style={{ marginTop: 20 }}>
                    <AlertTriangle className="arco-alert-icon" />
                    <span>{addError}</span>
                  </div>
                )}

                {addPhase === "done" && (
                  <div className="popup-actions" style={{ marginTop: 20 }}>
                    <button type="button" className="btn-tertiary" style={{ flex: 1 }} onClick={closeAdd}>Close</button>
                    {addBrand && (
                      <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => router.push(`/admin/brands/${addBrand.id}`)}>
                        Open {addBrand.name}
                      </button>
                    )}
                  </div>
                )}

                {addPhase === "error" && (
                  <div className="popup-actions" style={{ marginTop: 20 }}>
                    <button type="button" className="btn-tertiary" style={{ flex: 1 }} onClick={() => setAddPhase("input")}>Try again</button>
                    {addBrand && (
                      <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => router.push(`/admin/brands/${addBrand.id}`)}>
                        Open {addBrand.name}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Update status ───────────────────────────────────────────── */}
      {statusBrand && (
        <div className="popup-overlay" onClick={() => setStatusBrand(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{statusBrand.name}</h3>
              <button type="button" className="popup-close" onClick={() => setStatusBrand(null)} aria-label="Close">✕</button>
            </div>
            <div className="status-modal-options">
              {ALL_STATUSES.map((s) => (
                <button key={s} type="button" className={`status-modal-option${statusValue === s ? " selected" : ""}`} onClick={() => setStatusValue(s)}>
                  <span className="status-modal-dot" style={{ background: STATUS_DOT[s] }} />
                  <div className="status-modal-option-text">
                    <span className="status-modal-option-label">{STATUS_LABEL[s]}</span>
                    <span className="arco-table-secondary" style={{ display: "block", marginTop: 2 }}>{STATUS_DESC[s]}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="popup-actions" style={{ marginTop: 20 }}>
              <button type="button" className="btn-tertiary" style={{ flex: 1 }} onClick={() => setStatusBrand(null)}>Cancel</button>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={saveStatus} disabled={isPending || statusValue === statusBrand.status}>
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete ──────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="popup-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete {deleteTarget.name}?</h3>
              <button type="button" className="popup-close" onClick={() => setDeleteTarget(null)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 20 }}>
              Removes the brand, its {deleteTarget.series_count} series and its tags on {deleteTarget.project_count} project{deleteTarget.project_count === 1 ? "" : "s"}. This cannot be undone.
            </p>
            <div className="popup-actions">
              <button type="button" className="btn-tertiary" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1, background: "var(--destructive)" }} onClick={confirmDelete} disabled={isPending}>
                {isPending ? "Deleting…" : "Delete brand"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="scrape-step-icon scrape-step-icon--done">
        <Check size={10} color="white" strokeWidth={2.5} />
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="scrape-step-icon scrape-step-icon--error">
        <X size={10} color="white" strokeWidth={2.5} />
      </span>
    )
  }
  if (status === "active") return <span className="scrape-step-icon scrape-step-icon--active" />
  return <span className="scrape-step-icon scrape-step-icon--pending" />
}
