import { createHash } from "node:crypto"

/**
 * Instellingen van de productherkenning op één plek (migratie 336). Elke
 * detectie en elk voorstel krijgt een kopie mee (kolom `pipeline`), zodat we
 * na een aanpassing kunnen zien welke voorstellen met welke instellingen
 * gedaan zijn, en de testset (scripts/eval-recognition.ts) varianten tegen
 * elkaar kan meten.
 *
 * Prompts gaan mee als korte hash: een gewijzigde prompt is zo altijd
 * zichtbaar, ook als niemand een versienummer ophoogt.
 */

export type MatchConfig = {
  /** Model dat de kandidaten beoordeelt. */
  judgeModel: string
  /** Hoeveel kandidaten Claude te zien krijgt. */
  candidates: number
  /** Hoeveel beelden het zoeken op beeld oplevert (vóór één per collectie). */
  searchCount: number
  /** Extra gelijkenis voor een merk dat aan het project gekoppeld is. */
  projectBrandBoost: number
}

export const MATCH_CONFIG: MatchConfig = {
  judgeModel: "claude-sonnet-5-5",
  candidates: 8,
  searchCount: 30,
  projectBrandBoost: 0.04,
}

export const promptHash = (...parts: string[]) => createHash("sha1").update(parts.join("\n---\n")).digest("hex").slice(0, 10)
