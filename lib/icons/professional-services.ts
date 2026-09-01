"use client"

import type { LucideIcon } from "lucide-react"
import {
  Briefcase,
  Cable,
  Cpu,
  Hammer,
  HeartPulse,
  Home,
  Leaf,
  Lock,
  Paintbrush,
  Ruler,
  ShieldCheck,
  TreePine,
} from "lucide-react"

import {
  ArchitectIcon,
  ArtIcon,
  BathroomIcon,
  BuilderIcon,
  CabinetMakerIcon,
  FireplaceIcon,
  FlooringIcon,
  FurnitureIcon,
  GardenDesignIcon,
  GardenerIcon,
  InteriorDesignIcon,
  InteriorStylingIcon,
  KitchenIcon,
  LightingDesignIcon,
  LightingIcon,
  OutdoorFurnitureIcon,
  OutdoorLightingIcon,
  PhotographerIcon,
  StairsIcon,
  SwimmingPoolIcon,
  TilesStonesIcon,
  WindowsDoorsIcon,
} from "./custom-service-icons"

const DEFAULT_PROFESSIONAL_ICON: LucideIcon = Briefcase

/**
 * Every service that carries credits has a hand-drawn Arco mark; the
 * handful that do not yet (roof, wellness, electrical, security,
 * domotica, painting, indoor plants, fit-out, garden house, fencing)
 * keep a lucide stand-in until they are drawn.
 *
 * Keys are normalised slugs. Both forms are listed for each service:
 * the taxonomy path (`construction_kitchen`) and the bare
 * `categories.slug` (`kitchens`) that a credit actually carries —
 * without the bare form, common services fell through to the generic
 * briefcase.
 */
const SERVICE_ICON_MAP: Record<string, LucideIcon> = {
  // — Design & planning
  architect: ArchitectIcon,
  architecture: ArchitectIcon,
  design_planning_architecture: ArchitectIcon,
  interior_designer: InteriorDesignIcon,
  interior_design: InteriorDesignIcon,
  design_planning_interior_design: InteriorDesignIcon,
  photographer: PhotographerIcon,
  photography: PhotographerIcon,
  garden_designer: GardenDesignIcon,
  garden_design: GardenDesignIcon,
  design_planning_garden_design: GardenDesignIcon,
  landscaping: GardenDesignIcon,
  lighting_designer: LightingDesignIcon,
  lighting_design: LightingDesignIcon,

  // — Construction
  contractor: BuilderIcon,
  builder: BuilderIcon,
  general_contractor: BuilderIcon,
  construction_general_contractor: BuilderIcon,
  bathrooms: BathroomIcon,
  bathroom: BathroomIcon,
  construction_bathroom: BathroomIcon,
  windows_doors: WindowsDoorsIcon,
  windows: WindowsDoorsIcon,
  construction_windows: WindowsDoorsIcon,
  doors: WindowsDoorsIcon,
  construction_doors: WindowsDoorsIcon,
  kitchens: KitchenIcon,
  kitchen: KitchenIcon,
  construction_kitchen: KitchenIcon,
  stairs_elevator: StairsIcon,
  stairs: StairsIcon,
  construction_stairs: StairsIcon,
  elevator: StairsIcon,
  construction_elevator: StairsIcon,
  tiles_stones: TilesStonesIcon,
  stones: TilesStonesIcon,
  tiles_and_stone: TilesStonesIcon,
  construction_tiles_and_stone: TilesStonesIcon,
  swimming_pools: SwimmingPoolIcon,
  swimming_pool: SwimmingPoolIcon,
  construction_swimming_pool: SwimmingPoolIcon,
  construction_roof: Home,
  roof: Home,
  construction_wellness: HeartPulse,
  wellness: HeartPulse,

  // — Systems
  systems_lighting: LightingIcon,
  lighting: LightingIcon,
  systems_electrical_systems: Cable,
  electrical_systems: Cable,
  systems_security_systems: ShieldCheck,
  security_systems: ShieldCheck,
  systems_domotica: Cpu,
  domotica: Cpu,

  // — Finishing
  fireplace: FireplaceIcon,
  finishing_fireplace: FireplaceIcon,
  cabinet_maker: CabinetMakerIcon,
  decoration_and_carpentry: CabinetMakerIcon,
  finishing_decoration_and_carpentry: CabinetMakerIcon,
  flooring: FlooringIcon,
  floor: FlooringIcon,
  finishing_floor: FlooringIcon,
  interior_stylist: InteriorStylingIcon,
  interior_styling: InteriorStylingIcon,
  finishing_interior_styling: InteriorStylingIcon,
  furniture: FurnitureIcon,
  finishing_furniture: FurnitureIcon,
  art: ArtIcon,
  finishing_art: ArtIcon,
  finishing_interior_fit_out: Ruler,
  interior_fit_out: Ruler,
  finishing_painting: Paintbrush,
  painting: Paintbrush,
  finishing_indoor_plants: Leaf,
  indoor_plants: Leaf,

  // — Outdoor
  gardener: GardenerIcon,
  gardening: GardenerIcon,
  outdoor_gardener: GardenerIcon,
  outdoor_furniture: OutdoorFurnitureIcon,
  outdoor_outdoor_furniture: OutdoorFurnitureIcon,
  outdoor_lighting: OutdoorLightingIcon,
  outdoor_outdoor_lighting: OutdoorLightingIcon,
  outdoor_garden: GardenDesignIcon,
  garden: GardenDesignIcon,
  outdoor_garden_house: Home,
  garden_house: Home,
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
