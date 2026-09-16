"use client"

import type { LucideIcon } from "lucide-react"
import {
  Cpu,
  Hammer,
  Leaf,
  Paintbrush,
  Ruler,
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
  UpholsteryIcon,
  WindowsDoorsIcon,
  StructuralEngineerIcon,
  RoofingIcon,
  WellnessIcon,
  ElectricalIcon,
  HeatingVentilationIcon,
  SecurityIcon,
  SmartHomeIcon,
  SolarIcon,
  PainterIcon,
  FencingIcon,
  ShedBuilderIcon,
  PersonIcon,
} from "./custom-service-icons"

/* The mark for a professional whose trade we do not know yet — an
   unassigned credit, a company still picking its services. A person,
   not a briefcase: at that moment we know someone worked on the
   project, not that there is a business behind it. And the briefcase
   was the one lucide glyph left among the hand-drawn marks, so it read
   as foreign wherever it appeared beside them. */
const DEFAULT_PROFESSIONAL_ICON: LucideIcon = PersonIcon

/**
 * Every service in the taxonomy now has a hand-drawn Arco mark; only
 * two synonym-services keep a lucide stand-in (interior fit-out →
 * Ruler, indoor plants → Leaf).
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
  structural_engineer: StructuralEngineerIcon,
  design_planning_structural_engineer: StructuralEngineerIcon,

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
  construction_roof: RoofingIcon,
  roof: RoofingIcon,
  roofing: RoofingIcon,
  construction_wellness: WellnessIcon,
  wellness: WellnessIcon,
  saunas_spas: WellnessIcon,

  // — Systems
  systems_lighting: LightingIcon,
  lighting: LightingIcon,
  systems_electrical_systems: ElectricalIcon,
  electrical_systems: ElectricalIcon,
  systems_security_systems: SecurityIcon,
  security_systems: SecurityIcon,
  systems_domotica: SmartHomeIcon,
  domotica: SmartHomeIcon,
  smart_homes: SmartHomeIcon,
  systems_smart_homes: SmartHomeIcon,
  heating_ventilation: HeatingVentilationIcon,
  systems_heating_ventilation: HeatingVentilationIcon,
  solar_installer: SolarIcon,
  systems_solar_installer: SolarIcon,

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
  upholstery: UpholsteryIcon,
  finishing_upholstery: UpholsteryIcon,
  finishing_furniture: FurnitureIcon,
  art: ArtIcon,
  finishing_art: ArtIcon,
  finishing_interior_fit_out: Ruler,
  interior_fit_out: Ruler,
  finishing_painting: PainterIcon,
  painting: PainterIcon,
  painter: PainterIcon,
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
  outdoor_garden_house: ShedBuilderIcon,
  garden_house: ShedBuilderIcon,
  shed_builder: ShedBuilderIcon,
  outdoor_shed_builder: ShedBuilderIcon,
  outdoor_fencing_and_gates: FencingIcon,
  fencing_and_gates: FencingIcon,
  fencing_gates: FencingIcon,
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
