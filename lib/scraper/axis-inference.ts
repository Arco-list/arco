// Turns a list of sniffed variants (typically with a single `name` string
// like "Round 250, Rosetta Dawn") into a fully structured attribute map.
// The delimiter is auto-detected; axis names are inferred via a cheap
// Claude Haiku call once the column structure is known. If inference
// fails we fall back to a single-axis shape so the downstream normalizer
// can still render something.

import type Anthropic from "@anthropic-ai/sdk"
import type { RawVariant } from "./types"
import type { SniffedVariant } from "./sniffers/types"

const DELIMITERS = [", ", " / ", " - ", " | ", " — ", " – ", "/"]

interface Split {
  delimiter: string
  columns: string[][]   // columns[v][c] for variant v, column c
  columnCount: number
}

function trySplit(names: string[], delimiter: string): Split | null {
  const columns = names.map((n) => n.split(delimiter).map((s) => s.trim()).filter(Boolean))
  const counts = new Set(columns.map((c) => c.length))
  if (counts.size !== 1) return null          // inconsistent column counts
  const columnCount = [...counts][0]
  if (columnCount < 1) return null
  return { delimiter, columns, columnCount }
}

/** Pick the delimiter that yields the most columns across all variants. */
function pickBestSplit(names: string[]): Split {
  let best: Split = { delimiter: "", columns: names.map((n) => [n]), columnCount: 1 }
  for (const d of DELIMITERS) {
    const split = trySplit(names, d)
    if (!split) continue
    if (split.columnCount > best.columnCount) best = split
  }
  return best
}

/**
 * Strip the product name's words from the front of each column 0 entry.
 * Moooi emits "Digital Garden Carpet Round 250, Rosetta Dawn" — without
 * this the first column's values are all prefixed with the product name.
 */
function stripProductPrefix(columns: string[][], productName: string): string[][] {
  if (!productName || columns.length === 0) return columns
  const productWords = new Set(productName.toLowerCase().split(/\s+/).filter(Boolean))

  return columns.map((row) => {
    return row.map((col, colIdx) => {
      if (colIdx !== 0) return col  // only strip from the first column
      const words = col.split(/\s+/)
      let start = 0
      while (start < words.length && productWords.has(words[start].toLowerCase())) start++
      const cleaned = words.slice(start).join(" ").trim()
      return cleaned.length > 0 ? cleaned : col
    })
  })
}

/** Count unique values per column. */
function uniqueByColumn(columns: string[][]): string[][] {
  const n = columns[0]?.length ?? 0
  const out: string[][] = []
  for (let c = 0; c < n; c++) {
    const seen = new Set<string>()
    const vals: string[] = []
    for (const row of columns) {
      const v = row[c]
      if (!seen.has(v)) { seen.add(v); vals.push(v) }
    }
    out.push(vals)
  }
  return out
}

/**
 * Ask Claude Haiku to assign a short axis name to each column given its
 * value list. Cheap (one call, <1k tokens) and keeps the HTML out of the
 * prompt. Falls back to axis_1/axis_2 if the call fails.
 */
async function nameAxes(
  columns: string[][],
  anthropic: Anthropic,
): Promise<string[]> {
  const fallback = columns.map((_, i) => `axis_${i + 1}`)

  try {
    const prompt = `Given these axis value lists from product variants, name each axis with a single short lowercase word (e.g. "color", "size", "model", "material", "finish"). Return ONLY a JSON array of the names, in order.

${columns.map((vals, i) => `Axis ${i + 1}: ${JSON.stringify(vals.slice(0, 8))}`).join("\n")}`

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 128,
      messages: [{ role: "user", content: prompt }],
    })
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : ""
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return fallback
    const names = JSON.parse(jsonMatch[0])
    if (!Array.isArray(names) || names.length !== columns.length) return fallback
    return names.map((n, i) => {
      if (typeof n !== "string" || !n.trim()) return fallback[i]
      return n.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 20)
    })
  } catch {
    return fallback
  }
}

export interface InferredVariants {
  axes: { name: string; values: string[] }[]
  combinations: RawVariant[]
}

export async function inferAxes(
  variants: SniffedVariant[],
  productName: string,
  anthropic: Anthropic,
): Promise<InferredVariants> {
  if (variants.length === 0) {
    return { axes: [], combinations: [] }
  }

  // Honour pre-structured attributes if the sniffer provided them (Shopify)
  const haveAttrs = variants.every((v) => v.attributes && Object.keys(v.attributes).length > 0)
  if (haveAttrs) {
    const axisNames = [...new Set(variants.flatMap((v) => Object.keys(v.attributes!)))]
    const axes = axisNames.map((name) => ({
      name,
      values: [...new Set(variants.map((v) => v.attributes![name]).filter(Boolean))],
    }))
    const combinations = variants.map(toRawVariant)
    return { axes, combinations }
  }

  // Otherwise split variant names and infer axes from column structure
  const names = variants.map((v) => v.name)
  const split = pickBestSplit(names)
  const columnsStripped = stripProductPrefix(split.columns, productName)
  const uniques = uniqueByColumn(columnsStripped)

  const axisNames = split.columnCount === 1
    ? ["option"]
    : await nameAxes(uniques, anthropic)

  const axes = axisNames.map((name, i) => ({ name, values: uniques[i] ?? [] }))

  const combinations: RawVariant[] = variants.map((v, i) => {
    const row = columnsStripped[i] ?? []
    const attributes: Record<string, string> = {}
    axisNames.forEach((name, c) => {
      const val = row[c]
      if (val) attributes[name] = val
    })
    return {
      ...toRawVariant(v),
      attributes,
    }
  })

  return { axes, combinations }
}

function toRawVariant(v: SniffedVariant): RawVariant {
  return {
    attributes: v.attributes ?? undefined,
    image_url: v.image_url ?? null,
    sku: v.sku ?? undefined,
    price: v.price ?? undefined,
    slug: v.slug ?? undefined,
    in_stock: v.in_stock ?? undefined,
  }
}
