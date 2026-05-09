import { NextRequest, NextResponse } from "next/server"
import path from "node:path"
import { promises as fs } from "node:fs"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { embed, EMBEDDING_DIMENSIONS, toPgVector } from "@/lib/embeddings"
import { logger } from "@/lib/logger"

/**
 * Reindex knowledge-base chunks from source content into kb_chunks.
 *
 * v1 source: the FAQ entries in messages/{en,nl}.json. Walks the
 * `faq` namespace, pairs each `<section>_q<n>` with its `_a<n>`,
 * embeds (Q + A as a single chunk per locale), and upserts.
 *
 * Trigger:
 *   curl -X POST -H "Authorization: Bearer ${CRON_SECRET}" \
 *     https://www.arcolist.com/api/admin/reindex-kb
 *
 * Returns a counts payload so cron logs / manual runs can verify
 * how many chunks were indexed per source/language.
 *
 * Why an endpoint and not a one-shot script: production runs against
 * the live DB without needing a local checkout / env, and we can wire
 * a cron later if the source content starts changing more often. For
 * now FAQ edits are rare so manual is fine.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

type FaqMessages = Record<string, string>

const FAQ_SECTIONS = [
  { key: "browsing", count: 4 },
  { key: "architects", count: 5 },
  { key: "professionals", count: 6 },
  { key: "account", count: 4 },
] as const

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  const header = request.headers.get("authorization") ?? ""
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : ""
  const queryToken = request.nextUrl.searchParams.get("secret") ?? ""
  if (bearer !== expected && queryToken !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 })
  }

  try {
    const counts = { en: 0, nl: 0, total: 0 }
    for (const lang of ["en", "nl"] as const) {
      const messages = await loadFaqMessages(lang)
      const chunks = buildFaqChunks(messages)
      if (chunks.length === 0) continue

      const embeddings = await embed(chunks.map((c) => `${c.title}\n\n${c.content}`))
      const supabase = createServiceRoleSupabaseClient()

      // Upsert each chunk individually so a single bad row doesn't
      // tank the whole reindex. Volume is tiny (~20 per language).
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]
        const vec = embeddings[i]
        if (!vec || vec.length !== EMBEDDING_DIMENSIONS) {
          logger.error("[reindex-kb] embedding size mismatch", {
            source_key: c.source_key,
            got: vec?.length ?? 0,
            want: EMBEDDING_DIMENSIONS,
          })
          continue
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from("kb_chunks").upsert(
          {
            source: "faq",
            source_key: c.source_key,
            language: lang,
            title: c.title,
            content: c.content,
            embedding: toPgVector(vec),
            metadata: { section: c.section },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source,source_key,language" },
        )
        if (error) {
          logger.error("[reindex-kb] upsert failed", { source_key: c.source_key, error })
        } else {
          counts[lang]++
          counts.total++
        }
      }
    }

    return NextResponse.json({ ok: true, ...counts })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error("[reindex-kb] fatal", { error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function loadFaqMessages(lang: "en" | "nl"): Promise<FaqMessages> {
  const filePath = path.join(process.cwd(), "messages", `${lang}.json`)
  const raw = await fs.readFile(filePath, "utf8")
  const parsed = JSON.parse(raw) as { faq?: Record<string, string> }
  return parsed.faq ?? {}
}

function buildFaqChunks(messages: FaqMessages): Array<{
  source_key: string
  section: string
  title: string
  content: string
}> {
  const out: Array<{ source_key: string; section: string; title: string; content: string }> = []
  for (const sec of FAQ_SECTIONS) {
    const sectionTitle = messages[`section_${sec.key}_title`] ?? sec.key
    for (let i = 1; i <= sec.count; i++) {
      const qKey = `${sec.key}_q${i}`
      const aKey = `${sec.key}_a${i}`
      const question = messages[qKey]
      const answer = messages[aKey]
      if (!question || !answer) continue
      out.push({
        source_key: qKey,
        section: sectionTitle,
        title: question,
        content: answer,
      })
    }
  }
  return out
}
