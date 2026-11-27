import type { LucideIcon } from "lucide-react"

import {
  ArtIcon,
  BathroomIcon,
  BedroomIcon,
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
  ShedBuilderIcon,
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
 * Admin › categorieën toont dezelfde keuze.
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
  // Subgroepen (indeling v2, migratie 351); zonder eigen tekening die van
  // de hoofdgroep (pendant, tafels, wastafels…).
  sofas: UpholsteryIcon,
  armchairs: UpholsteryIcon,
  storage: CabinetMakerIcon,
  bedroom: BedroomIcon,
  "outdoor-lighting": OutdoorLightingIcon,
  kitchens: KitchenIcon,
  countertops: TilesStonesIcon,
  "sauna-steam": WellnessIcon,
  spas: WellnessIcon,
  pools: SwimmingPoolIcon,
  "outdoor-lounge": OutdoorFurnitureIcon,
  "fire-heat": FireplaceIcon,
  pergolas: ShedBuilderIcon,
  "garden-accessories": GardenerIcon,
  "indoor-fireplaces": FireplaceIcon,
  "home-accessories": InteriorStylingIcon,
  rugs: FlooringIcon,
  "window-treatments": WindowsDoorsIcon,
  art: ArtIcon,
  // Geparkeerd (Afwerking, Bouw & techniek): niet in het menu, wel in admin.
  doors: WindowsDoorsIcon,
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
