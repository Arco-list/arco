import type { LucideIcon } from "lucide-react"

import {
  ArchitectIcon,
  BathroomIcon,
  BedroomIcon,
  FurnitureIcon,
  GardenDesignIcon,
  KitchenIcon,
  OutdoorFurnitureIcon,
  ShedBuilderIcon,
  StairsIcon,
  SwimmingPoolIcon,
  WellnessIcon,
} from "@/lib/icons/custom-service-icons"

/**
 * Lijnillustratie per ruimte, uit dezelfde familie als de servicemarks en de
 * productgroepen: de cirkels op /projects tonen deze in plaats van foto's,
 * zodat de drie discoverpagina's één beeldtaal spreken. Een ruimte zonder
 * eigen tekening valt terug op het lucide-pictogram (resolveFeatureIcon).
 */
const SPACE_MARKS: Record<string, LucideIcon> = {
  living: FurnitureIcon,
  kitchen: KitchenIcon,
  bedroom: BedroomIcon,
  bathroom: BathroomIcon,
  hallway: StairsIcon,
  garden: GardenDesignIcon,
  "garden-house": ShedBuilderIcon,
  pool: SwimmingPoolIcon,
  wellness: WellnessIcon,
  terrace: OutdoorFurnitureIcon,
  exterior: ArchitectIcon,
}

export function spaceMark(slug: string): LucideIcon | null {
  return SPACE_MARKS[slug] ?? null
}
