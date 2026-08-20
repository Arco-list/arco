import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

/**
 * Batch-generates the expanded editorial body (translations.<locale>.seo_body)
 * for published projects. The body renders on the project page behind a
 * "Read more" toggle and exists to give each page substantially more unique,
 * fact-grounded text (the 44 NEUTRAL-indexation pages average ~60 words).
 *
 * Grounding: the model only receives facts from the database — title,
 * description, styles, rooms, location, year, scope and credited companies —
 * and is instructed to write nothing beyond them. Output is stored per
 * locale (nl + en) in the translations JSONB; owners can edit it in the
 * project editor like any other text.
 *
 * Usage (admin/cron secret):
 *   GET /api/admin/generate-seo-body?secret=…&limit=3        → next 3 without a body
 *   GET /api/admin/generate-seo-body?secret=…&ids=a,b        → specific projects
 *   GET /api/admin/generate-seo-body?secret=…&limit=3&force=1 → regenerate even if present
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const MODEL = "claude-sonnet-5"

type ProjectFacts = {
  id: string
  title: string
  description: string
  location: string | null
  year: number | null
  scope: string | null
  buildingType: string | null
  styles: string[]
  rooms: string[]
  companies: string[]
  translations: Record<string, unknown> | null
}

function buildPrompt(f: ProjectFacts): string {
  const facts = [
    `Title: ${f.title}`,
    f.location ? `Location: ${f.location}` : null,
    f.year ? `Year: ${f.year}` : null,
    f.scope ? `Scope: ${f.scope}` : null,
    f.buildingType ? `Building type: ${f.buildingType}` : null,
    f.styles.length ? `Styles: ${f.styles.join(", ")}` : null,
    f.rooms.length ? `Rooms / spaces photographed: ${f.rooms.join(", ")}` : null,
    f.companies.length ? `Companies that worked on it: ${f.companies.join(", ")}` : null,
    `Existing intro description (already shown above your text — do NOT repeat it):\n${f.description}`,
  ].filter(Boolean).join("\n")

  return `You write short editorial project stories for Arco, a curated Dutch architecture platform. Tone: quiet, precise, magazine-like — think architectural journal, not real-estate listing. No superlatives ("stunning", "breathtaking"), no marketing filler, no invented facts.

Write a CONTINUATION body for the project page below. It renders after the existing intro, behind a "Read more" link.

Rules:
- 140–200 words per language, 2–3 short paragraphs separated by blank lines.
- Use ONLY the facts provided. Never invent materials, dimensions, awards, or client details that are not listed. If a fact list is thin, write less rather than padding.
- Weave in the rooms/spaces and style naturally; mention the location and companies where it reads well.
- Do not repeat sentences or phrasing from the existing intro.
- Plain text only, no headings, no markdown.

Facts:
${facts}

Return STRICT JSON, nothing else:
{"nl": "<Dutch body>", "en": "<English body>"}`
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const header = request.headers.get("authorization") ?? ""
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : ""
  const queryToken = request.nextUrl.searchParams.get("secret") ?? ""
  if (bearer !== expected && queryToken !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 })
  }

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 3) || 3, 15)
  const idsParam = request.nextUrl.searchParams.get("ids")
  const force = request.nextUrl.searchParams.get("force") === "1"

  const supabase = createServiceRoleSupabaseClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("projects")
    .select("id, title, description, translations, address_city, location, project_year, project_type, building_type, style_preferences")
    .eq("status", "published")
  if (idsParam) {
    query = query.in("id", idsParam.split(",").map((s: string) => s.trim()).filter(Boolean))
  }
  const { data: projectRows, error: projErr } = await query
  if (projErr) {
    return NextResponse.json({ error: projErr.message }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = ((projectRows ?? []) as any[])
    .filter((p) => force || !(p.translations?.nl?.seo_body || p.translations?.en?.seo_body))
    .slice(0, limit)

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, generated: 0, message: "no candidates" })
  }

  const ids = candidates.map((p) => p.id)
  const [{ data: featureRows }, { data: linkRows }, { data: taxonomyRows }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("project_features").select("project_id, name").in("project_id", ids),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("project_professionals")
      .select("project_id, company:companies(name)")
      .in("project_id", ids)
      .not("company_id", "is", null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("project_taxonomy_options")
      .select("id, name")
      .in("id", Array.from(new Set(candidates.flatMap((p) => (Array.isArray(p.style_preferences) ? p.style_preferences : []))))),
  ])

  const styleNameById = new Map<string, string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((taxonomyRows ?? []) as any[]).map((r) => [String(r.id), String(r.name)]),
  )

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const results: Array<{ id: string; title: string; ok: boolean; error?: string }> = []

  for (const p of candidates) {
    const facts: ProjectFacts = {
      id: p.id,
      title: p.title,
      description: String(p.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      location: p.address_city ?? p.location ?? null,
      year: p.project_year ?? null,
      scope: p.project_type ?? null,
      buildingType: p.building_type ?? null,
      styles: (Array.isArray(p.style_preferences) ? p.style_preferences : [])
        .map((id: string) => styleNameById.get(String(id)))
        .filter((n: string | undefined): n is string => Boolean(n)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rooms: ((featureRows ?? []) as any[])
        .filter((f) => f.project_id === p.id && f.name)
        .map((f) => String(f.name)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      companies: Array.from(new Set(((linkRows ?? []) as any[])
        .filter((l) => l.project_id === p.id && l.company?.name)
        .map((l) => String(l.company.name)))),
      translations: p.translations ?? null,
    }

    try {
      const msg = await anthropic.messages.create({
        model: MODEL,
        // Two ~200-word bodies plus JSON escaping — 1500 truncated mid-
        // string on longer outputs ("Unexpected end of JSON input").
        max_tokens: 3000,
        messages: [{ role: "user", content: buildPrompt(facts) }],
      })
      const text = msg.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim()
      const jsonStart = text.indexOf("{")
      const jsonEnd = text.lastIndexOf("}")
      const candidate = text.slice(jsonStart, jsonEnd + 1)
      // Two-paragraph bodies occasionally arrive with literal newlines
      // inside JSON strings — repair control characters before giving up
      // (same pass as the import extraction).
      let parsed: { nl?: string; en?: string }
      try {
        parsed = JSON.parse(candidate)
      } catch {
        let out = ""
        let inStr = false
        let esc = false
        for (const ch of candidate) {
          if (inStr) {
            if (esc) { out += ch; esc = false; continue }
            if (ch === "\\") { out += ch; esc = true; continue }
            if (ch === '"') { inStr = false; out += ch; continue }
            if (ch === "\n") { out += "\\n"; continue }
            if (ch === "\r") { continue }
            if (ch === "\t") { out += "\\t"; continue }
            out += ch
          } else {
            if (ch === '"') inStr = true
            out += ch
          }
        }
        parsed = JSON.parse(out)
      }
      if (!parsed.nl?.trim() || !parsed.en?.trim()) {
        throw new Error("model returned empty body")
      }

      const existing = (p.translations ?? {}) as Record<string, Record<string, unknown>>
      const merged = {
        ...existing,
        nl: { ...(existing.nl ?? {}), seo_body: parsed.nl.trim() },
        en: { ...(existing.en ?? {}), seo_body: parsed.en.trim() },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (supabase as any)
        .from("projects")
        .update({ translations: merged })
        .eq("id", p.id)
      if (updErr) throw new Error(updErr.message)
      results.push({ id: p.id, title: p.title, ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error("generate-seo-body failed for project", { projectId: p.id, error: message })
      results.push({ id: p.id, title: p.title, ok: false, error: message })
    }
  }

  return NextResponse.json({
    ok: true,
    generated: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  })
}
