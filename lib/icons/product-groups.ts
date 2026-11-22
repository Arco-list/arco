import type { LucideIcon } from "lucide-react"

import {
  BathroomIcon,
  BuilderIcon,
  FlooringIcon,
  FurnitureIcon,
  InteriorStylingIcon,
  KitchenIcon,
  LightingIcon,
  OutdoorFurnitureIcon,
  WellnessIcon,
} from "@/lib/icons/custom-service-icons"

/**
 * Lijnicoon per productgroep, in de stijl van de servicemarks: de terugval
 * voor een schijf op /products zolang de groep geen productfoto heeft
 * (Keuken, Decor & textiel). Zelfde tekeningen als de bijbehorende dienst.
 */
const PRODUCT_GROUP_ICONS: Record<string, LucideIcon> = {
  furniture: FurnitureIcon,
  lighting: LightingIcon,
  kitchen: KitchenIcon,
  bathroom: BathroomIcon,
  wellness: WellnessIcon,
  outdoor: OutdoorFurnitureIcon,
  decor: InteriorStylingIcon,
  finishes: FlooringIcon,
  construction: BuilderIcon,
}

export function productGroupIcon(slug: string): LucideIcon {
  return PRODUCT_GROUP_ICONS[slug] ?? FurnitureIcon
}
