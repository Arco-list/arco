"use client"

import type { LucideIcon } from "lucide-react"
import {
  Armchair,
  ArrowUpDown,
  Bath,
  Briefcase,
  Building2,
  Cable,
  Cpu,
  DoorClosed,
  Flame,
  Hammer,
  HeartPulse,
  Home,
  Lamp,
  Layers,
  Leaf,
  Lightbulb,
  Lock,
  Paintbrush,
  Palette,
  Ruler,
  Scissors,
  ShieldCheck,
  Sofa,
  Sparkles,
  Sun,
  TreePine,
  UtensilsCrossed,
  Waves,
} from "lucide-react"

const DEFAULT_PROFESSIONAL_ICON: LucideIcon = Briefcase

const SERVICE_ICON_MAP: Record<string, LucideIcon> = {
  design_planning_architecture: Building2,
  architecture: Building2,
  design_planning_interior_design: Sofa,
  interior_design: Sofa,
  design_planning_garden_design: TreePine,
  garden_design: TreePine,
  construction_general_contractor: Hammer,
  general_contractor: Hammer,
  construction_roof: Home,
  roof: Home,
  construction_tiles_and_stone: Layers,
  tiles_and_stone: Layers,
  construction_kitchen: UtensilsCrossed,
  kitchen: UtensilsCrossed,
  construction_stairs: ArrowUpDown,
  stairs: ArrowUpDown,
  construction_elevator: ArrowUpDown,
  elevator: ArrowUpDown,
  construction_windows: Home,
  windows: Home,
  construction_bathroom: Bath,
  bathroom: Bath,
  construction_swimming_pool: Waves,
  swimming_pool: Waves,
  construction_wellness: HeartPulse,
  wellness: HeartPulse,
  construction_doors: DoorClosed,
  doors: DoorClosed,
  systems_lighting: Lightbulb,
  lighting: Lightbulb,
  systems_electrical_systems: Cable,
  electrical_systems: Cable,
  systems_security_systems: ShieldCheck,
  security_systems: ShieldCheck,
  systems_domotica: Cpu,
  domotica: Cpu,
  finishing_interior_fit_out: Ruler,
  interior_fit_out: Ruler,
  finishing_fireplace: Flame,
  fireplace: Flame,
  finishing_interior_styling: Sparkles,
  interior_styling: Sparkles,
  finishing_painting: Paintbrush,
  painting: Paintbrush,
  finishing_decoration_and_carpentry: Scissors,
  decoration_and_carpentry: Scissors,
  finishing_indoor_plants: Leaf,
  indoor_plants: Leaf,
  finishing_floor: Ruler,
  floor: Ruler,
  finishing_furniture: Lamp,
  furniture: Lamp,
  finishing_art: Palette,
  art: Palette,
  outdoor_outdoor_lighting: Sun,
  outdoor_lighting: Sun,
  outdoor_garden: TreePine,
  garden: TreePine,
  outdoor_garden_house: Home,
  garden_house: Home,
  outdoor_outdoor_furniture: Armchair,
  outdoor_furniture: Armchair,
  outdoor_fencing_and_gates: Lock,
  fencing_and_gates: Lock,
}

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  design_planning: Ruler,
  construction: Hammer,
  systems: Cpu,
  finishing: Paintbrush,
  outdoor: TreePine,
}

const normalise = (value?: string | null) =>
  value
    ?.toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") ?? null

export const resolveProfessionalServiceIcon = (slug?: string | null, parentName?: string | null): LucideIcon => {
  const slugKey = normalise(slug)

  if (slugKey) {
    if (SERVICE_ICON_MAP[slugKey]) {
      return SERVICE_ICON_MAP[slugKey]
    }

    const slugParts = slugKey.split("_")
    const lastPart = slugParts[slugParts.length - 1]
    if (lastPart && SERVICE_ICON_MAP[lastPart]) {
      return SERVICE_ICON_MAP[lastPart]
    }
  }

  const parentKey = normalise(parentName)
  if (parentKey && CATEGORY_ICON_MAP[parentKey]) {
    return CATEGORY_ICON_MAP[parentKey]
  }

  return DEFAULT_PROFESSIONAL_ICON
}
