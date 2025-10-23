"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"

import { useProjectPreview } from "@/contexts/project-preview-context"

export function MapSection() {
  const { location } = useProjectPreview()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const [isMapsLoaded, setIsMapsLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  const hasSummary = Boolean(location.city || location.region || location.addressFormatted || location.summary)
  if (!hasSummary) {
    return null
  }

  const summaryLabel = location.city || location.summary || ""
  const preciseLabel = location.canViewExact && location.shareExact && location.addressFormatted ? location.addressFormatted : null
  const label = preciseLabel || summaryLabel
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const hasExactCoordinates =
    location.canViewExact &&
    location.shareExact &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number"

  useEffect(() => {
    if (!isMapsLoaded || !mapRef.current || !window.google?.maps) {
      return
    }

    try {
      if (hasExactCoordinates && location.latitude && location.longitude) {
        const position = { lat: location.latitude, lng: location.longitude }
        
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: position,
          zoom: 15,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: true,
        })

        markerRef.current = new window.google.maps.Marker({
          map: mapInstanceRef.current,
          position,
          title: label,
        })
      } else {
        const geocoder = new window.google.maps.Geocoder()
        const cityQuery = location.city || summaryLabel

        geocoder.geocode({ address: cityQuery }, (results, status) => {
          if (status === "OK" && results && results[0] && mapRef.current) {
            const position = results[0].geometry.location

            mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
              center: position,
              zoom: 11,
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
            })

            markerRef.current = new window.google.maps.Marker({
              map: mapInstanceRef.current,
              position,
              title: summaryLabel,
            })
          } else {
            setMapError("Unable to locate address")
          }
        })
      }
    } catch (error) {
      console.error("Error initializing map:", error)
      setMapError("Failed to load map")
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null
      }
    }
  }, [isMapsLoaded, hasExactCoordinates, location.latitude, location.longitude, location.city, summaryLabel, label])

  if (!mapsApiKey) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-black">Explore the area</h2>
        {label && <p className="text-gray-600">{label}</p>}
        <div className="relative h-64 bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-sm text-gray-500">
            Add a Google Maps API key to display map
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places`}
        strategy="lazyOnload"
        onLoad={() => {
          if (window.google?.maps) {
            setIsMapsLoaded(true)
          }
        }}
        onError={() => {
          setMapError("Failed to load Google Maps")
        }}
      />
      
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-black">Explore the area</h2>
        {label && <p className="text-gray-600">{label}</p>}

        <div className="relative h-64 bg-gray-200 rounded-lg overflow-hidden">
          {!isMapsLoaded && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-sm text-gray-600">Loading map...</div>
            </div>
          )}
          
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-sm text-red-600">{mapError}</div>
            </div>
          )}

          <div ref={mapRef} className="w-full h-full" />

          {!location.shareExact && isMapsLoaded && !mapError && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <div className="bg-white px-4 py-2 rounded-lg shadow-lg text-center">
                <p className="text-sm text-gray-600">Approximate location</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
