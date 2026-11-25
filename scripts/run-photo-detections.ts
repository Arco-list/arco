/**
 * Productherkenning lokaal: projecten in de wachtrij zetten en/of een
 * ronde draaien (zoals de cron, lib/recognition/photo-detections).
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/run-photo-detections.ts [--queue slug,slug] [--force] [--index] [--tick]
 *
 * --index: alle catalogusbeelden zonder vector indexeren (Voyage).
 * --retry-failed: eerder mislukte catalogusbeelden nog eens proberen.
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
for (const k of ["ANTHROPIC_API_KEY", "VOYAGE_API_KEY"]) if (env[k] && !process.env[k]) process.env[k] = env[k]

async function main() {
  const { queueProjectPhotos, tickPhotoDetections } = await import("../lib/recognition/photo-detections")
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) as any
  const args = process.argv.slice(2)
  const qi = args.indexOf("--queue")
  if (qi >= 0) {
    for (const slug of (args[qi + 1] ?? "").split(",").filter(Boolean)) {
      const { data: p } = await sb.from("projects").select("id, title").eq("slug", slug).maybeSingle()
      if (!p) { console.log(`– ${slug}: niet gevonden`); continue }
      console.log(`${p.title}: ${await queueProjectPhotos(sb, p.id, { force: args.includes("--force") })} foto's in de wachtrij`)
    }
  }
  if (args.includes("--retry-failed")) {
    // Eén ronde over alle eerder mislukte beelden (wat weer mislukt, blijft staan).
    const { indexCatalogImages } = await import("../lib/recognition/embeddings")
    const r = await indexCatalogImages(sb, { limit: 100_000, retryFailed: true })
    console.log(`opnieuw: geïndexeerd ${r.indexed}, niet te lezen ${r.skipped}`)
  }
  if (args.includes("--index")) {
    const { indexCatalogImages } = await import("../lib/recognition/embeddings")
    for (;;) {
      const r = await indexCatalogImages(sb, { limit: 160 })
      console.log(`geïndexeerd ${r.indexed}, niet te lezen ${r.skipped}, nog ${r.remaining}`)
      if (r.remaining <= 0 || r.indexed + r.skipped === 0) break
    }
  }
  if (args.includes("--tick")) console.log(JSON.stringify(await tickPhotoDetections(sb)))
}
main().catch((e) => { console.error(e); process.exit(1) })
