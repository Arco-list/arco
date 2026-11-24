"use client"

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, Check, ExternalLink, MoreHorizontal, X } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

import { AdminTabs } from "@/components/admin/admin-tabs"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { addBrandFromSite, deleteBrand, importBrandsFromApollo, updateBrandSegment, discoverBrandCollections, fetchCollectionFromBrandPage, updateBrandDomain, updateBrandStatus, uploadBrandLogo } from "./actions"
import type { AdminBrandCategory, AdminBrandRow } from "./page"
import { startCollectionInventory } from "./collection-actions"
import { CollectionPicker } from "./collection-picker"
import { LogoPicker } from "./logo-picker"
import { findMissingLogos } from "./logo-actions"
import { ALL_STATUSES, STATUS_DESC, STATUS_DOT, STATUS_LABEL, type BrandStatus } from "./status"
import { BrandLogo } from "@/components/brand/brand-logo"
import { normalizeDomain } from "@/lib/products/domain"

/**
 * Merken in admin — dezelfde werkbank als Companies: sticky balk met
 * zoeken, statusfilter en de primaire actie; statusfunnel als
 * klikbare kaarten; de tabel eronder.
 *
 * De funnel is korter dan die van bedrijven: Added → Showcased →
 * Listed, met Unlisted en Deactivated geparkeerd. Labels, kleuren
 * en uitleg staan in ./status, gedeeld met de merkpagina.
 */


type StepStatus = "pending" | "active" | "done" | "error"
type AddPhase = "input" | "processing" | "done" | "error"
const ADD_STEPS = ["Brand from the homepage", "Collections on the page", "Photos from each collection page"] as const

/** Het domein in de tabel: klik om te wijzigen, Enter of weggaan slaat op, Escape breekt af — zoals bij bedrijven. Het pijltje opent de website. */
function BrandDomainCell({ domain, website, onSave }: { domain: string | null; website: string | null; onSave: (value: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(normalizeDomain(domain))
  const [saving, setSaving] = useState(false)
  const current = normalizeDomain(domain)

  const commit = async () => {
    const next = normalizeDomain(value)
    if (next === current) { setEditing(false); setValue(current); return }
    setSaving(true)
    const ok = await onSave(value)
    setSaving(false)
    // Bij een fout blijft het veld open, zodat je het kunt verbeteren.
    if (ok) setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="arco-table-primary border-b border-[#016D75] bg-transparent outline-none w-[140px]"
        style={{ fontWeight: 400, opacity: saving ? 0.5 : 1 }}
        value={value}
        disabled={saving}
        placeholder="tribu.com"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") { setValue(current); setEditing(false) }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        className="arco-table-primary hover:opacity-70 transition-opacity cursor-pointer"
        style={{ fontWeight: 400 }}
        onClick={(e) => { e.stopPropagation(); setValue(current); setEditing(true) }}
        title="Click to edit domain"
      >
        {current || <span className="text-[#c4c4c2] italic">Add domain...</span>}
      </button>
      {website && current && (
        <a href={website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-[#a1a1a0] hover:text-[#1c1c1a] transition-colors" title="Open website" aria-label="Open website">
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

/** Segment van een merk (migratie 324). Luxury en premium zijn het
 *  werkterrein van Arco; mid maakt zichtbaar wat buiten de doelgroep valt. */
type Segment = "luxury" | "premium" | "mid"
const SEGMENTS: Array<{ value: Segment; label: string; hint: string; dot: string }> = [
  { value: "luxury", label: "Luxury", hint: "Absolute top (Minotti, B&B Italia, Gaggenau)", dot: "#1c1c1a" },
  { value: "premium", label: "Premium", hint: "High-quality design (Hay, Muuto, Flos)", dot: "#016D75" },
  { value: "mid", label: "Mid-market", hint: "Below our audience (Kave Home, Calligaris)", dot: "#c4c4c2" },
]
const SEGMENT_BY_VALUE = new Map(SEGMENTS.map((x) => [x.value, x]))
type SegmentFilter = Segment | "none"

/** Voortgang van de collectiepijplijn (migratie 325) in de Collection-kolom. */
const JOB_ACTIVE = (j: AdminBrandRow["collection_job"]) => Boolean(j && j.stage !== "done" && j.stage !== "error")
function jobLabel(j: NonNullable<AdminBrandRow["collection_job"]>): string {
  if (j.kind === "enrich") return j.total ? `Fetching ${j.done}/${j.total}` : "Fetching…"
  switch (j.stage) {
    case "queued": return "Queued…"
    case "picking_pages": return "Mapping site…"
    case "fetching_pages": return j.total ? `Reading pages ${j.done}/${j.total}` : "Reading pages…"
    case "reading_pages": return "Finding collections…"
    case "storing_images": return j.total ? `Saving images ${j.done}/${j.total}` : "Saving images…"
    default: return "Working…"
  }
}

/** Sorteerbare kolommen van de merkentabel. */
type SortKey = "collections" | "projects" | "updated" | "created"
const SORT_VALUE: Record<SortKey, (b: AdminBrandRow) => number> = {
  collections: (b) => b.collection_count ?? 0,
  projects: (b) => b.project_count ?? 0,
  updated: (b) => new Date(b.updated_at ?? b.created_at).getTime(),
  created: (b) => new Date(b.created_at).getTime(),
}

/** Landnamen uit Apollo lopen soms uiteen; voor het filter één naam. */
const COUNTRY_ALIAS: Record<string, string> = { "Czech Republic": "Czechia", "Macedonia (FYROM)": "North Macedonia" }
const countryOf = (b: { country: string | null }) => (b.country ? COUNTRY_ALIAS[b.country] ?? b.country : null)

export function BrandsClient({ initialBrands, categoryTree = [] }: { initialBrands: AdminBrandRow[]; categoryTree?: AdminBrandCategory[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Filters ──────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<BrandStatus[]>([])
  // Categoriefilter op id, gegroepeerd: groep › subgroep. Een groep omvat
  // alles eronder; een merk met een soort (Kookplaten) valt onder zijn
  // subgroep (Apparatuur) en groep (Keuken).
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter[]>([])
  const toggleSegment = (v: SegmentFilter) => setSegmentFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const [countryFilter, setCountryFilter] = useState<string[]>([])
  const toggleCountry = (c: string) => setCountryFilter((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  // Segment direct bijgewerkt in de tabel, zonder op de refresh te wachten.
  const [segmentOverrides, setSegmentOverrides] = useState<Record<string, Segment | null>>({})
  // Keuze-pop-up na een inventarisatie, en verversen zolang er iets loopt.
  const [pickerBrand, setPickerBrand] = useState<{ id: string; name: string } | null>(null)
  // Logo's van de website: per merk kiezen, of alle ontbrekende in één keer.
  const [logoBrand, setLogoBrand] = useState<{ id: string; name: string } | null>(null)
  const [logoBusy, setLogoBusy] = useState<{ found: number; done: number } | null>(null)
  const missingLogos = initialBrands.filter((b) => !b.logo_url && b.status !== "deactivated").length
  const findAllLogos = async () => {
    setLogoBusy({ found: 0, done: 0 })
    const skip: string[] = []
    let found = 0, done = 0
    try {
      for (let round = 0; round < 200; round++) {
        const res = await findMissingLogos(skip)
        if ("error" in res) { toast.error(res.error); break }
        found += res.found; done += res.processed
        skip.push(...res.failedIds)
        setLogoBusy({ found, done })
        if (res.processed === 0 || res.remaining === 0) break
      }
      toast.success(`Logos: ${found} found${skip.length ? `, ${skip.length} without a logo on their website` : ""}`)
    } catch (err) {
      toast.error(`Stopped after ${done} brands: ${String(err)}`)
    } finally {
      setLogoBusy(null)
      router.refresh()
    }
  }
  const anyJobActive = initialBrands.some((b) => JOB_ACTIVE(b.collection_job))
  useEffect(() => {
    if (!anyJobActive) return
    const t = setInterval(() => router.refresh(), 20_000)
    return () => clearInterval(t)
  }, [anyJobActive, router])
  const inventory = async (b: AdminBrandRow, pageUrl?: string | null) => {
    const res = await startCollectionInventory([b.id], pageUrl)
    if ("error" in res) { toast.error(res.error); return }
    if (res.started === 0) toast.message(`${b.name} is already being inventoried`)
    else toast.success(`Inventorying ${b.name} in the background — progress shows in the Collection column`)
    router.refresh()
  }
  const segmentOf = (b: AdminBrandRow): Segment | null => (b.id in segmentOverrides ? segmentOverrides[b.id] : b.market_segment)
  const countryOptions = useMemo(() => {
    const count = new Map<string, number>()
    for (const b of initialBrands) { const c = countryOf(b) ?? "—"; count.set(c, (count.get(c) ?? 0) + 1) }
    return Array.from(count.entries()).sort((a, b) => (a[0] === "—" ? 1 : b[0] === "—" ? -1 : b[1] - a[1] || a[0].localeCompare(b[0])))
  }, [initialBrands])
  const toggleCategory = (id: string) => setCategoryFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const categoryById = useMemo(() => new Map(categoryTree.map((c) => [c.id, c])), [categoryTree])
  const subtreeOf = useMemo(() => {
    const kids = new Map<string, string[]>()
    for (const c of categoryTree) if (c.parentId) kids.set(c.parentId, [...(kids.get(c.parentId) ?? []), c.id])
    const out = new Map<string, Set<string>>()
    const walk = (id: string, acc: Set<string>) => { acc.add(id); for (const k of kids.get(id) ?? []) walk(k, acc) }
    for (const c of categoryTree) { const acc = new Set<string>(); walk(c.id, acc); out.set(c.id, acc) }
    return out
  }, [categoryTree])
  const brandInCategory = (b: AdminBrandRow, id: string) => { const sub = subtreeOf.get(id); return Boolean(sub && b.category_ids.some((c) => sub.has(c))) }
  const categoryGroups = useMemo(() => {
    const byOrder = (a: AdminBrandCategory, b: AdminBrandCategory) => a.orderIndex - b.orderIndex
    const count = (id: string) => initialBrands.filter((b) => brandInCategory(b, id)).length
    return categoryTree.filter((c) => !c.parentId).sort(byOrder)
      .map((g) => ({
        group: g,
        count: count(g.id),
        children: categoryTree.filter((c) => c.parentId === g.id).sort(byOrder).map((c) => ({ cat: c, count: count(c.id) })).filter((c) => c.count > 0),
      }))
      .filter((g) => g.count > 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryTree, initialBrands, subtreeOf])

  const toggleStatus = (s: BrandStatus) =>
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  // Alles behalve status — de funnelkaarten zíjn het statusfilter, dus
  // ze tellen over de cohort die zoeken en tagging overlaten.
  const funnelData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return initialBrands.filter((b) => {
      if (categoryFilter.length > 0 && !categoryFilter.some((id) => brandInCategory(b, id))) return false
      if (segmentFilter.length > 0 && !segmentFilter.includes(segmentOf(b) ?? "none")) return false
      if (countryFilter.length > 0 && !countryFilter.includes(countryOf(b) ?? "—")) return false
      if (!q) return true
      return [b.name, b.domain ?? "", b.category ?? "", b.city ?? "", b.country ?? "", b.owner_name ?? ""].join(" ").toLowerCase().includes(q)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBrands, searchTerm, categoryFilter, subtreeOf, segmentFilter, countryFilter, segmentOverrides])

  // Sorteren op de kolommen met een getal of datum; standaard de laatst
  // gewijzigde bovenaan. Een merk zonder wijziging telt met zijn
  // aanmaakdatum.
  const [sortKey, setSortKey] = useState<SortKey>("updated")
  const [sortAsc, setSortAsc] = useState(false)
  const onSort = (key: SortKey) => {
    if (key === sortKey) { setSortAsc((v) => !v); return }
    setSortKey(key)
    setSortAsc(false)
  }
  const rows = useMemo(() => {
    const list = statusFilter.length === 0 ? funnelData : funnelData.filter((b) => statusFilter.includes(b.status as BrandStatus))
    const value = SORT_VALUE[sortKey]
    return [...list].sort((a, b) => {
      const d = value(a) - value(b)
      return (sortAsc ? d : -d) || a.name.localeCompare(b.name)
    })
  }, [funnelData, statusFilter, sortKey, sortAsc])

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
  const [apolloBusy, setApolloBusy] = useState(false)
  // Voortgang van de import: verwerkte accounts van het totaal op de lijst.
  const [apolloProgress, setApolloProgress] = useState<{ done: number; total: number } | null>(null)
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
    const added = await addBrandFromSite(url)
    if ("error" in added) { setStep(0, "error"); setAddError(added.error); setAddPhase("error"); return }
    const brand = { brandId: added.brandId, name: added.name }
    setAddBrand({ id: added.brandId, name: added.name })
    setStep(0, "done", added.created ? `${added.name} — added from the homepage` : `${added.name} — already in the list`)

    // 2. De collecties van de geplakte pagina.
    setStep(1, "active")
    const collection = await discoverBrandCollections(brand.brandId, url)
    if ("error" in collection) { setStep(1, "error"); setAddError(collection.error); setAddPhase("error"); return }
    setStep(1, "done", `${collection.collectionsFound} found · ${collection.collectionsAdded} new`)

    // 3. Elke collectiepagina: foto's, designer, jaar, omschrijving — drie
    //    tegelijk, elk een eigen call, zodat de teller echt loopt.
    const queue = collection.pending
    if (queue.length === 0) {
      setStep(2, "done", "Nothing left to read")
    } else {
      setStep(2, "active")
      setPhotoProgress({ done: 0, total: queue.length, current: queue[0].name })
      let next = 0, done = 0, photos = 0, products = 0, failed = 0
      let firstError: string | null = null
      const worker = async () => {
        while (next < queue.length) {
          const item = queue[next++]
          setPhotoProgress((p) => ({ ...p, current: item.name }))
          const r = await fetchCollectionFromBrandPage(item.id)
          if ("error" in r) { failed++; firstError ??= r.error }
          else { photos += r.photos; products += r.products }
          done++
          setPhotoProgress((p) => ({ ...p, done }))
        }
      }
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker))
      // Mislukt het met alle collecties, dan is het een storing (tegoed,
      // sleutel) en geen pagina: laat de reden zien in plaats van een telling.
      if (failed > 0 && failed === done) {
        setStep(2, "error", `${failed} of ${done} could not be read`)
        setAddError(firstError ?? "The collection pages could not be read.")
        setAddPhase("error")
        router.refresh()
        return
      }
      setStep(2, "done", `${photos} photos and ${products} products from ${done - failed} collection${done - failed === 1 ? "" : "s"}${failed > 0 ? ` · ${failed} could not be read${firstError ? ` (${firstError})` : ""}` : ""}`)
    }

    setAddPhase("done")
    router.refresh()
  }

  // ── Status / delete dialogs ──────────────────────────────────────────
  // Logo uploaden vanuit de tabel: het icoon van een merk is de knop. Het
  // nieuwe adres krijgt een versie mee, want een logo met dezelfde
  // bestandsnaam komt anders uit de browsercache.
  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const logoTargetRef = useRef<AdminBrandRow | null>(null)
  const [logoOverrides, setLogoOverrides] = useState<Record<string, string>>({})
  const [logoUploadingId, setLogoUploadingId] = useState<string | null>(null)
  // Het domein dat net is opgeslagen, tot de pagina vers binnen is.
  const [domainOverrides, setDomainOverrides] = useState<Record<string, { domain: string | null; website: string | null }>>({})
  const pickLogo = (b: AdminBrandRow) => {
    logoTargetRef.current = b
    logoInputRef.current?.click()
  }
  const onLogoChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const brand = logoTargetRef.current
    e.target.value = ""
    if (!file || !brand) return
    setLogoUploadingId(brand.id)
    const fd = new FormData()
    fd.append("file", file)
    const res = await uploadBrandLogo(brand.id, fd)
    setLogoUploadingId(null)
    if ("error" in res) { toast.error(res.error); return }
    setLogoOverrides((prev) => ({ ...prev, [brand.id]: `${res.url}?v=${Date.now()}` }))
    toast.success(`Logo van ${brand.name} bijgewerkt`)
  }
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

  // Status direct zetten vanuit het rijmenu, zoals "Update status" bij
  // bedrijven: een submenu met de statussen als stip plus woord, de
  // huidige vet. Het dialoogvenster blijft bestaan voor de uitleg.
  const applyStatus = (b: AdminBrandRow, status: BrandStatus) => {
    startTransition(async () => {
      const result = await updateBrandStatus(b.id, status)
      if ("error" in result) { toast.error(result.error); return }
      toast.success(`${b.name} → ${STATUS_LABEL[status]}`)
      router.refresh()
    })
  }
  // Eén menu voor de "…"-knop en de klik in de rij, zodat de twee nooit
  // uit elkaar lopen.
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const renderBrandMenuItems = (b: AdminBrandRow) => (
    <>
      <DropdownMenuItem asChild>
        <a href={`/brands/${b.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">View brand</a>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href={`/admin/brands/${b.id}`} className="text-xs cursor-pointer">Edit brand</Link>
      </DropdownMenuItem>
      <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setLogoBrand({ id: b.id, name: b.name })}>
        Find logo
      </DropdownMenuItem>
      <DropdownMenuItem className="text-xs cursor-pointer" disabled={JOB_ACTIVE(b.collection_job)} onClick={() => void inventory(b)}>
        Inventory collections
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-xs cursor-pointer"
        disabled={JOB_ACTIVE(b.collection_job)}
        onClick={() => {
          const url = window.prompt(`Page that lists the collections of ${b.name}:`, b.website ?? "")
          if (url) void inventory(b, url)
        }}
      >
        Inventory from a page…
      </DropdownMenuItem>
      {b.candidates_found > 0 && (
        <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setPickerBrand({ id: b.id, name: b.name })}>
          Choose collections ({b.candidates_found})
        </DropdownMenuItem>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="text-xs">Update status</DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-[160px]">
          {ALL_STATUSES.map((st) => {
            const isCurrent = b.status === st
            return (
              <DropdownMenuItem
                key={st}
                disabled={isPending}
                className={`text-xs cursor-pointer flex items-center gap-1.5${isCurrent ? " font-semibold bg-[#f5f5f4]" : ""}`}
                onClick={() => { if (!isCurrent) applyStatus(b, st) }}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: STATUS_DOT[st] }} />
                {STATUS_LABEL[st]}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-xs cursor-pointer text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(b)}>
        Delete
      </DropdownMenuItem>
    </>
  )

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

            {/* Categoriefilter — meerkeuze over de productcategorieën van het merk. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`w-[160px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${categoryFilter.length > 0 ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"}`}
                >
                  <span className={`truncate ${categoryFilter.length === 0 ? "text-[#6b6b68]" : ""}`}>
                    {categoryFilter.length === 0 ? "All categories" : categoryFilter.length === 1 ? categoryById.get(categoryFilter[0])?.name ?? "1 category" : `${categoryFilter.length} categories`}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[240px] max-h-[420px] overflow-y-auto z-[120]">
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); if (categoryFilter.length > 0) setCategoryFilter([]) }} className="text-xs">
                  Clear selection
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {categoryGroups.map(({ group, count, children }, gi) => (
                  <Fragment key={group.id}>
                    {gi > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuCheckboxItem checked={categoryFilter.includes(group.id)} onCheckedChange={() => toggleCategory(group.id)} onSelect={(e) => e.preventDefault()} className="text-xs font-medium">
                      <span className="flex-1">{group.name}</span>
                      <span className="ml-3 tabular-nums text-[#a1a1a0] font-normal">{count}</span>
                    </DropdownMenuCheckboxItem>
                    {children.map(({ cat, count: n }) => (
                      <DropdownMenuCheckboxItem key={cat.id} checked={categoryFilter.includes(cat.id)} onCheckedChange={() => toggleCategory(cat.id)} onSelect={(e) => e.preventDefault()} className="text-xs pl-12 text-[#6b6b68]">
                        <span className="flex-1">{cat.name}</span>
                        <span className="ml-3 tabular-nums text-[#a1a1a0]">{n}</span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Segment — luxury, premium, mid, of nog niet beoordeeld. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`w-[140px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${segmentFilter.length > 0 ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"}`}
                >
                  <span className={`truncate ${segmentFilter.length === 0 ? "text-[#6b6b68]" : ""}`}>
                    {segmentFilter.length === 0 ? "All segments" : segmentFilter.length === 1 ? (segmentFilter[0] === "none" ? "No segment" : SEGMENT_BY_VALUE.get(segmentFilter[0])?.label) : `${segmentFilter.length} segments`}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px] z-[120]">
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); if (segmentFilter.length > 0) setSegmentFilter([]) }} className="text-xs">
                  Clear selection
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {[...SEGMENTS.map((x) => ({ value: x.value as SegmentFilter, label: x.label, dot: x.dot })), { value: "none" as SegmentFilter, label: "No segment", dot: "transparent" }].map((x) => (
                  <DropdownMenuCheckboxItem key={x.value} checked={segmentFilter.includes(x.value)} onCheckedChange={() => toggleSegment(x.value)} onSelect={(e) => e.preventDefault()} className="text-xs">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0 mr-2" style={{ background: x.dot, border: x.value === "none" ? "1px solid #c4c4c2" : undefined }} />
                    <span className="flex-1">{x.label}</span>
                    <span className="ml-3 tabular-nums text-[#a1a1a0]">{initialBrands.filter((b) => (segmentOf(b) ?? "none") === x.value).length}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Land — van het merk (Apollo), meest voorkomend eerst. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`w-[140px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${countryFilter.length > 0 ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"}`}
                >
                  <span className={`truncate ${countryFilter.length === 0 ? "text-[#6b6b68]" : ""}`}>
                    {countryFilter.length === 0 ? "All countries" : countryFilter.length === 1 ? (countryFilter[0] === "—" ? "No country" : countryFilter[0]) : `${countryFilter.length} countries`}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[220px] max-h-[420px] overflow-y-auto z-[120]">
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); if (countryFilter.length > 0) setCountryFilter([]) }} className="text-xs">
                  Clear selection
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {countryOptions.map(([c, n]) => (
                  <DropdownMenuCheckboxItem key={c} checked={countryFilter.includes(c)} onCheckedChange={() => toggleCountry(c)} onSelect={(e) => e.preventDefault()} className="text-xs">
                    <span className="flex-1">{c === "—" ? "No country" : c}</span>
                    <span className="ml-3 tabular-nums text-[#a1a1a0]">{n}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>


            {missingLogos > 0 && (
              <button
                type="button"
                className="btn-tertiary shrink-0"
                style={{ height: 36, fontSize: 13, padding: "0 16px" }}
                disabled={logoBusy != null}
                title="Look up the logo on the website of every brand without one, and use the best candidate"
                onClick={() => void findAllLogos()}
              >
                {logoBusy ? `Finding logos… ${logoBusy.found}/${logoBusy.done}` : `Find ${missingLogos} missing logos`}
              </button>
            )}

            <button
              type="button"
              className="btn-tertiary shrink-0"
              style={{ height: 36, fontSize: 13, padding: "0 16px" }}
              disabled={apolloBusy}
              title="Read the Apollo company list “Brands” and add new brands; empty fields of existing brands are filled in"
              onClick={async () => {
                // Blok voor blok (25 accounts per aanroep), zodat ook een
                // lijst van duizenden merken binnen de tijdslimiet blijft.
                setApolloBusy(true)
                setApolloProgress(null)
                const sum = { created: 0, updated: 0, unchanged: 0, categorised: 0, skipped: 0 }
                let page: number | null = 1
                let done = 0
                try {
                  while (page != null) {
                    const res = await importBrandsFromApollo("Brands", page)
                    if ("error" in res) {
                      toast.error(done > 0 ? `${res.error} (stopped after ${done} accounts; run again to continue)` : res.error)
                      break
                    }
                    sum.created += res.created; sum.updated += res.updated; sum.unchanged += res.unchanged
                    sum.categorised += res.categorised; sum.skipped += res.skipped
                    done += res.found
                    setApolloProgress({ done, total: res.total })
                    page = res.nextPage
                  }
                  if (page == null) {
                    toast.success(`Apollo: ${sum.created} added, ${sum.updated} updated, ${sum.unchanged} unchanged, ${sum.categorised} categorised${sum.skipped ? `, ${sum.skipped} skipped` : ""}`)
                  }
                } catch (err) {
                  toast.error(`Import stopped after ${done} accounts: ${String(err)}. Run again to continue.`)
                } finally {
                  setApolloBusy(false)
                  setApolloProgress(null)
                  router.refresh()
                }
              }}
            >
              {apolloBusy ? (apolloProgress ? `Importing… ${apolloProgress.done}/${apolloProgress.total}` : "Importing…") : "Import from Apollo"}
            </button>

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

        <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onLogoChosen} style={{ display: "none" }} />
        <div className="arco-table-wrap">
          <table className="arco-table" style={{ minWidth: 1080 }}>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Domain</th>
                <th>Status</th>
                <th>Segment</th>
                {([
                  ["collections", "Collection", "right"],
                  ["projects", "Projects", "right"],
                  null,
                  ["updated", "Last change", "left"],
                  ["created", "Added", "left"],
                ] as Array<[SortKey, string, "left" | "right"] | null>).map((c) => {
                  if (!c) return <th key="owner">Owner</th>
                  const [key, label, align] = c
                  const active = sortKey === key
                  return (
                    <th key={key} style={{ textAlign: align }} aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"}>
                      <button
                        type="button"
                        onClick={() => onSort(key)}
                        className="inline-flex items-center gap-1 hover:text-[#1c1c1a] transition-colors"
                        style={{ color: active ? "var(--arco-black)" : undefined, background: "none", border: 0, padding: 0, font: "inherit", cursor: "pointer" }}
                      >
                        {label}
                        <span aria-hidden className="text-[8px]" style={{ opacity: active ? 1 : 0 }}>{sortAsc ? "▲" : "▼"}</span>
                      </button>
                    </th>
                  )
                })}
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                    {initialBrands.length === 0 ? "No brands yet — add one from a brand's homepage." : "No brands match these filters."}
                  </td>
                </tr>
              ) : rows.map((b) => (
                <tr
                  key={b.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [role='menuitem']")) return
                    setRowMenu({ id: b.id, x: e.clientX, y: e.clientY })
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => pickLogo(b)}
                        disabled={logoUploadingId === b.id}
                        title="Upload logo"
                        aria-label={`Upload logo voor ${b.name}`}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: "50%", opacity: logoUploadingId === b.id ? 0.4 : 1, flexShrink: 0 }}
                        className="hover:opacity-70 transition-opacity"
                      >
                        <BrandLogo logoUrl={logoOverrides[b.id] ?? b.logo_url} name={b.name} size={32} />
                      </button>
                      <div style={{ minWidth: 0 }}>
                        <Link href={`/admin/brands/${b.id}`} className="arco-table-primary arco-table-primary--wrap hover:text-[#016D75] transition-colors">{b.name}</Link>
                        {(b.category || b.country) && <div className="arco-table-secondary">{[b.category, countryOf(b)].filter(Boolean).join(" · ")}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <BrandDomainCell
                      domain={domainOverrides[b.id]?.domain ?? b.domain}
                      website={domainOverrides[b.id]?.website ?? b.website}
                      onSave={async (value) => {
                        const res = await updateBrandDomain(b.id, value)
                        if ("error" in res) { toast.error(res.error); return false }
                        setDomainOverrides((prev) => ({ ...prev, [b.id]: res }))
                        toast.success("Domain updated")
                        router.refresh()
                        return true
                      }}
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => openStatus(b)} className="arco-table-status" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }} title="Update status">
                      <span className="arco-table-status-dot" style={{ background: STATUS_DOT[b.status as BrandStatus] ?? "#a1a1a0" }} />
                      <span style={{ fontWeight: 500 }}>{STATUS_LABEL[b.status as BrandStatus] ?? b.status}</span>
                    </button>
                  </td>
                  <td>
                    {(() => {
                      const seg = segmentOf(b)
                      const meta = seg ? SEGMENT_BY_VALUE.get(seg) : null
                      const save = async (next: Segment | null) => {
                        const prev = seg
                        setSegmentOverrides((o) => ({ ...o, [b.id]: next }))
                        const res = await updateBrandSegment(b.id, next)
                        if ("error" in res) { setSegmentOverrides((o) => ({ ...o, [b.id]: prev })); toast.error(res.error) }
                      }
                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="arco-table-status" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }} title="Set segment">
                              {meta ? (
                                <>
                                  <span className="arco-table-status-dot" style={{ background: meta.dot }} />
                                  <span style={{ fontWeight: 500 }}>{meta.label}</span>
                                </>
                              ) : (
                                <>
                                  <span className="arco-table-status-dot" style={{ background: "transparent", boxShadow: "inset 0 0 0 1px #c4c4c2" }} />
                                  <span style={{ fontWeight: 500, color: "#a1a1a0" }}>No segment</span>
                                </>
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[260px] z-[120]">
                            {SEGMENTS.map((x) => (
                              <DropdownMenuCheckboxItem key={x.value} checked={seg === x.value} onCheckedChange={() => void save(x.value)} className="text-xs">
                                <span className="h-1.5 w-1.5 rounded-full shrink-0 mr-2" style={{ background: x.dot }} />
                                <span className="flex-1">
                                  <span style={{ fontWeight: 500 }}>{x.label}</span>
                                  <span className="block text-[#a1a1a0]">{x.hint}</span>
                                </span>
                              </DropdownMenuCheckboxItem>
                            ))}
                            {seg && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => void save(null)} className="text-xs text-[#6b6b68]">Clear segment</DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )
                    })()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {(() => {
                      // Eén rij: aantal collecties (of de voortgang van de
                      // pijplijn) · Add X zolang er gevonden collecties wachten.
                      const j = b.collection_job
                      const active = Boolean(j && JOB_ACTIVE(j))
                      const status = active
                        ? <span style={{ color: "#016D75" }}>{jobLabel(j!)}</span>
                        : j?.stage === "error"
                          ? <span style={{ color: "#c0392b" }} title={j.error ?? undefined}>{j.kind === "inventory" ? "Inventory failed" : "Fetch failed"}</span>
                          : <span>{b.collection_count || dash}</span>
                      // Tijdens het inventariseren is de lijst nog niet af.
                      const canAdd = b.candidates_found > 0 && !(active && j!.kind === "inventory")
                      return (
                        <div className="inline-flex items-center justify-end gap-1.5" style={{ whiteSpace: "nowrap" }}>
                          {status}
                          {canAdd && (
                            <>
                              <span className="text-[#a1a1a0]">·</span>
                              <button type="button" className="hover:underline" style={{ color: "#016D75", background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" }} onClick={() => setPickerBrand({ id: b.id, name: b.name })}>
                                Add {b.candidates_found}
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </td>
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
                      <DropdownMenuContent align="end" className="w-48">
                        {renderBrandMenuItems(b)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rijmenu op de klikpositie, zoals bij bedrijven: een onzichtbaar
          vast punt waar het menu aan hangt, zodat het oog niet naar de
          "…"-kolom hoeft. Zelfde items als de knop. */}
      {(() => {
        const brand = rowMenu ? initialBrands.find((x) => x.id === rowMenu.id) ?? null : null
        return (
          <DropdownMenu open={Boolean(rowMenu && brand)} onOpenChange={(open) => { if (!open) setRowMenu(null) }}>
            <DropdownMenuTrigger asChild>
              <span aria-hidden style={{ position: "fixed", left: rowMenu?.x ?? 0, top: rowMenu?.y ?? 0, width: 0, height: 0, padding: 0, margin: 0 }} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {brand && renderBrandMenuItems(brand)}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })()}

      {/* ── Logo van de website ──────────────────────────────────────── */}
      {logoBrand && (
        <LogoPicker
          brand={logoBrand}
          onClose={() => setLogoBrand(null)}
          onSaved={(url) => { setLogoOverrides((prev) => ({ ...prev, [logoBrand.id]: url })); setLogoBrand(null); router.refresh() }}
        />
      )}

      {/* ── Collecties kiezen na een inventarisatie ─────────────────── */}
      {pickerBrand && (
        <CollectionPicker
          brand={pickerBrand}
          onClose={() => setPickerBrand(null)}
          onDone={() => { setPickerBrand(null); router.refresh() }}
        />
      )}

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
                  Paste the brand&rsquo;s products or collections overview — or its homepage. The brand comes from the homepage; the collections from the page you paste, and their photos from each collection&rsquo;s own page.
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
                        de teller over de collectiepagina's. */}
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
              Removes the brand, its {deleteTarget.collection_count} collection and its tags on {deleteTarget.project_count} project{deleteTarget.project_count === 1 ? "" : "s"}. This cannot be undone.
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
