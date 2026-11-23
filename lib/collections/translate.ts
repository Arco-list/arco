import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { logger } from "@/lib/logger"
import { PIPELINE_MODEL } from "@/lib/collections/prompts"

/**
 * Beschrijvingen van merken en collecties in twee talen (migratie 330):
 * description is de Engelse bron, translations = { en: { description },
 * nl: { description } }. De pijplijn schrijft beide talen tegelijk; een
 * bewerking in admin (Engels) wordt hier naar het Nederlands vertaald.
 */

export type DescriptionTranslations = { en?: { description?: string | null }; nl?: { description?: string | null } }

/** Per taal de velden: description, en bij collecties ook materials en
 *  finishes (migratie 331). */
export type LocaleFields = Record<string, unknown>
export type Translations = Record<string, LocaleFields | undefined>

/**
 * Voegt velden per taal samen met wat er al staat, in plaats van het hele
 * object te vervangen: een nieuwe beschrijving laat de materialen staan en
 * andersom. Lees de huidige translations eerst uit de rij.
 */
export function mergeTranslations(existing: unknown, patch: Translations): Translations {
  const base = (existing && typeof existing === "object" ? existing : {}) as Translations
  const out: Translations = { ...base }
  for (const [locale, fields] of Object.entries(patch)) {
    if (!fields) continue
    out[locale] = { ...(base[locale] ?? {}), ...fields }
  }
  return out
}

/** Een lijst (materials, finishes) in de taal van de pagina, anders de Engelse kolom. */
export function localizedList(row: { translations?: unknown } & Record<string, unknown>, field: string, locale: string): string[] {
  const t = (row.translations ?? {}) as Translations
  const local = t[locale]?.[field]
  if (Array.isArray(local) && local.length > 0) return local.map(String)
  const en = row[field]
  return Array.isArray(en) ? en.map(String) : []
}

export const descriptionTranslations = (en: string | null, nl: string | null): DescriptionTranslations => ({
  en: { description: en },
  nl: { description: nl ?? en },
})

/** De beschrijving in de taal van de pagina, anders de Engelse bron. */
export function localizedDescription(row: { description?: string | null; translations?: unknown }, locale: string): string | null {
  const t = (row.translations ?? {}) as Record<string, { description?: string | null } | undefined>
  return t[locale]?.description?.trim() || row.description?.trim() || null
}

export async function translateToDutch(text: string): Promise<string | null> {
  if (!text.trim()) return null
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const message = await client.messages.create({
      model: PIPELINE_MODEL,
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Translate this description of an interior products brand or collection into natural, editorial Dutch (as a Dutch design magazine would write it). Keep product, collection and brand names as they are. Return only the translation.\n\n${text}`,
      }],
      output_config: { effort: "low" },
    } as any)
    const block = (message.content as any[]).find((b) => b.type === "text")
    return block?.text?.trim() || null
  } catch (err) {
    logger.warn("Translate to Dutch failed", { error: String(err) })
    return null
  }
}
