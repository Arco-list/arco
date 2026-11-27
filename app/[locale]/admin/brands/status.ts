/**
 * Merkstatus — één vocabulaire voor de tabel en de merkpagina.
 *
 * Zelfde woorden als /admin/companies: 'unclaimed' heet daar "Added"
 * (gecatalogiseerd, nog niets mee gedaan) en 'prospected' "Showcased".
 * De enumwaarden blijven; alleen de labels lopen gelijk. Een merk kent
 * geen claim-trechter met Verified en Owned (nog niet), dus: Added →
 * Catalogued → Showcased → Listed, met Deactivated als afrit onder Added,
 * Passed (niet premium) onder Catalogued en Unlisted geparkeerd onder
 * Listed. Catalogued zet de database zelf bij de eerste collectie
 * (migratie 354). Dezelfde kleuren als bij bedrijven waar die bestaan.
 */

export type BrandStatus = "suggested" | "unclaimed" | "catalogued" | "passed" | "prospected" | "unlisted" | "listed" | "deactivated"

export const ALL_STATUSES: BrandStatus[] = ["suggested", "unclaimed", "catalogued", "passed", "prospected", "unlisted", "listed", "deactivated"]

/**
 * Suggested (migratie 347) staat vóór de funnel: een naam die bij het
 * beoordelen van een stip is voorgesteld. Met een domein wordt het Added.
 */
export const STATUS_LABEL: Record<BrandStatus, string> = {
  suggested: "Suggested",
  unclaimed: "Added",
  catalogued: "Catalogued",
  passed: "Passed",
  prospected: "Showcased",
  unlisted: "Unlisted",
  listed: "Listed",
  deactivated: "Deactivated",
}

export const STATUS_DOT: Record<BrandStatus, string> = {
  suggested: "#94a3b8",
  unclaimed: "#dc2626",
  catalogued: "#ea580c",
  passed: "#78716c",
  prospected: "#f59e0b",
  unlisted: "#a1a1a0",
  listed: "#7c3aed",
  deactivated: "#dc2626",
}

export const STATUS_DESC: Record<BrandStatus, string> = {
  suggested: "Proposed while reviewing product dots. Add the domain to catalogue it.",
  unclaimed: "In the database — scraped or added by hand. No collections yet.",
  catalogued: "At least one collection added. Set automatically with the first collection.",
  passed: "Not premium — kept out of projects, product recognition and the catalogue.",
  prospected: "Showcase page live, used in outreach, waiting to be claimed.",
  unlisted: "Claimed by the brand, hidden from public directories.",
  listed: "Claimed and live, fully discoverable.",
  deactivated: "Removed by admin — hidden.",
}
