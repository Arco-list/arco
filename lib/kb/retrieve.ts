import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { embedOne, toPgVector } from "@/lib/embeddings"

/**
 * Retrieve top-K most relevant kb_chunks for a query string. Embeds
 * the query with the same model used at index time, then runs cosine
 * similarity (pgvector `<=>`) against kb_chunks.embedding. Results
 * are ordered by similarity ascending (lower distance = closer match).
 *
 * Language filter is recommended — keeps the prompt context tight and
 * avoids cross-language voice contamination (a Dutch reply shouldn't
 * pull English FAQ chunks even if they're semantically close).
 */

export type KbChunk = {
  id: string
  source: string
  source_key: string
  language: string
  title: string | null
  content: string
  similarity: number
}

export type RetrieveOptions = {
  topK?: number
  language?: "en" | "nl"
  source?: string
  /**
   * Distance ceiling — chunks with cosine distance above this are
   * dropped even if they're in the top-K. 1.0 = effectively no
   * filter; tighten to 0.5–0.7 in production once we have data.
   */
  maxDistance?: number
}

export async function retrieveKbChunks(
  query: string,
  options: RetrieveOptions = {},
): Promise<KbChunk[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const { topK = 5, language, source, maxDistance = 1.0 } = options

  // No OPENAI_API_KEY → silent zero results so the caller (the AI
  // draft generator) just skips RAG context. Logged so it's visible.
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[kb/retrieve] OPENAI_API_KEY not set — skipping retrieval")
    return []
  }

  let queryEmbedding: number[]
  try {
    queryEmbedding = await embedOne(trimmed)
  } catch (err) {
    console.error("[kb/retrieve] embedding failed", err)
    return []
  }

  const supabase = createServiceRoleSupabaseClient()
  // Use rpc-style raw SQL via execute_sql isn't available client-side;
  // instead we lean on the .order() with a custom column pattern. Cleanest
  // path is a SECURITY DEFINER RPC, but for now we hand-roll the SELECT
  // via the pg-rest filter operator postgrest exposes for vector columns.
  //
  // Actually pgvector's `<=>` cosine-distance op is callable via .order()
  // when we project the distance as a column. We do that with an .rpc()
  // call to a small SQL function — see migration 158. For initial wiring
  // we go with a parameterised SELECT via .rpc('kb_search', ...).
  // Until that's wired we fall back to fetching all rows and computing
  // distance in JS — fine at our content scale (<200 chunks total).
  const { data, error } = await (supabase as any)
    .from("kb_chunks")
    .select("id, source, source_key, language, title, content, embedding")
    .match({
      ...(language ? { language } : {}),
      ...(source ? { source } : {}),
    })

  if (error) {
    console.error("[kb/retrieve] kb_chunks fetch failed", error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[]
  if (rows.length === 0) return []

  // Cosine distance in JS for each row: 1 - (a·b)/(|a||b|).
  // Embeddings are normalised by OpenAI (unit-length), so dot product
  // alone equals cosine similarity. We compute distance = 1 - dot.
  const scored: KbChunk[] = rows.map((row) => {
    const vec = parsePgVector(row.embedding)
    const distance = 1 - dot(queryEmbedding, vec)
    return {
      id: row.id,
      source: row.source,
      source_key: row.source_key,
      language: row.language,
      title: row.title ?? null,
      content: row.content,
      similarity: 1 - distance,
    }
  })

  return scored
    .filter((c) => 1 - c.similarity <= maxDistance)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
}

function dot(a: number[], b: number[]): number {
  let s = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) s += a[i] * b[i]
  return s
}

/** pgvector returns the column as a string like '[0.1,0.2,...]'. */
function parsePgVector(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw as number[]
  if (typeof raw !== "string") return []
  // Trim brackets, split on comma, parseFloat each.
  const trimmed = raw.replace(/^\[/, "").replace(/\]$/, "")
  if (!trimmed) return []
  return trimmed.split(",").map(Number)
}

// Re-export so callers can format embeddings for SQL inserts without
// a second import line.
export { toPgVector }
