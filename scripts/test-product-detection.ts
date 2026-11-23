/**
 * Proef productherkenning (Notion › Product recognition, fase 2): de foto's
 * van één project door Sonnet 5.5 en Haiku 5.5, met dezelfde vraag —
 * ruimte + hooguit drie producten met soort, kader en beschrijving. Schrijft
 * de uitkomst als JSON en een vergelijkingspagina (HTML) met de kaders op
 * de foto's. Direct (geen batch), zodat het meteen klaar is; de kosten
 * staan erbij voor zowel direct als batch.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-product-detection.ts <project-slug> <out-dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)

const ROOMS = ["Living", "Kitchen", "Bathroom", "Bedroom", "Hallway", "Home Office", "Exterior", "Terrace", "Pool", "Garden", "Other"] as const
const MODELS = [
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", inPerM: 2, outPerM: 10 },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", inPerM: 0.1, outPerM: 0.5 },
] as const

const SCHEMA = {
  type: "object",
  properties: {
    room: { type: "string", enum: [...ROOMS] },
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind_slug: { type: ["string", "null"] },
          label: { type: "string" },
          box: {
            type: "object",
            properties: { x0: { type: "number" }, y0: { type: "number" }, x1: { type: "number" }, y1: { type: "number" } },
            required: ["x0", "y0", "x1", "y1"],
            additionalProperties: false,
          },
          description: { type: "string" },
          brand_cues: { type: ["string", "null"] },
        },
        required: ["kind_slug", "label", "box", "description", "brand_cues"],
        additionalProperties: false,
      },
    },
  },
  required: ["room", "products"],
  additionalProperties: false,
} as const

type Detection = { room: string; products: Array<{ kind_slug: string | null; label: string; box: { x0: number; y0: number; x1: number; y1: number }; description: string; brand_cues: string | null }> }

async function main() {
  const [slug, outDir] = process.argv.slice(2)
  if (!slug || !outDir) throw new Error("usage: <project-slug> <out-dir>")
  mkdirSync(outDir, { recursive: true })
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  const { data: project } = await sb.from("projects").select("id, title").eq("slug", slug).single()
  if (!project) throw new Error(`project ${slug} not found`)
  // Ruimte apart: project_photos ↔ project_features heeft twee relaties
  // (feature_id en cover_photo_id), een embed is dan dubbelzinnig.
  const { data: photoRows, error: photoErr } = await sb.from("project_photos")
    .select("id, url, width, height, order_index, feature_id")
    .eq("project_id", project.id).order("order_index")
  if (photoErr) throw photoErr
  const { data: features } = await sb.from("project_features").select("id, name").eq("project_id", project.id)
  const featureName = new Map((features ?? []).map((f) => [f.id, f.name]))
  const photos = (photoRows ?? []).map((p) => ({ ...p, project_features: p.feature_id ? { name: featureName.get(p.feature_id) ?? null } : null }))

  // Productsoorten als "slug — Groep › Subgroep › Soort", zoals de pijplijn.
  const { data: cats } = await (sb as any).from("product_categories").select("id, slug, name, parent_id").eq("is_active", true)
  const byId = new Map<string, any>((cats ?? []).map((c: any) => [c.id, c]))
  const pathOf = (c: any): string => (c.parent_id && byId.get(c.parent_id) ? `${pathOf(byId.get(c.parent_id))} › ` : "") + c.name
  const menu = (cats ?? []).map((c: any) => `${c.slug} — ${pathOf(c)}`).sort().join("\n")
  const kindName = new Map<string, string>((cats ?? []).map((c: any) => [c.slug, pathOf(c)]))

  const prompt = `This is a photo from an interior or architecture project on Arco, an editorial directory of projects, professionals and design products.

Give:
- room: the room or space the photo shows, from the list.
- products: the MAIN design products visible — the pieces a visitor would want to know the brand of (a sofa, a pendant light, a dining table, a kitchen, a bathtub). At most 3, most prominent first. Skip small decoration, plants, books, built-in walls and structural elements unless they are clearly a designed product (a fireplace, a kitchen, a staircase). For each:
  - kind_slug: the most specific slug from the category list, or null if none fits;
  - label: a short name ("Pendant light");
  - box: the bounding box as fractions of the image width and height (0 = left/top, 1 = right/bottom): x0, y0, x1, y1;
  - description: a short visual description that would help find the exact product ("large white disc pendant, thin wire suspension");
  - brand_cues: any visible brand or design cue that points to a maker, or null.`

  const run = async (model: (typeof MODELS)[number], url: string) => {
    const t0 = Date.now()
    try {
      const msg = await anthropic.messages.create({
        model: model.id,
        max_tokens: 4000,
        system: [{ type: "text", text: `Product categories (slug — group › subgroup › kind):\n${menu}`, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: [{ type: "image", source: { type: "url", url } }, { type: "text", text: prompt }] }],
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      } as any)
      const text = (msg.content as any[]).find((b) => b.type === "text")?.text
      const u = msg.usage as any
      const input = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
      // Kosten zonder cachekorting: de bovengrens.
      const cost = (input * model.inPerM + (u.output_tokens ?? 0) * model.outPerM) / 1e6
      return { ok: true as const, ms: Date.now() - t0, input, output: u.output_tokens as number, cost, result: JSON.parse(text) as Detection }
    } catch (err) {
      return { ok: false as const, ms: Date.now() - t0, error: String(err) }
    }
  }

  const rows = await Promise.all((photos ?? []).map(async (p: any) => {
    const [sonnet, haiku] = await Promise.all(MODELS.map((m) => run(m, p.url)))
    return { id: p.id, url: p.url, width: p.width, height: p.height, ownerRoom: p.project_features?.name ?? null, sonnet, haiku }
  }))
  writeFileSync(join(outDir, "results.json"), JSON.stringify({ project, rows }, null, 2))

  // ── Samenvatting ────────────────────────────────────────────────────
  const summary = MODELS.map((m) => {
    const key = m.id.includes("sonnet") ? "sonnet" : "haiku"
    const runs = rows.map((r) => (r as any)[key]).filter((x: any) => x.ok)
    const roomHits = rows.filter((r) => { const x = (r as any)[key]; return x.ok && r.ownerRoom && x.result.room === r.ownerRoom }).length
    const withOwner = rows.filter((r) => r.ownerRoom && ROOMS.includes(r.ownerRoom as any)).length
    const cost = runs.reduce((s: number, x: any) => s + x.cost, 0)
    return {
      model: m.label, ok: runs.length, failed: rows.length - runs.length,
      avgMs: Math.round(runs.reduce((s: number, x: any) => s + x.ms, 0) / Math.max(1, runs.length)),
      avgIn: Math.round(runs.reduce((s: number, x: any) => s + x.input, 0) / Math.max(1, runs.length)),
      avgOut: Math.round(runs.reduce((s: number, x: any) => s + x.output, 0) / Math.max(1, runs.length)),
      cost, costPerPhoto: cost / Math.max(1, runs.length),
      roomHits, withOwner,
      products: runs.reduce((s: number, x: any) => s + x.result.products.length, 0),
    }
  })
  console.table(summary.map((s) => ({ ...s, cost: `$${s.cost.toFixed(4)}`, costPerPhoto: `$${s.costPerPhoto.toFixed(5)}` })))

  // ── Vergelijkingspagina ─────────────────────────────────────────────
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const COLORS = ["#e4572e", "#2e86ab", "#3bb273"]
  const panel = (label: string, x: any, url: string) => {
    if (!x.ok) return `<div class="panel"><h3>${label}</h3><p class="err">${esc(x.error)}</p></div>`
    const d: Detection = x.result
    const boxes = d.products.map((p, i) => {
      const b = p.box
      return `<div class="box" style="left:${b.x0 * 100}%;top:${b.y0 * 100}%;width:${(b.x1 - b.x0) * 100}%;height:${(b.y1 - b.y0) * 100}%;border-color:${COLORS[i]}"><span style="background:${COLORS[i]}">${i + 1}</span></div>`
    }).join("")
    const list = d.products.map((p, i) => `<li><b style="color:${COLORS[i]}">${i + 1}. ${esc(p.label)}</b> <code>${esc(p.kind_slug ?? "—")}</code><br><small>${esc(p.kind_slug ? kindName.get(p.kind_slug) ?? "⚠ onbekende slug" : "geen soort")}</small><br>${esc(p.description)}${p.brand_cues ? `<br><i>Merk: ${esc(p.brand_cues)}</i>` : ""}</li>`).join("")
    return `<div class="panel"><h3>${label} <small>${(x.ms / 1000).toFixed(1)}s · ${x.input}/${x.output} tokens · $${x.cost.toFixed(4)}</small></h3>
      <div class="img"><img src="${esc(url)}" alt="">${boxes}</div>
      <p class="room">Ruimte: <b>${esc(d.room)}</b></p><ol>${list}</ol></div>`
  }
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Productherkenning ${esc(project.title)}</title>
<style>
body{font:14px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:24px;background:#f6f5f3;color:#1c1c1a}
h1{font-weight:500;margin:0 0 4px} table{border-collapse:collapse;margin:16px 0 32px;background:#fff}
td,th{padding:6px 12px;border:1px solid #e5e4e1;text-align:left;font-variant-numeric:tabular-nums}
.photo{background:#fff;border:1px solid #e5e4e1;padding:16px;margin-bottom:24px}
.photo>h2{font-size:14px;font-weight:500;margin:0 0 12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.panel h3{font-size:14px;font-weight:600;margin:0 0 8px}.panel h3 small{font-weight:400;color:#6b6b68}
.img{position:relative;line-height:0}.img img{width:100%;height:auto}
.box{position:absolute;border:2px solid;box-sizing:border-box}
.box span{position:absolute;left:-2px;top:-2px;color:#fff;font:600 11px/16px system-ui;padding:0 5px}
.room{margin:8px 0 4px} ol{padding-left:18px;margin:0} li{margin-bottom:6px} code{font-size:12px;background:#f0efed;padding:1px 4px}
.hit{color:#3bb273}.miss{color:#e4572e}.err{color:#e4572e}
@media(max-width:800px){.grid{grid-template-columns:1fr}}
</style></head><body>
<h1>Productherkenning — ${esc(project.title)}</h1>
<p>${rows.length} foto's, Sonnet 5.5 en Haiku 5.5 met dezelfde vraag. Kosten direct (zonder cachekorting); via de Batch API de helft.</p>
<table><tr><th>Model</th><th>Gelukt</th><th>Gem. tijd</th><th>Gem. tokens in/uit</th><th>Kosten totaal</th><th>Per foto (direct / batch)</th><th>Ruimte = eigenaar</th><th>Producten</th></tr>
${summary.map((s) => `<tr><td>${s.model}</td><td>${s.ok}/${s.ok + s.failed}</td><td>${(s.avgMs / 1000).toFixed(1)}s</td><td>${s.avgIn} / ${s.avgOut}</td><td>$${s.cost.toFixed(4)}</td><td>$${s.costPerPhoto.toFixed(5)} / $${(s.costPerPhoto / 2).toFixed(5)}</td><td>${s.roomHits}/${s.withOwner}</td><td>${s.products}</td></tr>`).join("")}
</table>
${rows.map((r, i) => `<div class="photo"><h2>Foto ${i + 1} · eigenaar: ${esc(r.ownerRoom ?? "—")} ${(["sonnet", "haiku"] as const).map((k) => { const x = (r as any)[k]; return x.ok ? `· ${k === "sonnet" ? "Sonnet" : "Haiku"}: <span class="${x.result.room === r.ownerRoom ? "hit" : "miss"}">${esc(x.result.room)}</span>` : "" }).join(" ")}</h2>
<div class="grid">${panel("Sonnet 5.5", r.sonnet, r.url)}${panel("Haiku 5.5", r.haiku, r.url)}</div></div>`).join("")}
</body></html>`
  writeFileSync(join(outDir, "vergelijking.html"), html)
  console.log(`\n${join(outDir, "vergelijking.html")}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
