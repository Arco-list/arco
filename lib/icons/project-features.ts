"use client"

import type { LucideIcon } from "lucide-react"
import {
  Bath,
  Bed,
  Car,
  DoorOpen,
  Droplet,
  Flame,
  Flower2,
  Grid3x3,
  Home,
  Layers,
  MapPin,
  MoreHorizontal,
  Paintbrush,
  Shield,
  Sofa,
  TreePine,
  UtensilsCrossed,
  Waves,
} from "lucide-react"

const DEFAULT_FEATURE_ICON: LucideIcon = Grid3x3

const FEATURE_ICON_MAP: Record<string, LucideIcon> = {
  attic: Home,
  balcony: Home,
  basement: Layers,
  bathroom: Bath,
  bath: Bath,
  bedroom: Bed,
  carport: Car,
  dining_room: UtensilsCrossed,
  exterior: Home,
  fireplace: Flame,
  garage: Car,
  garden: TreePine,
  hallway: DoorOpen,
  indoor_pool: Waves,
  kitchen: UtensilsCrossed,
  lighting: Shield,
  living_room: Sofa,
  materials: Layers,
  office: Home,
  outdoor: TreePine,
  outdoor_pool: Waves,
  pool: Waves,
  spa: Droplet,
  terrace: Layers,
  wellness: Droplet,
  water: Droplet,
  wood: TreePine,
  stone: Layers,
  metal: Shield,
  glass: Shield,
  paint: Paintbrush,
  landscaping: Flower2,
  location: MapPin,
  other: MoreHorizontal,
}

const normaliseSlug = (slug?: string | null) => {
  if (!slug) {
    return null
  }

  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export const resolveFeatureIcon = (slug?: string | null): LucideIcon => {
  const normalised = normaliseSlug(slug)
  if (!normalised) {
    return DEFAULT_FEATURE_ICON
  }

  if (FEATURE_ICON_MAP[normalised]) {
    return FEATURE_ICON_MAP[normalised]
  }

  const fallback = normalised.replace(/s$/, "")
  if (FEATURE_ICON_MAP[fallback]) {
    return FEATURE_ICON_MAP[fallback]
  }

  return DEFAULT_FEATURE_ICON
}

