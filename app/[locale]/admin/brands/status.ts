/**
 * Merkstatus — één vocabulaire voor de tabel en de merkpagina.
 *
 * Zelfde woorden als /admin/companies: 'unclaimed' heet daar "Added"
 * (gecatalogiseerd, nog niets mee gedaan) en 'prospected' "Showcased".
 * De enumwaarden blijven; alleen de labels lopen gelijk. Een merk kent
 * geen claim-trechter met Verified en Owned (nog niet), dus: Added →
 * Showcased → Listed, met Unlisted geparkeerd onder Listed en
 * Deactivated als afrit onder Added. Dezelfde kleuren als bij bedrijven,
 * zodat één blik op beide pagina's hetzelfde zegt.
 */

export type BrandStatus = "unclaimed" | "prospected" | "unlisted" | "listed" | "deactivated"

export const ALL_STATUSES: BrandStatus[] = ["unclaimed", "prospected", "unlisted", "listed", "deactivated"]

export const STATUS_LABEL: Record<BrandStatus, string> = {
  unclaimed: "Added",
  prospected: "Showcased",
  unlisted: "Unlisted",
  listed: "Listed",
  deactivated: "Deactivated",
}

export const STATUS_DOT: Record<BrandStatus, string> = {
  unclaimed: "#dc2626",
  prospected: "#f59e0b",
  unlisted: "#a1a1a0",
  listed: "#7c3aed",
  deactivated: "#dc2626",
}

export const STATUS_DESC: Record<BrandStatus, string> = {
  unclaimed: "Catalogued — scraped or added by hand. Not visible, no outreach yet.",
  prospected: "Showcase page live, used in outreach, waiting to be claimed.",
  unlisted: "Claimed by the brand, hidden from public directories.",
  listed: "Claimed and live, fully discoverable.",
  deactivated: "Removed by admin — hidden.",
}
