import type { LucideIcon } from "lucide-react"

import {
  ArtIcon,
  BathroomIcon,
  BuilderIcon,
  CabinetMakerIcon,
  ElectricalIcon,
  FireplaceIcon,
  FlooringIcon,
  FurnitureIcon,
  GardenerIcon,
  HeatingVentilationIcon,
  InteriorStylingIcon,
  KitchenIcon,
  LightingIcon,
  OutdoorFurnitureIcon,
  OutdoorLightingIcon,
  PainterIcon,
  RoofingIcon,
  StairsIcon,
  SwimmingPoolIcon,
  TilesStonesIcon,
  UpholsteryIcon,
  WellnessIcon,
  WindowsDoorsIcon,
} from "@/lib/icons/custom-service-icons"

/**
 * Lijnillustratie per productgroep en, waar de set er een heeft, per
 * subgroep — in de stijl van de servicemarks. De schijven op /products en
 * de groepspagina's tonen deze in plaats van productfoto's: rustiger naast
 * de merk- en collectiekaarten. Een subgroep zonder eigen tekening krijgt
 * die van zijn hoofdgroep. Een eigen beeld van de categorie (admin ›
 * categorieën) gaat voor; daar komen tzt de specifieke illustraties.
 */
const PRODUCT_GROUP_ICONS: Record<string, LucideIcon> = {
  // Hoofdgroepen
  furniture: FurnitureIcon,
  lighting: LightingIcon,
  kitchen: KitchenIcon,
  bathroom: BathroomIcon,
  wellness: WellnessIcon,
  outdoor: OutdoorFurnitureIcon,
  decor: InteriorStylingIcon,
  finishes: FlooringIcon,
  construction: BuilderIcon,
  // Subgroepen
  "sofas-armchairs": UpholsteryIcon,
  storage: CabinetMakerIcon,
  "indoor-lighting": LightingIcon,
  "outdoor-lighting": OutdoorLightingIcon,
  kitchens: KitchenIcon,
  countertops: TilesStonesIcon,
  pools: SwimmingPoolIcon,
  "outdoor-furniture": OutdoorFurnitureIcon,
  "garden-accessories": GardenerIcon,
  "fire-heat": FireplaceIcon,
  art: ArtIcon,
  textiles: UpholsteryIcon,
  doors: WindowsDoorsIcon,
  "indoor-fireplaces": FireplaceIcon,
  radiators: HeatingVentilationIcon,
  stairs: StairsIcon,
  walls: PainterIcon,
  floors: FlooringIcon,
  installations: ElectricalIcon,
  "facade-roof": RoofingIcon,
  "windows-glazing": WindowsDoorsIcon,
}

/** De eerste slug met een tekening: geef de soort en dan zijn ouders mee
 *  (soort → subgroep → hoofdgroep). */
export function productGroupIcon(...slugs: string[]): LucideIcon {
  for (const slug of slugs) if (PRODUCT_GROUP_ICONS[slug]) return PRODUCT_GROUP_ICONS[slug]
  return FurnitureIcon
}
