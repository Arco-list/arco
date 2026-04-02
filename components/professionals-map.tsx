"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import type { ProfessionalCard } from "@/lib/professionals/types"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300"

// Netherlands center
const NL_CENTER = { lat: 52.1326, lng: 5.2913 }
const NL_ZOOM = 8

// Cluster radius in pixels — markers within this distance get grouped
const CLUSTER_RADIUS = 60

// Clean muted map style matching the reference design
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f3" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b6b68" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#e0e0dc" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e8e8e4" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#d4e4ec" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#eef0e8" }] },
]

// ─── Shared Maps check ─────────────────────────────────────────────

function useGoogleMapsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    let retries = 0
    const check = () => {
      if (cancelled) return
      if (window.google?.maps?.Map) {
        setReady(true)
        return
      }
      retries++
      if (retries < 80) setTimeout(check, 100)
    }
    check()
    return () => { cancelled = true }
  }, [])
  return ready
}

function getMappable(professionals: ProfessionalCard[]) {
  return professionals.filter(
    (p) => typeof p.latitude === "number" && typeof p.longitude === "number"
  )
}

// ─── Simple clustering logic ────────────────────────────────────────

type Cluster = {
  lat: number
  lng: number
  professionals: ProfessionalCard[]
}

function clusterMarkers(
  map: google.maps.Map,
  professionals: ProfessionalCard[],
  radius: number
): Cluster[] {
  const projection = map.getProjection()
  const zoom = map.getZoom() ?? NL_ZOOM

  if (!projection) {
    // Fallback: no clustering
    return professionals.map((p) => ({
      lat: p.latitude!,
      lng: p.longitude!,
      professionals: [p],
    }))
  }

  const scale = Math.pow(2, zoom)
  const clusters: Cluster[] = []

  for (const p of professionals) {
    const latLng = new google.maps.LatLng(p.latitude!, p.longitude!)
    const point = projection.fromLatLngToPoint(latLng)
    if (!point) continue

    const px = point.x * scale
    const py = point.y * scale

    let merged = false
    for (const cluster of clusters) {
      const clusterLatLng = new google.maps.LatLng(cluster.lat, cluster.lng)
      const clusterPoint = projection.fromLatLngToPoint(clusterLatLng)
      if (!clusterPoint) continue

      const cpx = clusterPoint.x * scale
      const cpy = clusterPoint.y * scale

      const dx = px - cpx
      const dy = py - cpy
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        cluster.professionals.push(p)
        // Update cluster center to average
        const n = cluster.professionals.length
        cluster.lat = cluster.lat + (p.latitude! - cluster.lat) / n
        cluster.lng = cluster.lng + (p.longitude! - cluster.lng) / n
        merged = true
        break
      }
    }

    if (!merged) {
      clusters.push({
        lat: p.latitude!,
        lng: p.longitude!,
        professionals: [p],
      })
    }
  }

  return clusters
}

// ─── Cluster marker SVG icon ────────────────────────────────────────

function getClusterIcon(count: number): google.maps.Icon {
  const size = count < 10 ? 26 : count < 100 ? 30 : 34
  const fontSize = count < 10 ? 11 : 10
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#1a1a19"/>
    <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dy="0.35em" fill="white" font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="500">${count}</text>
  </svg>`

  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  }
}

// ─── InfoWindow card content (rendered as HTML string) ──────────────

function getInfoWindowContent(professional: ProfessionalCard) {
  const city = professional.location?.split(",")[0]?.trim() || ""
  const service = professional.profession || "Professional services"
  const image = professional.image || PLACEHOLDER_IMAGE
  const logo = professional.logoUrl
  const initial = professional.name.charAt(0).toUpperCase()
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/professionals/${professional.slug}`

  const logoHtml = logo
    ? `<img src="${logo}" alt="" style="width:28px;height:28px;min-width:28px;border-radius:50%;object-fit:cover;" />`
    : `<div style="width:28px;height:28px;min-width:28px;border-radius:50%;background:#f5f5f4;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;color:#1a1a19;">${initial}</div>`

  // Save (heart) and Share (upload) icons — visible on hover
  const actionsHtml = `
    <div class="map-card-actions">
      <button class="map-card-action-btn" data-action="save" data-company-id="${professional.id}" aria-label="Save company">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      </button>
      <button class="map-card-action-btn" data-action="share" data-share-url="${shareUrl}" aria-label="Share">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
      </button>
    </div>
  `

  return `
    <div class="map-card-wrapper">
      <a href="/professionals/${professional.slug}" style="display:block;text-decoration:none;color:inherit;width:240px;">
        <div style="position:relative;width:100%;height:140px;overflow:hidden;">
          <img src="${image}" alt="${professional.name}" style="width:100%;height:100%;object-fit:cover;display:block;" />
          ${actionsHtml}
        </div>
        <div style="padding:10px 12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            ${logoHtml}
            <div style="min-width:0;">
              <div style="font-size:13px;font-weight:500;color:#1a1a19;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${professional.name}</div>
              <div style="font-size:12px;font-weight:300;color:#6b6b68;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${service}${city ? ` · ${city}` : ""}</div>
            </div>
          </div>
        </div>
      </a>
    </div>
  `
}

// ─── Full-screen Map ────────────────────────────────────────────────

interface ProfessionalsMapProps {
  professionals: ProfessionalCard[]
  onClose: () => void
}

export function ProfessionalsMap({ professionals, onClose }: ProfessionalsMapProps) {
  const t = useTranslations("professionals")
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const renderMarkersRef = useRef<() => void>(() => {})
  const isMapsLoaded = useGoogleMapsReady()

  const mappable = getMappable(professionals)

  // Lock body scroll and dynamically set height to fill viewport
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Prevent page from scrolling below the map
    document.body.style.overflow = "hidden"

    const updateHeight = () => {
      const top = el.getBoundingClientRect().top
      el.style.height = `${window.innerHeight - top}px`
    }

    updateHeight()
    window.addEventListener("resize", updateHeight)

    // Detect chip strip appearing/disappearing — it changes our top offset
    // Poll with rAF since the chip strip is a sibling outside our tree
    let lastTop = el.getBoundingClientRect().top
    let rafId: number
    const checkPosition = () => {
      const currentTop = el.getBoundingClientRect().top
      if (currentTop !== lastTop) {
        lastTop = currentTop
        updateHeight()
      }
      rafId = requestAnimationFrame(checkPosition)
    }
    rafId = requestAnimationFrame(checkPosition)

    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("resize", updateHeight)
      cancelAnimationFrame(rafId)
    }
  }, [])

  // Keep renderMarkers in a ref so the idle listener always calls the latest version
  renderMarkersRef.current = () => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    const clusters = clusterMarkers(map, mappable, CLUSTER_RADIUS)

    clusters.forEach((cluster) => {
      if (cluster.professionals.length === 1) {
        // Single marker — black dot
        const professional = cluster.professionals[0]
        const marker = new google.maps.Marker({
          map,
          position: { lat: cluster.lat, lng: cluster.lng },
          title: professional.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: "#1a1a19",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        })

        marker.addListener("click", () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(getInfoWindowContent(professional))
            infoWindowRef.current.open(map, marker)
          }
        })

        markersRef.current.push(marker)
      } else {
        // Cluster marker — numbered circle
        const marker = new google.maps.Marker({
          map,
          position: { lat: cluster.lat, lng: cluster.lng },
          icon: getClusterIcon(cluster.professionals.length),
          title: `${cluster.professionals.length} professionals`,
        })

        marker.addListener("click", () => {
          // Close any open InfoWindow
          infoWindowRef.current?.close()

          // Zoom into the cluster
          const bounds = new google.maps.LatLngBounds()
          cluster.professionals.forEach((p) =>
            bounds.extend({ lat: p.latitude!, lng: p.longitude! })
          )
          map.fitBounds(bounds, { top: 60, bottom: 80, left: 60, right: 60 })
        })

        markersRef.current.push(marker)
      }
    })
  }

  // Initialize map (runs once)
  useEffect(() => {
    if (!isMapsLoaded || !mapRef.current || mapInstanceRef.current) return

    const map = new google.maps.Map(mapRef.current, {
      center: NL_CENTER,
      zoom: NL_ZOOM,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: MAP_STYLES,
    })

    mapInstanceRef.current = map
    infoWindowRef.current = new google.maps.InfoWindow()

    // Handle clicks on save/share buttons inside InfoWindow
    infoWindowRef.current.addListener("domready", () => {
      const wrapper = document.querySelector(".map-card-wrapper")
      if (!wrapper) return

      wrapper.querySelectorAll<HTMLButtonElement>(".map-card-action-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault()
          e.stopPropagation()
          const action = btn.dataset.action
          if (action === "share") {
            const url = btn.dataset.shareUrl
            if (url) navigator.clipboard.writeText(url)
          }
        })
      })
    })

    // Close info window on map click
    map.addListener("click", () => {
      infoWindowRef.current?.close()
    })

    // Re-cluster on every zoom/pan — always calls latest renderMarkers via ref
    // Re-cluster on every zoom/pan
    map.addListener("idle", () => {
      renderMarkersRef.current()
    })

    // Fit bounds
    if (mappable.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      mappable.forEach((p) => bounds.extend({ lat: p.latitude!, lng: p.longitude! }))
      map.fitBounds(bounds, { top: 60, bottom: 80, left: 60, right: 60 })
    } else if (mappable.length === 1) {
      map.setCenter({ lat: mappable[0].latitude!, lng: mappable[0].longitude! })
      map.setZoom(12)
    }
  }, [isMapsLoaded])

  // Auto-zoom to fit filtered results when professionals change
  const prevMappableIdsRef = useRef<string>("")

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !isMapsLoaded) return

    const currentIds = mappable.map((p) => p.companyId).sort().join(",")

    // Skip if the set hasn't changed (including initial mount handled by map init)
    if (currentIds === prevMappableIdsRef.current) return
    const isInitial = prevMappableIdsRef.current === ""
    prevMappableIdsRef.current = currentIds

    // Don't auto-zoom on initial render — the map init effect handles that
    if (isInitial) return

    // Re-render markers immediately (don't wait for idle)
    renderMarkersRef.current()

    // Fit bounds to new set
    if (mappable.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      mappable.forEach((p) => bounds.extend({ lat: p.latitude!, lng: p.longitude! }))
      map.fitBounds(bounds, { top: 60, bottom: 80, left: 60, right: 60 })
    } else if (mappable.length === 1) {
      map.setCenter({ lat: mappable[0].latitude!, lng: mappable[0].longitude! })
      map.setZoom(12)
    } else {
      // No results — zoom back to Netherlands
      map.setCenter(NL_CENTER)
      map.setZoom(NL_ZOOM)
    }
  }, [mappable, isMapsLoaded])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (infoWindowRef.current) infoWindowRef.current.close()
        else onClose()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div className="professionals-map-fullscreen" ref={containerRef}>
      {/* Map container */}
      <div ref={mapRef} className="professionals-map-canvas" />

      {!isMapsLoaded && (
        <div className="professionals-map-loading">
          <p>{t("loading_map")}</p>
        </div>
      )}

      {/* Professional count */}
      <div className="professionals-map-count">
        {t("map_count", { shown: mappable.length, total: professionals.length })}
      </div>

      {/* Show list button — centered at bottom */}
      <button className="professionals-map-close" onClick={onClose} aria-label="Show list">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
        {t("show_list")}
      </button>
    </div>
  )
}

// ─── Map Preview Card (grid tile) ──────────────────────────────────

interface MapPreviewCardProps {
  professionals: ProfessionalCard[]
  onClick: () => void
  className?: string
}

export function MapPreviewCard({ professionals, onClick, className }: MapPreviewCardProps) {
  const t = useTranslations("professionals")
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const isMapsLoaded = useGoogleMapsReady()

  const mappable = getMappable(professionals)

  // Initialize preview map
  useEffect(() => {
    if (!isMapsLoaded || !mapRef.current || mapInstanceRef.current) return

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: NL_CENTER,
      zoom: NL_ZOOM,
      disableDefaultUI: true,
      gestureHandling: "none",
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      styles: MAP_STYLES,
    })

    // Fit to markers
    if (mappable.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      mappable.forEach((p) => bounds.extend({ lat: p.latitude!, lng: p.longitude! }))
      mapInstanceRef.current.fitBounds(bounds, 30)
    }

    // Add dot markers
    mappable.forEach((p) => {
      const marker = new google.maps.Marker({
        map: mapInstanceRef.current!,
        position: { lat: p.latitude!, lng: p.longitude! },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: "#1a1a19",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
        },
        clickable: false,
      })
      markersRef.current.push(marker)
    })
  }, [isMapsLoaded])

  return (
    <button
      className={`professionals-map-preview${className ? ` ${className}` : ""}`}
      onClick={onClick}
      aria-label="Show all professionals on map"
    >
      <div className="professionals-map-preview-wrap">
        <div ref={mapRef} className="professionals-map-preview-map" />
        {!isMapsLoaded && <div className="professionals-map-preview-placeholder" />}
        <div className="professionals-map-preview-overlay">
          <span className="professionals-map-preview-btn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1C5.24 1 3 3.13 3 5.75C3 9.5 8 15 8 15C8 15 13 9.5 13 5.75C13 3.13 10.76 1 8 1Z" />
              <circle cx="8" cy="5.75" r="1.75" />
            </svg>
            {t("show_on_map")}
          </span>
        </div>
      </div>
    </button>
  )
}
