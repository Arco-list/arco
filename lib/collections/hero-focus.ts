import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { logger } from "@/lib/logger"
import { PIPELINE_MODEL } from "@/lib/collections/prompts"
import { isCutoutPhoto, pickCollectionHero } from "@/lib/products/collection-hero"

/**
 * Het focuspunt van de hero van een collectie: de hero vult de volle
 * breedte en snijdt een foto bij, dus we bewaren waar het product staat
 * (focus_x/focus_y, 0–1, migratie 326) en zetten daar object-position op.
 * Claude kijkt één keer per hero-foto (± $0,005); een admin kan het punt
 * daarna met een klik op de hero verzetten.
 */

const FOCUS_SCHEMA = {
  type: "object",
  properties: {
    x: { type: "number", description: "Horizontal centre of the product, 0 = left edge, 1 = right edge." },
    y: { type: "number", description: "Vertical centre of the product, 0 = top edge, 1 = bottom edge." },
  },
  required: ["x", "y"],
  additionalProperties: false,
} as const

const clamp = (n: number) => Math.min(1, Math.max(0, n))

export async function findProductFocus(imageUrl: string, collectionName: string, brandName: string): Promise<{ x: number; y: number } | null> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const message = await client.messages.create({
      model: PIPELINE_MODEL,
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          {
            type: "text",
            text: `This photo shows the collection "${collectionName}" by "${brandName}". It will be cropped to a wide banner, so we need the point to keep in view: the centre of the furniture or products of this collection (the group of pieces together if there are several), not the sky, trees or background. Give x and y as fractions of the image width and height.`,
          },
        ],
      }],
      output_config: { effort: "low", format: { type: "json_schema", schema: FOCUS_SCHEMA } },
    } as any)
    const block = (message.content as any[]).find((b) => b.type === "text")
    const data = block ? JSON.parse(block.text) : null
    if (!data || typeof data.x !== "number" || typeof data.y !== "number") return null
    return { x: clamp(data.x), y: clamp(data.y) }
  } catch (err) {
    logger.warn("Hero focus failed", { imageUrl, error: String(err) })
    return null
  }
}

/** De hero van een collectie een focuspunt geven als die er nog geen heeft. */
export async function ensureHeroFocus(sb: any, collectionId: string): Promise<void> {
  const { data: photos } = await sb.from("product_collection_photos")
    .select("id, url, is_primary, order_index, kind, width, height, focus_x, focus_y")
    .eq("collection_id", collectionId)
    .order("order_index")
  const list = ((photos ?? []) as any[]).map((p) => ({ ...p, isPrimary: Boolean(p.is_primary) }))
  const hero = pickCollectionHero(list)
  if (!hero || hero.focus_x != null || isCutoutPhoto(hero)) return
  const { data: col } = await sb.from("product_collections").select("name, brand:brands(name)").eq("id", collectionId).maybeSingle()
  const focus = await findProductFocus(hero.url, col?.name ?? "", (col?.brand as { name?: string } | null)?.name ?? "")
  if (focus) await sb.from("product_collection_photos").update({ focus_x: focus.x, focus_y: focus.y }).eq("id", hero.id)
}
