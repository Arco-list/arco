import "server-only"

/**
 * OpenAI embeddings via fetch — no SDK dependency.
 *
 * Used by the KB indexer (writes embeddings to kb_chunks) and the
 * KB retriever (embeds the query before pgvector search).
 *
 * Model: text-embedding-3-small (1536 dims). Dirt cheap (~$0.02 per
 * 1M tokens) and good quality at our content scale. If we ever switch
 * dimensions, the kb_chunks table needs a re-create — store
 * EMBEDDING_DIMENSIONS in code so the migration matches.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small"
export const EMBEDDING_DIMENSIONS = 1536

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"

function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is required for embeddings. Add it to .env.local locally and Vercel env (sensitive) for prod.",
    )
  }
  return key
}

/**
 * Embed one or more strings. Returns embeddings in the same order as
 * the input. OpenAI batches up to 2048 inputs per request — we cap at
 * 100 per call to keep payload size reasonable; callers passing more
 * should chunk themselves or this could be extended to auto-batch.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  if (texts.length > 100) {
    throw new Error(`embed() got ${texts.length} inputs; cap at 100 per call (or extend the helper to auto-batch)`)
  }

  const r = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  })

  if (!r.ok) {
    const text = await r.text()
    throw new Error(`OpenAI embeddings failed (${r.status}): ${text}`)
  }

  const json = (await r.json()) as {
    data: Array<{ index: number; embedding: number[] }>
  }
  // OpenAI guarantees order matches input but be defensive.
  const ordered = new Array<number[]>(texts.length)
  for (const item of json.data) ordered[item.index] = item.embedding
  return ordered
}

/** Convenience: single-string variant. */
export async function embedOne(text: string): Promise<number[]> {
  const [out] = await embed([text])
  return out
}

/** Format a JS number array as a Postgres `vector` literal for raw SQL. */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}
