"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, HelpCircle, Link2, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Link } from "@/i18n/navigation"

import {
  addDetection, inventoryRecognizedBrand, linkSameProduct, listBrandCollections, reviewDetection, searchCatalog, searchCuratedBrands, unlinkSameProduct,
  type BrandCollection, type BrandHit, type CatalogHit, type DetectionCandidate, type HideReason, type PhotoDetection, type ReviewAction,
} from "./detection-actions"

/**
 * Beoordelen van herkende producten (migratie 334), alleen admins.
 *
 * Alleen de foto, met de stippen zoals op een gewone projectfoto. De
 * gekozen stip toont de productkaart (zoals de kaart van een merkstip) met
 * drie knoppen: verwijderen, klopt niet, klopt. Onderin pijlen die door de
 * stippen lopen en daarna door naar de volgende foto (ook ← en →). Een
 * product toevoegen: een kader trekken op de foto.
 *
 * Hetzelfde product op andere foto's (lib/recognition/grouping) krijgt
 * hetzelfde oordeel, zolang die stippen nog open staan.
 */

type Photo = { id: string; url: string; width?: number | null; height?: number | null }
type Size = { w: number; h: number }
type Box = { x0: number; y0: number; x1: number; y1: number }

// ── Toestand per product: één kleur en label, ook voor de stippen op de tegels ──
export type DetectionState = "approved" | "review" | "open" | "missing" | "rejected" | "hidden" | "unknown" | "matching"

export function detectionState(d: PhotoDetection): DetectionState {
  if (d.reviewStatus === "approved") return "approved"
  if (d.reviewStatus === "missing") return "missing"
  if (d.reviewStatus === "rejected") return "rejected"
  if (d.reviewStatus === "hidden") return "hidden"
  if (d.reviewStatus === "unknown") return "unknown"
  if (d.matchStatus === null || d.matchStatus === "submitted") return "matching"
  return d.suggestion ? "review" : "open"
}

/** Waarom verwijderen (alleen admins, migraties 348, 360); de cijfers zijn de sneltoetsen. */
export const HIDE_REASON_OPTIONS: Array<{ key: HideReason; label: string; hint: string }> = [
  { key: "not_prominent", label: "Niet prominent", hint: "Te klein, te ver weg of half in beeld" },
  { key: "bespoke", label: "Maatwerk", hint: "Keuken, kast, werkblad, gevel, raam" },
  { key: "duplicate", label: "Dubbel", hint: "Staat al als andere stip op deze foto" },
  { key: "not_high_end", label: "Geen high-end merk", hint: "Wel een product, maar geen merk voor Arco" },
  { key: "other", label: "Anders", hint: "Een andere reden" },
]
/** Ook de redenen die niet meer te kiezen zijn, voor wat al zo verwijderd is. */
const HIDE_REASON_LABEL: Record<HideReason, string> = {
  not_prominent: "Niet prominent", bespoke: "Maatwerk", duplicate: "Dubbel", not_high_end: "Geen high-end merk",
  other: "Anders", not_carried: "Voeren we niet", wrong_box: "Verkeerd kader",
}

export const STATE_STYLE: Record<DetectionState, { color: string; label: string }> = {
  approved: { color: "#2e7d4f", label: "Goedgekeurd" },
  review: { color: "#d98a1c", label: "Te beoordelen" },
  open: { color: "#8a8a86", label: "Geen voorstel" },
  missing: { color: "#3b6fb6", label: "Niet in catalogus" },
  rejected: { color: "#b4b4b0", label: "Geen product" },
  hidden: { color: "#d4d4d0", label: "Verborgen" },
  unknown: { color: "#7d5ba6", label: "Onbekend product" },
  matching: { color: "#b4b4b0", label: "Koppelen…" },
}

const isOpenState = (s: DetectionState) => s === "review" || s === "open"
const shownCandidate = (d: PhotoDetection) =>
  d.candidates.find((c) => c.status === "approved") ?? (d.reviewStatus ? null : d.candidates.find((c) => c.status === "suggested")) ?? null
const titleOf = (c: DetectionCandidate) =>
  (c.level === "product" ? c.productName : null) ?? (c.level !== "brand" ? c.collectionName : null) ?? c.brandName

const INK = "#1a1a19", MUTED = "#6b6b68", LINE = "#e6e6e3", SOFT = "#f5f5f4"
const CARD_W = 240

type Stop = { photoId: string; detectionId: string | null }
type CardAction = "approve" | "remove" | "unknown"

export function DetectionReview({ photos, detections, initial, onClose, onChanged, onRedetect, viewerIsAdmin = true }: {
  photos: Photo[]
  detections: PhotoDetection[]
  initial: { photoId: string; detectionId?: string | null }
  onClose: () => void
  /** Na elke wijziging: de detecties opnieuw laden. */
  onChanged: () => Promise<void> | void
  /** Alle foto's opnieuw laten herkennen (beoordeelde producten blijven staan). */
  onRedetect?: () => void
  /** Admin: volledige versie, met "Bekijk als eigenaar" om de eigenarenversie te zien. */
  viewerIsAdmin?: boolean
}) {
  // Eigenarenversie: zonder admin-gereedschap (opnieuw herkennen, merk in de
  // selectie zetten) en met een kortere uitleg. Admins kunnen hem bekijken.
  const [asOwner, setAsOwner] = useState(false)
  const admin = viewerIsAdmin && !asOwner
  const [cursor, setCursor] = useState<Stop>({ photoId: initial.photoId, detectionId: initial.detectionId ?? null })
  const [busy, setBusy] = useState(false)
  const [natural, setNatural] = useState<Map<string, Size>>(new Map())

  // Per foto de zichtbare stippen (verborgen niet), op rang.
  // Standaard alleen de stippen die nog open staan (en de gekozen stip, ook als
  // die al beoordeeld is); "Alles tonen" laat ook de beoordeelde zien.
  const [showAll, setShowAll] = useState(false)
  const byPhoto = useMemo(() => {
    const m = new Map<string, PhotoDetection[]>()
    for (const d of detections) {
      // Verborgen stippen alleen bij "Ook beoordeelde tonen" (om terug te zetten).
      if (d.reviewStatus === "hidden" && !showAll && d.id !== cursor.detectionId) continue
      if (!showAll && !isOpenState(detectionState(d)) && d.id !== cursor.detectionId) continue
      m.set(d.photoId, [...(m.get(d.photoId) ?? []), d])
    }
    for (const list of m.values()) list.sort((a, b) => a.rank - b.rank)
    return m
  }, [detections, showAll, cursor.detectionId])
  // De route van de pijlen: elke (open) stip; foto's zonder stippen alleen bij
  // "Alles tonen", of als er niets meer open staat.
  const stops = useMemo<Stop[]>(() => {
    const dots = photos.flatMap((p): Stop[] => (byPhoto.get(p.id) ?? []).map((d) => ({ photoId: p.id, detectionId: d.id })))
    if (!showAll && dots.length) return dots
    return photos.flatMap((p): Stop[] => {
      const ds = byPhoto.get(p.id) ?? []
      return ds.length ? ds.map((d) => ({ photoId: p.id, detectionId: d.id })) : [{ photoId: p.id, detectionId: null }]
    })
  }, [photos, byPhoto, showAll])
  const stopIndex = useMemo(() => {
    const exact = stops.findIndex((s) => s.photoId === cursor.photoId && s.detectionId === cursor.detectionId)
    return exact >= 0 ? exact : Math.max(0, stops.findIndex((s) => s.photoId === cursor.photoId))
  }, [stops, cursor])
  const stop = stops[stopIndex]
  const photo = photos.find((p) => p.id === stop?.photoId) ?? photos[0]
  const photoDetections = byPhoto.get(photo?.id ?? "") ?? []
  const selected = stop?.detectionId ? detections.find((d) => d.id === stop.detectionId) ?? null : null
  const photoNumber = photos.findIndex((p) => p.id === photo?.id) + 1
  // Tellen per product (een groep stippen over de foto's heen); verwijderde
  // stippen tellen niet mee. De volgorde is die van de eerste stip op de foto's.
  const productOrder = useMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()
    for (const p of photos) {
      const own = detections.filter((d) => d.photoId === p.id && d.reviewStatus !== "hidden").sort((a, b) => a.rank - b.rank)
      for (const d of own) if (!seen.has(d.groupId)) { seen.add(d.groupId); order.push(d.groupId) }
    }
    return order
  }, [photos, detections])
  const totalProducts = productOrder.length
  const openProducts = new Set(detections.filter((d) => d.reviewStatus !== "hidden" && isOpenState(detectionState(d))).map((d) => d.groupId)).size
  const reviewedProducts = totalProducts - openProducts
  const reviewedPct = totalProducts ? Math.round((reviewedProducts / totalProducts) * 100) : 100
  const siblingsOf = useCallback((d: PhotoDetection) => detections.filter((x) => x.groupId === d.groupId && x.id !== d.id && x.reviewStatus !== "hidden"), [detections])

  const go = useCallback((delta: number) => {
    if (stops.length === 0) return
    setCursor(stops[(stopIndex + delta + stops.length) % stops.length])
  }, [stops, stopIndex])

  // Natuurlijke maat van de foto.
  useEffect(() => {
    if (!photo || natural.has(photo.id)) return
    if (photo.width && photo.height) { setNatural((m) => new Map(m).set(photo.id, { w: photo.width!, h: photo.height! })); return }
    const img = new window.Image()
    img.onload = () => setNatural((m) => new Map(m).set(photo.id, { w: img.naturalWidth, h: img.naturalHeight }))
    img.src = photo.url
  }, [photo, natural])
  const size = photo ? natural.get(photo.id) ?? null : null

  // Pagina niet laten scrollen zolang het paneel open is.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  /** Na een oordeel door naar de volgende open stip (net mee beoordeelde stippen overslaan). */
  const nextOpenAfter = useCallback((id: string, skip: Set<string>): Stop | null => {
    const i = stops.findIndex((s) => s.detectionId === id)
    const after = [...stops.slice(i + 1), ...stops.slice(0, Math.max(i, 0))]
    return after.find((s) => {
      if (!s.detectionId || skip.has(s.detectionId)) return false
      const d = detections.find((x) => x.id === s.detectionId)
      return d ? isOpenState(detectionState(d)) : false
    }) ?? null
  }, [stops, detections])

  /** Welke knop net is ingedrukt: die staat even aan voordat het doorgaat naar de volgende. */
  const [flash, setFlash] = useState<{ id: string; key: CardAction } | null>(null)

  /** De volgende stop na deze: liefst een open stip; anders gewoon de volgende stip of foto. */
  const nextAfter = useCallback((d: PhotoDetection, skip: Set<string>): Stop => {
    const open = nextOpenAfter(d.id, skip)
    if (open) return open
    const i = stops.findIndex((s) => s.detectionId === d.id)
    const after = [...stops.slice(i + 1), ...stops.slice(0, Math.max(i, 0))]
    const other = after.find((s) => !s.detectionId || !skip.has(s.detectionId))
    if (other) return other
    // Dit was de laatste open stip: door naar de volgende foto.
    const pi = photos.findIndex((p) => p.id === d.photoId)
    const nextPhoto = photos[(pi + 1) % photos.length] ?? photos[pi]
    return { photoId: nextPhoto.id, detectionId: null }
  }, [nextOpenAfter, stops, photos])

  const run = useCallback(async (d: PhotoDetection, action: ReviewAction, key?: CardAction) => {
    const toGroup = action.type === "approve" || action.type === "pick" || action.type === "reject" || action.type === "missing" || action.type === "hide" || action.type === "unknown"
    const also = toGroup ? siblingsOf(d).filter((x) => !x.reviewStatus).map((x) => x.id) : []
    const advance = action.type !== "reset" && action.type !== "level" && action.type !== "move" && action.type !== "box"
    const next = advance ? nextAfter(d, new Set([d.id, ...also])) : null
    // De knop staat meteen aan; na een korte tel door naar de volgende, ook
    // als het opslaan nog loopt (dat gaat op de achtergrond door).
    if (key) setFlash({ id: d.id, key })
    setBusy(true)
    const request = reviewDetection(d.id, action, also)
    if (key) await new Promise((r) => setTimeout(r, 380))
    if (next) setCursor(next)
    setFlash(null)
    setBusy(false)
    const res = await request
    if ("error" in res) toast.error(res.error)
    else if (res.liveEmailSent) toast.success("Alles beoordeeld — de mail \"je project staat live\" is verstuurd")
    void onChanged()
  }, [siblingsOf, nextAfter, onChanged])

  /** "Zelfde als…": deze stip is hetzelfde product als een stip op een andere foto. */
  const linkSame = useCallback(async (d: PhotoDetection, target: PhotoDetection) => {
    setBusy(true)
    const res = await linkSameProduct(d.id, target.id)
    if ("error" in res) toast.error(res.error)
    await onChanged()
    setBusy(false)
  }, [onChanged])
  const unlinkSame = useCallback(async (x: PhotoDetection) => {
    setBusy(true)
    const res = await unlinkSameProduct(x.id)
    if ("error" in res) toast.error(res.error)
    await onChanged()
    setBusy(false)
  }, [onChanged])

  const add = useCallback(async (box: Box) => {
    if (!photo) return
    setBusy(true)
    const res = await addDetection(photo.id, box)
    if ("error" in res) { setBusy(false); toast.error(res.error); return }
    await onChanged()
    setBusy(false)
    setCursor({ photoId: photo.id, detectionId: res.id })
  }, [photo, onChanged])

  /** De knoppen: verwijderen, wisselen, onbekend, klopt. Nog eens op een actieve knop: terug naar te beoordelen. */
  const approve = useCallback((d: PhotoDetection) => {
    if (d.reviewStatus === "approved" || d.reviewStatus === "missing") return void run(d, { type: "reset" })
    const c = shownCandidate(d)
    if (c) return void run(d, { type: "approve", matchId: c.matchId }, "approve")
    // Herkend maar niet in de catalogus: klopt = wacht op dit merk/product.
    const rec = d.recognized
    if (rec?.brand || rec?.product) void run(d, { type: "missing", brand: rec.brand ?? "", name: rec.product ?? "" }, "approve")
  }, [run])

  // Onbekend: wel een product, maar niet te zeggen welk (vervangt "klopt
  // niet": fout voorstel → wisselen, geen product → verwijderen).
  const unknown = useCallback((d: PhotoDetection) => {
    if (d.reviewStatus === "unknown") void run(d, { type: "reset" })
    else void run(d, { type: "unknown" }, "unknown")
  }, [run])
  // Waarom verwijderen (alleen admins, migratie 348): de prullenbak opent
  // eerst de redenen in de kaart; een reden kiezen (of overslaan) verwijdert.
  const [askReason, setAskReason] = useState<string | null>(null)
  useEffect(() => { setAskReason(null) }, [cursor.detectionId])
  const remove = useCallback((d: PhotoDetection, reason?: HideReason | null) => {
    // Verborgen (ook automatisch): nog eens op de prullenbak zet hem terug.
    if (d.reviewStatus === "hidden") return void run(d, { type: "reset" })
    if (d.source === "manual") return void run(d, { type: "delete" }, "remove")
    if (admin && reason === undefined) { setAskReason((cur) => (cur === d.id ? null : d.id)); return }
    setAskReason(null)
    void run(d, { type: "hide", reason: reason ?? null }, "remove")
  }, [run, admin])

  // Toetsenbord: ← → door de stippen, Enter/A klopt, U/? onbekend, Delete verwijderen, Esc sluiten.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest("input, textarea, select, [contenteditable=true]")) {
        if (e.key === "Escape") t.blur()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // Redenen open: 1–6 kiest, 0 of Enter zonder reden, Esc sluit alleen de redenen.
      if (askReason && selected?.id === askReason) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setAskReason(null); return }
        const i = Number(e.key)
        if (e.key >= "1" && e.key <= String(HIDE_REASON_OPTIONS.length)) { e.preventDefault(); remove(selected, HIDE_REASON_OPTIONS[i - 1].key); return }
        if (e.key === "0" || e.key === "Enter") { e.preventDefault(); remove(selected, null); return }
      }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return }
      if (busy) return
      switch (e.key) {
        case "ArrowRight": e.preventDefault(); go(1); break
        case "ArrowLeft": e.preventDefault(); go(-1); break
        case "Enter": case "a": if (selected) { e.preventDefault(); approve(selected) } break
        case "u": case "?": if (selected) unknown(selected); break
        case "Delete": case "Backspace": if (selected) { e.preventDefault(); remove(selected) } break
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [busy, selected, go, approve, unknown, remove, onClose, askReason])

  if (!photo || typeof document === "undefined") return null

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Producten beoordelen"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#151514", display: "flex", flexDirection: "column", color: "#e8e8e6" }}>
      {/* Boven: waar je bent · hoeveel er beoordeeld is · gereedschap en sluiten */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 14, padding: "12px 18px", fontSize: 13 }}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>Foto {photoNumber} van {photos.length}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {reviewedProducts} van de {totalProducts} beoordeeld <span style={{ color: "#9b9b97" }}>({reviewedPct}%)</span>
          </span>
          <button type="button" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)} style={pill(showAll)}>
            Beoordeelde tonen
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          {viewerIsAdmin && (
            <button type="button" aria-pressed={asOwner} onClick={() => setAsOwner((v) => !v)} style={pill(asOwner)}>
              Bekijk als eigenaar
            </button>
          )}
          {admin && onRedetect && (
            <button type="button" style={pill(false)}
              onClick={() => { if (window.confirm("Alle foto's opnieuw laten herkennen? Beoordeelde en zelf toegevoegde producten blijven staan; de rest wordt vervangen.")) onRedetect() }}>
              Opnieuw herkennen
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Sluiten" style={{ ...plainBtn, fontSize: 24, lineHeight: 1, padding: 4, marginLeft: 6 }}>×</button>
        </div>
      </div>

      <Stage
        key={photo.id}
        photo={photo} size={size} detections={photoDetections} selected={selected} busy={busy}
        siblings={selected ? siblingsOf(selected) : []} photos={photos} admin={admin} all={detections}
        onLinkSame={(d, target) => void linkSame(d, target)} onUnlinkSame={(x) => void unlinkSame(x)}
        onMove={(d, at) => void run(d, { type: "move", x: at.x, y: at.y })}
        onResize={(d, b) => void run(d, { type: "box", ...b })}
        flash={flash && flash.id === selected?.id ? flash.key : null}
        onSelect={(d) => setCursor({ photoId: d.photoId, detectionId: d.id })}
        onDeselect={() => setCursor({ photoId: photo.id, detectionId: null })}
        onDraw={(box) => void add(box)}
        onApprove={approve} onUnknown={unknown} onRemove={remove}
        askReason={askReason} onCancelReason={() => setAskReason(null)}
        onLink={(d, action) => void run(d, action, action.type === "unknown" ? "unknown" : action.type === "reset" ? undefined : "approve")}
      />

      {/* Onder: door de stippen, daarna door naar de volgende foto */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "12px 18px 16px", fontSize: 13 }}>
        <button type="button" onClick={() => go(-1)} aria-label="Vorige" style={roundBtn}><ChevronLeft size={20} /></button>
        <span style={{ minWidth: 150, textAlign: "center", color: "#9b9b97", fontVariantNumeric: "tabular-nums" }}>
          {/* Over het hele project, net als de telling bovenin. */}
          {selected
            ? selected.reviewStatus === "hidden"
              ? "Verwijderd"
              : `Product ${productOrder.indexOf(selected.groupId) + 1} van ${totalProducts}`
            : photoDetections.length ? `${photoDetections.length} ${photoDetections.length === 1 ? "product" : "producten"} op deze foto` : "Geen producten op deze foto"}
        </span>
        <button type="button" onClick={() => go(1)} aria-label="Volgende" style={roundBtn}><ChevronRight size={20} /></button>
      </div>
    </div>,
    document.body,
  )
}

// ── De foto, de stippen, het kader dat je trekt en de productkaart ──
function Stage({ photo, size, detections, selected, busy, siblings, photos, admin, all, onLinkSame, onUnlinkSame, onMove, onResize, flash, onSelect, onDeselect, onDraw, onApprove, onUnknown, onRemove, onLink, askReason, onCancelReason }: {
  /** De gekozen stip naar een andere plek gesleept. */
  onMove: (d: PhotoDetection, at: { x: number; y: number }) => void
  /** Het kader van de gekozen stip aangepast (met de grepen). */
  onResize: (d: PhotoDetection, box: Box) => void
  photo: Photo
  size: Size | null
  detections: PhotoDetection[]
  selected: PhotoDetection | null
  busy: boolean
  siblings: PhotoDetection[]
  photos: Photo[]
  admin: boolean
  /** Alle stippen van het project, voor "Zelfde als…". */
  all: PhotoDetection[]
  onLinkSame: (d: PhotoDetection, target: PhotoDetection) => void
  onUnlinkSame: (x: PhotoDetection) => void
  flash: CardAction | null
  onSelect: (d: PhotoDetection) => void
  onDeselect: () => void
  onDraw: (box: Box) => void
  onApprove: (d: PhotoDetection) => void
  onUnknown: (d: PhotoDetection) => void
  onRemove: (d: PhotoDetection, reason?: HideReason | null) => void
  /** De stip waarvoor de redenen van verwijderen open staan. */
  askReason: string | null
  onCancelReason: () => void
  onLink: (d: PhotoDetection, action: ReviewAction) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState<Size | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [draft, setDraft] = useState<Box | null>(null)
  const drawing = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  // De stip verslepen: de plek tijdens het slepen, en na het loslaten
  // (tot de detecties opnieuw geladen zijn).
  const [dragDot, setDragDot] = useState<{ id: string; x: number; y: number; moved: boolean } | null>(null)
  const [placed, setPlaced] = useState<Record<string, { x: number; y: number }>>({})
  // Het kader aanpassen met de grepen: het kader tijdens het slepen, en na het
  // loslaten (tot de detecties opnieuw geladen zijn).
  const [dragBox, setDragBox] = useState<{ id: string; box: Box; handle: string; moved: boolean } | null>(null)
  const [framed, setFramed] = useState<Record<string, Box>>({})
  const selectedBox = selected ? (dragBox?.id === selected.id ? dragBox.box : framed[selected.id] ?? selected.box) : null

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setRoom({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fit = size && room ? Math.min((room.w - 32) / size.w, (room.h - 16) / size.h) : null
  // De plek van de foto op het scherm, voor de kaart (position: fixed).
  useLayoutEffect(() => {
    if (stageRef.current) setRect(stageRef.current.getBoundingClientRect())
  }, [fit, room, selected?.id])

  const posIn = (e: { clientX: number; clientY: number }) => {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }

  return (
    <div ref={boxRef} style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {fit && size && (
        <div ref={stageRef}
          style={{ position: "relative", width: size.w * fit, height: size.h * fit, cursor: "crosshair", touchAction: "none", userSelect: "none" }}
          onPointerDown={(e) => {
            if (busy || e.button !== 0) return
            const p = posIn(e)
            drawing.current = { ...p, moved: false }
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const g = drawing.current
            if (!g) return
            const p = posIn(e)
            if (!g.moved && Math.hypot(p.x - g.x, p.y - g.y) < 0.01) return
            g.moved = true
            setDraft({ x0: Math.min(g.x, p.x), y0: Math.min(g.y, p.y), x1: Math.max(g.x, p.x), y1: Math.max(g.y, p.y) })
          }}
          onPointerUp={() => {
            const g = drawing.current
            drawing.current = null
            const box = draft
            setDraft(null)
            if (!g) return
            if (!g.moved) { onDeselect(); return }
            if (box && box.x1 - box.x0 > 0.02 && box.y1 - box.y0 > 0.02) onDraw(box)
          }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />

          {/* Het kader dat je trekt, of dat van de gekozen stip — met grepen op
              de hoeken en zijden om het aan te passen. */}
          {(draft ?? selectedBox) && (() => {
            const b = (draft ?? selectedBox)!
            const HANDLES: Array<{ h: string; x: number; y: number; cursor: string }> = [
              { h: "nw", x: 0, y: 0, cursor: "nwse-resize" }, { h: "n", x: 0.5, y: 0, cursor: "ns-resize" }, { h: "ne", x: 1, y: 0, cursor: "nesw-resize" },
              { h: "e", x: 1, y: 0.5, cursor: "ew-resize" }, { h: "se", x: 1, y: 1, cursor: "nwse-resize" }, { h: "s", x: 0.5, y: 1, cursor: "ns-resize" },
              { h: "sw", x: 0, y: 1, cursor: "nesw-resize" }, { h: "w", x: 0, y: 0.5, cursor: "ew-resize" },
            ]
            const MIN = 0.02
            return (
              <div style={{
                position: "absolute", pointerEvents: "none", borderRadius: 2,
                border: draft ? "2px dashed #fff" : "1.5px solid rgba(255,255,255,0.85)",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
                left: `${b.x0 * 100}%`, top: `${b.y0 * 100}%`, width: `${(b.x1 - b.x0) * 100}%`, height: `${(b.y1 - b.y0) * 100}%`,
              }}>
                {!draft && selected && HANDLES.map(({ h, x, y, cursor }) => (
                  <span key={h} role="presentation" title="Sleep om het kader aan te passen"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      if (busy || e.button !== 0) return
                      e.currentTarget.setPointerCapture(e.pointerId)
                      setDragBox({ id: selected.id, box: b, handle: h, moved: false })
                    }}
                    onPointerMove={(e) => {
                      if (!dragBox || dragBox.handle !== h) return
                      const p = posIn(e)
                      const nb = { ...dragBox.box }
                      if (h.includes("w")) nb.x0 = Math.min(p.x, nb.x1 - MIN)
                      if (h.includes("e")) nb.x1 = Math.max(p.x, nb.x0 + MIN)
                      if (h.includes("n")) nb.y0 = Math.min(p.y, nb.y1 - MIN)
                      if (h.includes("s")) nb.y1 = Math.max(p.y, nb.y0 + MIN)
                      setDragBox({ ...dragBox, box: nb, moved: true })
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation()
                      if (!dragBox || dragBox.handle !== h) return
                      const drop = dragBox
                      setDragBox(null)
                      if (drop.moved) {
                        setFramed((m) => ({ ...m, [drop.id]: drop.box }))
                        setPlaced((m) => { const { [drop.id]: _, ...rest } = m; return rest })
                        onResize(selected, drop.box)
                      }
                    }}
                    style={{
                      position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, width: 10, height: 10, transform: "translate(-50%, -50%)",
                      background: "#fff", border: "1px solid rgba(0,0,0,0.45)", borderRadius: 2, cursor, pointerEvents: "auto", touchAction: "none",
                    }} />
                ))}
              </div>
            )
          })()}

          {detections.map((d) => {
            const state = detectionState(d)
            const isSelected = selected?.id === d.id
            // De gekozen stip is te verslepen naar een betere plek op het product.
            // Kader net aangepast (of nog aan het slepen): de stip in het midden ervan.
            const reframed = isSelected && (dragBox?.id === d.id || framed[d.id]) ? selectedBox : null
            const pos = dragDot?.id === d.id ? dragDot
              : reframed ? { x: (reframed.x0 + reframed.x1) / 2, y: (reframed.y0 + reframed.y1) / 2 }
              : placed[d.id] ?? { x: d.x, y: d.y }
            return (
              <button key={d.id} type="button" className="photo-dot"
                aria-label={`${d.rank}. ${d.kindName ?? d.label}, ${STATE_STYLE[state].label}${isSelected ? " · sleep om te verplaatsen" : ""}`}
                aria-expanded={isSelected}
                title={isSelected ? "Sleep om de stip te verplaatsen" : undefined}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  if (!isSelected || busy || e.button !== 0) return
                  e.currentTarget.setPointerCapture(e.pointerId)
                  setDragDot({ id: d.id, x: pos.x, y: pos.y, moved: false })
                }}
                onPointerMove={(e) => {
                  if (dragDot?.id !== d.id) return
                  const p = posIn(e)
                  const moved = dragDot.moved || Math.hypot(p.x - d.x, p.y - d.y) > 0.01
                  setDragDot({ id: d.id, x: p.x, y: p.y, moved })
                }}
                onPointerUp={(e) => {
                  e.stopPropagation()
                  if (dragDot?.id !== d.id) return
                  const drop = dragDot
                  setDragDot(null)
                  if (drop.moved) {
                    setPlaced((m) => ({ ...m, [d.id]: { x: drop.x, y: drop.y } }))
                    onMove(d, { x: drop.x, y: drop.y })
                  }
                }}
                onClick={(e) => { e.stopPropagation(); if (!isSelected) onSelect(d) }}
                style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, background: STATE_STYLE[state].color, opacity: state === "rejected" ? 0.7 : 1, cursor: isSelected ? (dragDot?.id === d.id ? "grabbing" : "grab") : "pointer", touchAction: "none" }} />
            )
          })}
        </div>
      )}
      {selected && rect && typeof document !== "undefined" && createPortal(
        // Het kaartje beweegt mee met het kader terwijl je het aanpast.
        <ReviewCard key={selected.id} d={selectedBox && selectedBox !== selected.box ? { ...selected, box: selectedBox } : selected} photo={photo} size={size} rect={rect} busy={busy} siblings={siblings} photos={photos} admin={admin} flash={flash} onSelect={onSelect}
          all={all} onLinkSame={(target) => onLinkSame(selected, target)} onUnlinkSame={onUnlinkSame}
          onApprove={() => onApprove(selected)} onUnknown={() => onUnknown(selected)} onRemove={(reason) => onRemove(selected, reason)} onLink={(action) => onLink(selected, action)}
          askingReason={askReason === selected.id} onCancelReason={onCancelReason} />,
        document.body,
      )}
    </div>
  )
}

// ── De productkaart bij de stip: zoals op een gewone foto, met drie knoppen ──
function ReviewCard({ d, photo, size, rect, busy, siblings, photos, admin, all, onLinkSame, onUnlinkSame, flash, onSelect, onApprove, onUnknown, onRemove, onLink, askingReason, onCancelReason }: {
  /** De redenen van verwijderen staan open (alleen admins). */
  askingReason: boolean
  onCancelReason: () => void
  d: PhotoDetection
  photo: Photo
  size: Size | null
  rect: DOMRect
  busy: boolean
  siblings: PhotoDetection[]
  photos: Photo[]
  admin: boolean
  all: PhotoDetection[]
  /** Deze stip is hetzelfde product als `target`. */
  onLinkSame: (target: PhotoDetection) => void
  onUnlinkSame: (x: PhotoDetection) => void
  /** Net ingedrukt: die knop staat aan tot het doorgaat naar de volgende. */
  flash: CardAction | null
  onSelect: (d: PhotoDetection) => void
  onApprove: () => void
  onUnknown: () => void
  /** Zonder argument: (bij een admin) eerst de redenen; met een reden (of null): verwijderen. */
  onRemove: (reason?: HideReason | null) => void
  /** Zelf koppelen: een collectie of merk kiezen, of "staat er niet in". */
  onLink: (action: ReviewAction) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState(260)
  const [hover, setHover] = useState<string | null>(null)
  const state = detectionState(d)
  const shown = shownCandidate(d)
  // Herkend maar (nog) niet in de catalogus: wat Claude herkent, of wat
  // bevestigd is ("staat er niet tussen").
  const rec = !shown && (d.recognized?.brand || d.recognized?.product) ? d.recognized : null
  const title = shown ? titleOf(shown)
    : rec ? rec.product ?? rec.brand ?? ""
    : d.kindName ?? d.label
  const subtitle = shown
    // Goedgekeurd of niet zegt de vink al; hier alleen het merk.
    ? (shown.brandName !== title ? shown.brandName : shown.level === "brand" ? "Merk" : "")
    : rec ? (rec.product ? rec.brand ?? "" : d.kindName ?? "")
    : STATE_STYLE[state].label
  const logoUrl = shown?.brandLogoUrl ?? rec?.brandLogoUrl ?? null
  const openSiblings = siblings.filter((x) => !x.reviewStatus).length
  // Een oordeel geldt ook voor de open stippen van hetzelfde product.
  const groupLabel = openSiblings ? ` · ${openSiblings + 1} foto's` : ""
  // Hetzelfde beeld als de merkstip op de projectpagina: de hero van de
  // collectie (vult het vlak); anders het productbeeld (heel, op grijs).
  const hero = shown && shown.level !== "brand" ? shown.heroUrl : null
  const image = hero ?? shown?.imageUrl ?? null
  // De collectie (of het merk) op Arco, in een nieuw tabblad.
  const href = shown ? (shown.level !== "brand" && shown.collectionSlug ? `/brands/${shown.brandSlug}/${shown.collectionSlug}` : `/brands/${shown.brandSlug}`) : null
  // De echte hoogte van de kaart, voor de plaatsing.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setCardH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Niets voorgesteld en niets herkend: dan is er niets om goed of af te
  // keuren, alleen om te koppelen. Ook te openen bij een fout voorstel.
  const needsLink = !shown && !rec && (!d.reviewStatus || d.reviewStatus === "unknown")
  const [linking, setLinking] = useState(false)
  const showLinker = needsLink || linking
  /** Het gekozen merk in het koppelveld; de groene vink koppelt dan alleen het merk. */
  const [linkBrand, setLinkBrand] = useState<BrandHit | null>(null)

  // Hetzelfde product op een andere foto, zelf koppelen (migratie 345).
  const [pickingSame, setPickingSame] = useState(false)
  /** De uitsnede waar de muis op staat: groter onder de kaart, met naam en categorie. */
  const [preview, setPreview] = useState<PhotoDetection | null>(null)
  const photoIndex = (id: string) => photos.findIndex((p) => p.id === id)
  // Alle stippen die in aanmerking komen: andere foto, nog niet in de groep,
  // niet verborgen. Eerst de voorgestelde, dan dezelfde soort, dan op foto.
  const sameOptions = all
    .filter((x) => x.photoId !== d.photoId && x.groupId !== d.groupId && x.reviewStatus !== "hidden")
    .sort((a, b) => {
      const ma = d.maybeSame.indexOf(a.id), mb = d.maybeSame.indexOf(b.id)
      if (ma !== mb) return (ma < 0 ? 99 : ma) - (mb < 0 ? 99 : mb)
      const ka = Number(a.kindSlug !== d.kindSlug), kb = Number(b.kindSlug !== d.kindSlug)
      return ka - kb || photoIndex(a.photoId) - photoIndex(b.photoId) || a.rank - b.rank
    })
  const maybe = d.maybeSame.map((id) => sameOptions.find((x) => x.id === id)).filter((x): x is PhotoDetection => Boolean(x))

  // Plaats: buiten het kader van het product, zodat dat zichtbaar blijft —
  // erboven, eronder, rechts of links, wat het eerst past.
  const { left, top } = placeOutside({
    l: rect.left + d.box.x0 * rect.width, t: rect.top + d.box.y0 * rect.height,
    r: rect.left + d.box.x1 * rect.width, b: rect.top + d.box.y1 * rect.height,
  }, CARD_W, cardH)

  // color: tint en hover; dark: aan (gekozen, of net ingedrukt).
  const buttons: Array<{ key: CardAction | "link"; label: string; color: string; dark: string; active: boolean; disabled: boolean; onClick: () => void; icon: React.ReactNode }> = [
    {
      key: "remove",
      label: d.reviewStatus === "hidden"
        ? (d.matchNote?.startsWith("auto-hidden") ? "Automatisch verborgen · terugzetten"
          : `Verborgen${admin && d.hiddenReason ? ` (${HIDE_REASON_LABEL[d.hiddenReason as HideReason]?.toLowerCase() ?? d.hiddenReason})` : ""} · terugzetten`)
        : "Verwijderen",
      color: "#6b6b68", dark: "#3d3d3b", active: flash === "remove" || askingReason || (!flash && d.reviewStatus === "hidden"), disabled: busy,
      // Geen event doorgeven: zonder argument vraagt het (bij een admin) eerst de reden.
      onClick: () => onRemove(), icon: <Trash2 size={16} />,
    },
    { key: "link", label: "Ander product koppelen", color: "#2f6690", dark: "#1f4766", active: false, disabled: busy, onClick: () => setLinking(true), icon: <ArrowLeftRight size={16} /> },
    {
      key: "unknown", label: d.reviewStatus === "unknown" ? "Onbekend · nog eens: terug" : `Onbekend product${groupLabel}`, color: STATE_STYLE.unknown.color, dark: "#5a3f7d",
      active: flash === "unknown" || (!flash && d.reviewStatus === "unknown"), disabled: busy, onClick: onUnknown, icon: <HelpCircle size={17} />,
    },
    { key: "approve", label: d.reviewStatus === "approved" || d.reviewStatus === "missing" ? "Klopt · nog eens: terug" : shown || rec ? `Klopt${groupLabel}` : "Kies eerst een product", color: "#2e7d4f", dark: "#1b5432", active: flash === "approve" || (!flash && (d.reviewStatus === "approved" || d.reviewStatus === "missing")), disabled: busy || (!shown && !rec && d.reviewStatus !== "approved" && d.reviewStatus !== "missing"), onClick: onApprove, icon: <Check size={18} /> },
  ]
  const visibleButtons = showLinker
    ? [
        ...buttons.filter((b) => b.key === "remove"),
        {
          key: "unknown" as const, label: d.reviewStatus === "unknown" ? "Onbekend · nog eens: terug" : `Onbekend product${groupLabel}`, color: STATE_STYLE.unknown.color, dark: "#5a3f7d",
          active: flash === "unknown" || (!flash && d.reviewStatus === "unknown"), disabled: busy,
          onClick: onUnknown, icon: <HelpCircle size={17} />,
        },
        {
          key: "approve" as const,
          label: !linkBrand ? "Kies eerst een merk" : linkBrand.id ? `Alleen ${linkBrand.name} koppelen${groupLabel}` : `${linkBrand.name} voorstellen · wacht op de catalogus${groupLabel}`,
          color: "#2e7d4f", dark: "#1b5432",
          active: flash === "approve", disabled: busy || !linkBrand,
          // Een voorgesteld merk (nog niet bij ons): de stip wacht erop; het
          // merk toevoegen gebeurt aan de achterkant, de cron vindt het op naam.
          onClick: () => {
            if (!linkBrand) return
            onLink(linkBrand.id ? { type: "pick", target: { kind: "brand", id: linkBrand.id } } : { type: "missing", brand: linkBrand.name, name: "" })
          },
          icon: <Check size={18} />,
        },
      ]
    : buttons
  const hovered = visibleButtons.find((b) => b.key === hover) ?? null

  return (
    <div style={{ position: "fixed", left, top, width: CARD_W, zIndex: 1002 }} onPointerDown={(e) => e.stopPropagation()}>
      <div ref={ref} className="photo-dot-card" style={{ position: "relative", color: INK }}>
        <CardLink href={href}>
        <div style={{ position: "relative", width: "100%", height: 140, background: SOFT, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={image} alt="" style={{ width: "100%", height: "100%", display: "block", objectFit: hero ? "cover" : "contain", mixBlendMode: hero ? undefined : "multiply" }} />
            : <Crop src={photo.url} size={size} box={d.box} aspect={CARD_W / 140} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" style={{ width: 28, height: 28, minWidth: 28, borderRadius: "50%", objectFit: "contain", background: SOFT, mixBlendMode: "multiply" }} />
          ) : (
            <span style={{ width: 28, height: 28, minWidth: 28, borderRadius: "50%", background: SOFT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500 }}>
              {(shown?.brandName ?? rec?.brand ?? title).charAt(0).toUpperCase()}
            </span>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
            <div style={{ fontSize: 12, fontWeight: 300, color: MUTED, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>
          </div>
        </div>
        </CardLink>
        {/* Hetzelfde product op andere foto's: deze stip en de andere als
            kleine uitsneden. Bij hover over klopt / klopt niet krijgen de
            uitsneden waar het oordeel ook voor geldt een rand in die kleur. */}
        {/* Daarachter, met een stippellijn: misschien hetzelfde product (lijkt
            er redelijk op) — één klik koppelt. De laatste tegel ("…") opent
            alle stippen van het project om er zelf een te kiezen. */}
        {!pickingSame && (siblings.length > 0 || maybe.length > 0 || sameOptions.length > 0) && (
          // Even breed als de knoppen eronder: vier kolommen, dezelfde rand.
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, padding: "0 8px 10px" }}>
            {/* Vaste volgorde (zoals de foto's in het project), zodat een
                uitsnede op zijn plek blijft als je erheen springt. */}
            {siblings.length > 0 && [d, ...siblings].sort((a, b) => photoIndex(a.photoId) - photoIndex(b.photoId) || a.rank - b.rank).map((x) => {
              const covered = x.id === d.id || !x.reviewStatus
              const ring = hover === "approve" || hover === "unknown"
                ? (covered && !(hover === "approve" && !shown) ? buttons.find((b) => b.key === hover)!.color : null)
                : x.id === d.id ? INK : null
              return (
                <SameTile key={x.id} x={x} photos={photos} ring={ring} dot
                  label={x.id === d.id ? "Deze foto" : `Naar deze foto (${STATE_STYLE[detectionState(x)].label})`}
                  cursor={x.id === d.id ? "default" : "pointer"}
                  onClick={() => x.id !== d.id && onSelect(x)}
                  onHover={setPreview}
                  // Zelf gekoppeld: een kruisje om los te koppelen.
                  extra={x.linked && preview?.id === x.id && !busy ? (
                    <button type="button" onClick={() => onUnlinkSame(x)} aria-label="Los koppelen" title="Los koppelen: niet hetzelfde product"
                      style={{ position: "absolute", left: -4, bottom: -4, width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #fff", background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: "pointer" }}>
                      <X size={10} strokeWidth={3} />
                    </button>
                  ) : null}
                />
              )
            })}
            {/* Misschien hetzelfde: met een stippellijn; bij hover + over het beeld. */}
            {maybe.map((x) => (
              <SameTile key={x.id} x={x} photos={photos} dashed overlay="add" disabled={busy}
                label={`Koppelen: hetzelfde product als op foto ${photoIndex(x.photoId) + 1}`}
                onClick={() => onLinkSame(x)} onHover={setPreview} />
            ))}
            {sameOptions.length > 0 && (
              <button type="button" disabled={busy} onClick={() => setPickingSame(true)}
                aria-label="Zelfde product als…" title="Zelfde product als… (een stip op een andere foto)"
                style={{ aspectRatio: "1", width: "100%", padding: 0, border: `1px solid ${LINE}`, borderRadius: 4, background: "#fff", color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Link2 size={18} />
              </button>
            )}
          </div>
        )}
        {pickingSame && (
          <div style={{ padding: "0 8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 6px 4px" }}>
              <span style={{ fontSize: 12, color: MUTED }}>Zelfde product als…</span>
              <button type="button" onClick={() => setPickingSame(false)} aria-label="Annuleren" style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: MUTED, display: "flex" }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, maxHeight: 186, overflowY: "auto", paddingTop: 3, paddingRight: 3 }}>
              {sameOptions.map((x) => (
                <SameTile key={x.id} x={x} photos={photos} dot overlay="add" disabled={busy}
                  label={`Koppelen aan ${x.kindName ?? x.label} (foto ${photoIndex(x.photoId) + 1})`}
                  onClick={() => { setPickingSame(false); setPreview(null); onLinkSame(x) }} onHover={setPreview} />
              ))}
            </div>
          </div>
        )}
        {showLinker && (
          <LinkPicker d={d} busy={busy} admin={admin} brand={linkBrand} setBrand={setLinkBrand} onLink={onLink} onCancel={needsLink ? null : () => { setLinking(false); setLinkBrand(null) }} />
        )}
        {/* Waarom weg? (alleen admins): één klik verwijdert met die reden. Zo
            is te tellen wat de herkenning fout doet (migratie 348). */}
        {askingReason && (
          <div style={{ padding: "0 8px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 4px 6px" }}>
              <span style={{ fontSize: 12, color: MUTED }}>Waarom verwijderen?</span>
              <button type="button" onClick={onCancelReason} aria-label="Annuleren" style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: MUTED, display: "flex" }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {HIDE_REASON_OPTIONS.map((r, i) => (
                <button key={r.key} type="button" disabled={busy} onClick={() => onRemove(r.key)} title={`${r.hint} (${i + 1})`}
                  style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 34, padding: "6px 8px", borderRadius: 4, border: `1px solid ${LINE}`, background: "#fff", color: INK, fontSize: 12, lineHeight: 1.2, textAlign: "left", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = SOFT }} onMouseLeave={(e) => { e.currentTarget.style.background = "#fff" }}>
                  <span aria-hidden style={{ fontSize: 10, color: "#a1a1a0", fontVariantNumeric: "tabular-nums", width: 8 }}>{i + 1}</span>
                  {r.label}
                </button>
              ))}
            </div>
            <button type="button" disabled={busy} onClick={() => onRemove(null)}
              style={{ width: "100%", marginTop: 6, height: 30, border: "none", background: "none", color: MUTED, fontSize: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
              Verwijderen zonder reden
            </button>
          </div>
        )}
        {!askingReason && <div style={{ display: "flex", gap: 6, padding: "0 8px 8px" }}>
          {visibleButtons.map((b) => (
            <button key={b.key} type="button" aria-label={b.label} aria-pressed={b.active} onClick={b.onClick} disabled={b.disabled}
              onMouseEnter={() => setHover(b.key)} onMouseLeave={() => setHover((h) => (h === b.key ? null : h))}
              onFocus={() => setHover(b.key)} onBlur={() => setHover((h) => (h === b.key ? null : h))}
              style={{
                flex: 1, height: 38, borderRadius: 4, border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                background: b.active ? b.dark : b.disabled ? SOFT : hover === b.key ? b.color : `${b.color}1a`,
                color: b.active || (!b.disabled && hover === b.key) ? "#fff" : b.disabled ? "#c4c4c0" : b.color,
                cursor: b.disabled ? "default" : "pointer", transition: "background 0.12s, color 0.12s",
              }}>
              {b.icon}
            </button>
          ))}
        </div>}
      </div>
      {/* Uitsnede bij hover: groter, met naam en categorie, net onder de kaart. */}
      {preview && !hovered && (() => {
        const p = photos.find((ph) => ph.id === preview.photoId)
        const c = shownCandidate(preview)
        const name = c ? titleOf(c) : preview.recognized?.product ?? preview.recognized?.brand ?? preview.kindName ?? preview.label
        const sub = [c && c.brandName !== name ? c.brandName : null, preview.kindName, `foto ${photoIndex(preview.photoId) + 1}`].filter(Boolean).join(" · ")
        return (
          <div role="tooltip" className="photo-dot-card" style={{ position: "absolute", top: "100%", marginTop: 6, left: 0, width: CARD_W, pointerEvents: "none", color: INK }}>
            <div style={{ width: "100%", height: 150, background: SOFT, overflow: "hidden" }}>
              {p && <Crop key={preview.id} src={p.url} size={p.width && p.height ? { w: p.width, h: p.height } : null} box={preview.box} aspect={CARD_W / 150} zoom />}
            </div>
            <div style={{ padding: "8px 12px 10px" }}>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
              <div style={{ fontSize: 12, fontWeight: 300, color: MUTED, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
            </div>
          </div>
        )
      })()}
      {/* Naam van de knop bij hover, net onder de kaart (de kaart zelf knipt af). */}
      {hovered && (
        <div role="tooltip" style={{ position: "absolute", top: "100%", marginTop: 6, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <span style={{ background: INK, color: "#fff", fontSize: 12, padding: "4px 8px", borderRadius: 3, whiteSpace: "nowrap" }}>{hovered.label}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Zelf koppelen in de kaart: eerst het merk (alleen de selectie), dan de
 * collectie — die van de soort van de stip bovenaan. Of alleen het merk, of
 * "collectie staat er niet in" (wacht op de catalogus; het merk wordt
 * geïnventariseerd).
 */
function LinkPicker({ d, busy, admin, brand, setBrand, onLink, onCancel }: {
  d: PhotoDetection
  busy: boolean
  /** Alleen een admin zet een merk in de selectie; een eigenaar stelt het voor. */
  admin: boolean
  brand: BrandHit | null
  setBrand: (b: BrandHit | null) => void
  onLink: (action: ReviewAction) => void
  onCancel: (() => void) | null
}) {
  const [q, setQ] = useState("")
  const [brands, setBrands] = useState<BrandHit[]>([])
  /** De zoekterm waarvoor de resultaten gelden (om "niets gevonden" pas dan te tonen). */
  const [searched, setSearched] = useState("")
  const [outside, setOutside] = useState<BrandHit | null>(null)
  const [adding, setAdding] = useState(false)
  const [collections, setCollections] = useState<BrandCollection[] | null>(null)

  useEffect(() => {
    if (brand) return
    const term = q.trim()
    if (!term) { setBrands([]); setSearched(""); setOutside(null); return }
    let alive = true
    const t = setTimeout(async () => {
      const res = await searchCuratedBrands(term)
      if (alive && !("error" in res)) { setBrands(res.brands); setOutside(res.outsideSelection); setSearched(term) }
    }, 180)
    return () => { alive = false; clearTimeout(t) }
  }, [q, brand])
  useEffect(() => {
    if (!brand) { setCollections(null); return }
    // Voorgesteld merk (nog niet bij ons): geen collecties.
    if (!brand.id) { setCollections([]); return }
    let alive = true
    void listBrandCollections(brand.id, d.kindSlug).then((res) => { if (alive) setCollections("error" in res ? [] : res.collections) })
    return () => { alive = false }
  }, [brand, d.kindSlug])

  const input: React.CSSProperties = { width: "100%", fontSize: 13, padding: "7px 9px", border: `1px solid ${LINE}`, borderRadius: 4, outline: "none" }
  const linkBtn: React.CSSProperties = { background: "none", border: "none", padding: 0, fontSize: 12, color: INK, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", textAlign: "left" }
  const term = q.trim().toLowerCase()
  const shownCollections = (collections ?? []).filter((c) => !term || c.name.toLowerCase().includes(term))

  return (
    <div style={{ padding: "0 8px 8px", display: "grid", gap: 6 }}>
      {!brand ? (
        <>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Merk zoeken…" style={input} aria-label="Merk zoeken" />
          {brands.map((b) => (
            <button key={b.id} type="button" onClick={() => { setBrand(b); setQ("") }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: INK }}>
              <BrandMark name={b.name} logoUrl={b.logoUrl} size={22} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span>
            </button>
          ))}
          {/* Niets gevonden: het merk staat buiten de selectie, of nog niet bij ons. */}
          {searched && searched === q.trim() && brands.length === 0 && (
            outside && admin ? (
              <button type="button" disabled={busy || adding} style={linkBtn}
                onClick={async () => {
                  setAdding(true)
                  const res = await inventoryRecognizedBrand(outside.name, null)
                  setAdding(false)
                  if ("error" in res) { toast.error(res.error); return }
                  setBrand({ id: res.brandId, name: res.brandName, logoUrl: res.logoUrl }); setQ("")
                }}>
                {adding ? "Bezig…" : <>{outside.name} staat niet in de selectie · in de selectie zetten</>}
              </button>
            ) : (
              <button type="button" disabled={busy} style={linkBtn}
                onClick={() => { const name = q.trim(); setBrand({ id: "", name: name.charAt(0).toUpperCase() + name.slice(1), logoUrl: null }); setQ("") }}>
                &ldquo;{q.trim()}&rdquo; voorstellen als merk
              </button>
            )
          )}
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BrandMark name={brand.name} logoUrl={brand.logoUrl} size={22} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brand.name}</span>
            <button type="button" aria-label="Ander merk" title="Ander merk" onClick={() => { setBrand(null); setQ("") }}
              style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: MUTED, display: "flex" }}><X size={14} /></button>
          </div>
          {collections === null ? (
            <div style={{ fontSize: 12, color: MUTED, padding: "4px 2px" }}>Collecties laden…</div>
          ) : (
            <>
              {/* Geen collecties van dit merk: niets te zoeken, de vink koppelt het merk. */}
              {collections.length > 0 && (
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Collectie zoeken…" style={input} aria-label="Collectie zoeken" />
              )}
              {shownCollections.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gridAutoRows: "max-content", gap: 6, maxHeight: 236, overflowY: "auto", paddingRight: 2 }}>
                  {shownCollections.map((c) => (
                    <button key={c.id} type="button" disabled={busy} onClick={() => onLink({ type: "pick", target: { kind: "collection", id: c.id } })}
                      title={c.fits ? `${c.name} · zelfde soort` : c.name}
                      style={{ padding: 0, border: `1px solid ${c.fits ? "#cfd8d3" : LINE}`, borderRadius: 4, background: "#fff", cursor: "pointer", textAlign: "left", overflow: "hidden" }}>
                      <span style={{ display: "block", aspectRatio: "4 / 3", background: SOFT }}>
                        {c.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.imageUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        )}
                      </span>
                      <span style={{ display: "block", padding: "4px 6px", fontSize: 12, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {/* Niets gevonden op de zoekterm: die collectie bestaat (nog) niet
                  bij ons. De stip wacht erop; het merk wordt geïnventariseerd. */}
              {q.trim() && shownCollections.length === 0 && (
                <button type="button" disabled={busy} style={linkBtn} onClick={() => onLink({ type: "missing", brand: brand.name, name: q.trim() })}>
                  &ldquo;{q.trim()}&rdquo; staat er niet in · wacht op de catalogus
                </button>
              )}
            </>
          )}
        </>
      )}
      {onCancel && (
        <button type="button" style={{ ...linkBtn, color: MUTED }} onClick={onCancel}>Annuleren</button>
      )}
    </div>
  )
}

function BrandMark({ name, logoUrl, size }: { name: string; logoUrl: string | null; size: number }) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" style={{ width: size, height: size, minWidth: size, borderRadius: "50%", objectFit: "contain", background: SOFT, mixBlendMode: "multiply" }} />
  ) : (
    <span style={{ width: size, height: size, minWidth: size, borderRadius: "50%", background: SOFT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500 }}>
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

/** Een kaart naast een kader leggen zonder het te bedekken: boven, onder, rechts, links; past niets, dan waar het meeste plek is. */
function placeOutside(box: { l: number; t: number; r: number; b: number }, w: number, h: number) {
  const gap = 14, m = 8, vw = window.innerWidth, vh = window.innerHeight
  const clampX = (x: number) => Math.min(Math.max(x, m), vw - w - m)
  const clampY = (y: number) => Math.min(Math.max(y, m), vh - h - m - 28)
  const cx = (box.l + box.r) / 2, cy = (box.t + box.b) / 2
  const options = [
    { room: box.t - gap - m, need: h, left: clampX(cx - w / 2), top: box.t - gap - h },
    { room: vh - box.b - gap - m - 28, need: h, left: clampX(cx - w / 2), top: box.b + gap },
    { room: vw - box.r - gap - m, need: w, left: box.r + gap, top: clampY(cy - h / 2) },
    { room: box.l - gap - m, need: w, left: box.l - gap - w, top: clampY(cy - h / 2) },
  ]
  const fit = options.find((o) => o.room >= o.need)
  if (fit) return { left: fit.left, top: fit.top }
  const best = options.reduce((a, o) => (o.room / o.need > a.room / a.need ? o : a))
  return { left: clampX(best.left), top: clampY(best.top) }
}

/** Beeld en naam van de kaart: een link naar de collectie in een nieuw tabblad, als die er is. */
function CardLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <>{children}</>
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "inherit", textDecoration: "none" }} title="Collectie openen in een nieuw tabblad">
      {children}
    </Link>
  )
}

/**
 * Een uitsnede in de rij "hetzelfde product" van de kaart: vierkant, even
 * breed als de knoppen eronder. `overlay="add"`: bij hover een + over het
 * beeld (zoals bij merk toevoegen). `dot`: de stand van die stip rechtsboven.
 */
function SameTile({ x, photos, label, onClick, onHover, ring = null, dot = false, dashed = false, overlay, disabled = false, cursor = "pointer", extra = null }: {
  x: PhotoDetection
  photos: Photo[]
  label: string
  onClick: () => void
  onHover: (x: PhotoDetection | null) => void
  ring?: string | null
  dot?: boolean
  dashed?: boolean
  overlay?: "add"
  disabled?: boolean
  cursor?: string
  extra?: React.ReactNode
}) {
  const [over, setOver] = useState(false)
  const p = photos.find((ph) => ph.id === x.photoId)
  return (
    <span style={{ position: "relative", display: "block" }}
      onMouseEnter={() => { setOver(true); onHover(x) }}
      onMouseLeave={() => { setOver(false); onHover(null) }}>
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
        style={{
          position: "relative", display: "block", width: "100%", aspectRatio: "1", padding: 0, borderRadius: 4, background: "none", cursor,
          border: dashed ? `1px dashed #b4b4b0` : "none",
          outline: ring ? `2px solid ${ring}` : "none", outlineOffset: 1,
        }}>
        <span style={{ position: "absolute", inset: dashed ? 2 : 0, borderRadius: dashed ? 2 : 4, overflow: "hidden" }}>
          {p && <ThumbCrop photo={p} box={x.box} />}
          {overlay === "add" && (
            <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(1, 109, 117, 0.82)", color: "#fff", opacity: over && !disabled ? 1 : 0, transition: "opacity 0.15s ease" }}>
              <Plus size={18} />
            </span>
          )}
        </span>
        {dot && <span style={{ position: "absolute", right: -3, top: -3, width: 10, height: 10, borderRadius: "50%", border: "1.5px solid #fff", background: STATE_STYLE[detectionState(x)].color }} />}
      </button>
      {extra}
    </span>
  )
}

/** Een kleine uitsnede uit een (andere) foto; de maat zelf bepalen als die niet bekend is. */
function ThumbCrop({ photo, box }: { photo: Photo; box: Box }) {
  const [size, setSize] = useState<Size | null>(photo.width && photo.height ? { w: photo.width, h: photo.height } : null)
  useEffect(() => {
    if (size) return
    const img = new window.Image()
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = photo.url
  }, [photo.url, size])
  return <Crop src={photo.url} size={size} box={box} zoom />
}

/** De uitsnede uit de foto, in verhouding, met wat ruimte eromheen. */
function Crop({ src, size: given, box, aspect = 1, zoom = false }: { src: string; size: Size | null; box: Box; aspect?: number; /** Het vlak helemaal met het product vullen (bijsnijden), zonder randen eromheen. */ zoom?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [side, setSide] = useState(0)
  // De echte maat van het geladen beeld gaat voor: de opgeslagen maat kan afwijken.
  const [loaded, setLoaded] = useState<Size | null>(null)
  const size = loaded ?? given
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSide(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  let img: React.CSSProperties | null = null
  if (size && side) {
    // Het kader helemaal in beeld, gecentreerd; de rest van het vlak vult de
    // foto eromheen.
    const W = side, H = side / aspect
    const padX = (box.x1 - box.x0) * 0.08, padY = (box.y1 - box.y0) * 0.08
    const x0 = Math.max(0, box.x0 - padX), y0 = Math.max(0, box.y0 - padY)
    const x1 = Math.min(1, box.x1 + padX), y1 = Math.min(1, box.y1 + padY)
    const bw = (x1 - x0) * size.w, bh = (y1 - y0) * size.h
    const scale = zoom
      ? Math.max(W / bw, H / bh, W / size.w, H / size.h)
      : Math.max(Math.min(W / bw, H / bh), Math.max(W / size.w, H / size.h))
    const iw = size.w * scale, ih = size.h * scale
    const cx = ((x0 + x1) / 2) * iw, cy = ((y0 + y1) / 2) * ih
    img = {
      position: "absolute", maxWidth: "none", width: iw, height: ih,
      left: Math.min(0, Math.max(W - iw, W / 2 - cx)),
      top: Math.min(0, Math.max(H - ih, H / 2 - cy)),
    }
  }
  return (
    <div ref={ref} style={{ position: "relative", width: "100%", aspectRatio: String(aspect), background: SOFT, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false}
        onLoad={(e) => { const t = e.currentTarget; if (t.naturalWidth && (!loaded || loaded.w !== t.naturalWidth)) setLoaded({ w: t.naturalWidth, h: t.naturalHeight }) }}
        style={img ?? { position: "absolute", opacity: 0 }} />
    </div>
  )
}

/**
 * Zoeken in de catalogus; voor de volgende stap (de kaart dynamisch maken:
 * andere kandidaat, zoeken, "staat er niet tussen").
 */
export function CatalogSearch({ busy, onPick }: { busy: boolean; onPick: (hit: CatalogHit) => void }) {
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<CatalogHit[] | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return }
    let alive = true
    setLoading(true)
    const t = setTimeout(async () => {
      const res = await searchCatalog(q)
      if (!alive) return
      setLoading(false)
      if ("error" in res) { toast.error(res.error); return }
      setHits(res.hits)
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [q])
  return (
    <div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Merk, collectie of product"
        style={{ width: "100%", fontSize: 13, padding: "8px 10px", border: `1px solid ${LINE}`, borderRadius: 3, outline: "none" }} />
      <div style={{ marginTop: 6, maxHeight: 240, overflowY: "auto" }}>
        {loading && <div style={{ fontSize: 12, color: MUTED, padding: "6px 2px" }}>Zoeken…</div>}
        {!loading && hits && hits.length === 0 && <div style={{ fontSize: 12, color: MUTED, padding: "6px 2px" }}>Niets gevonden.</div>}
        {hits?.map((h) => (
          <button key={`${h.kind}:${h.id}`} type="button" disabled={busy} onClick={() => onPick(h)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", background: "none", border: "none", borderBottom: `1px solid ${LINE}`, cursor: "pointer", textAlign: "left" }}>
            <span style={{ width: 36, height: 36, flex: "0 0 36px", background: SOFT, borderRadius: 3, overflow: "hidden" }}>
              {h.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: h.kind === "brand" ? "contain" : "cover", mixBlendMode: "multiply" }} />
              )}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.title}</span>
              <span style={{ display: "block", fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.subtitle}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const plainBtn: React.CSSProperties = { background: "none", border: "none", color: "#e8e8e6", cursor: "pointer", fontSize: 13, padding: 0 }
/** Pill in de bovenbalk; aan = licht gevuld. */
const pill = (active: boolean): React.CSSProperties => ({
  height: 30, padding: "0 14px", borderRadius: 999, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
  border: `1px solid ${active ? "#e8e8e6" : "#3a3a38"}`,
  background: active ? "#e8e8e6" : "transparent",
  color: active ? "#151514" : "#c9c9c5",
})
const roundBtn: React.CSSProperties = { width: 40, height: 40, borderRadius: "50%", border: "1px solid #3a3a38", background: "transparent", color: "#e8e8e6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }
