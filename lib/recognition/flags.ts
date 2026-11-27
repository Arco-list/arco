/**
 * Productherkenning voor projecteigenaren (beoordelen van de stippen op hun
 * eigen project). Gebouwd, nog niet aan: zolang dit false is, zien en mogen
 * alleen admins het; admins kunnen het scherm wel "als eigenaar" bekijken.
 * Los bestand (geen server-imports), want de editor leest het ook.
 */
export const OWNER_REVIEW_ENABLED = false

/**
 * Automatisch herkennen: projecten die live gaan (published_at, gezet door
 * trg_set_project_published_at, langs welke weg ook), vanaf deze datum.
 * Afgekeurde projecten kosten zo niets. Eerder gepubliceerde projecten
 * (backfill) gaan via "Producten herkennen" of een aparte ronde.
 */
export const AUTO_RECOGNIZE_SINCE = "2026-11-25T00:00:00Z"
