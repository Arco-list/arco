/**
 * Productherkenning meten op de vaste testset (migratie 336).
 *
 * De meetlat: beoordeelde producten in de testset-projecten. Goedgekeurd =
 * dit hoort het voorstel te zijn; "klopt niet" of "staat er niet tussen" =
 * er hoort géén voorstel te komen. Verborgen en onbeoordeelde producten tellen
 * niet mee.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/eval-recognition.ts <opdracht> [opties]
 *
 * Opdrachten:
 *   --list                     testset en beoordeelde producten per project
 *   --add slug[,slug]          projecten aan de testset toevoegen  (--project-note "…")
 *   --remove slug[,slug]       projecten uit de testset halen
 *   --retrieval                zoeken op beeld meten (gratis: geen Claude)
 *                              + de opgeslagen voorstellen tegen de meetlat
 *   --judge                    het hele koppelen opnieuw, met Claude (kost
 *                              geld: vraagt bevestiging, of --yes)
 *
 * Varianten (voor --retrieval en --judge): --candidates 8 --boost 0.04
 * --search 30 --model claude-sonnet-5-5 --limit N (alleen de eerste N
 * producten) --note "wat je test". Elke meting komt in recognition_eval_runs.
 */
import { readFileSync } from "node:fs"
import { createInterface } from "node:readline/promises"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
for (const k of ["ANTHROPIC_API_KEY", "VOYAGE_API_KEY"]) if (env[k] && !process.env[k]) process.env[k] = env[k]

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
const pct = (n: number, d: number) => d ? `${Math.round((n / d) * 100)}%` : "–"

type Truth = { kind: "match"; level: "product" | "collection" | "brand"; brandId: string; collectionId: string | null; productId: string | null } | { kind: "none" }
type Item = {
  id: string; projectId: string; photoId: string; categoryId: string | null; kindSlug: string | null
  label: string; description: string | null; brandCues: string | null
  box: { x0: number; y0: number; x1: number; y1: number }; embedding: string | null
  truth: Truth; truthName: string
  stored: { brandId: string; collectionId: string | null; productId: string | null; level: string; confidence: string | null } | null
}

/** Klopt een voorstel met de meetlat? Op merkniveau telt het merk, anders de collectie (of het product zonder collectie). */
function verdict(truth: Truth, s: { brandId: string; collectionId: string | null; productId: string | null; level: string } | null): "correct" | "partial" | "wrong" | "missed" | "correct_none" | "false_positive" {
  if (truth.kind === "none") return s ? "false_positive" : "correct_none"
  if (!s) return "missed"
  if (truth.level === "brand") return s.brandId === truth.brandId ? "correct" : "wrong"
  const same = truth.collectionId ? s.collectionId === truth.collectionId : s.productId === truth.productId
  if (same && s.level !== "brand") return "correct"
  return s.brandId === truth.brandId ? "partial" : "wrong"
}

function summarize(verdicts: Array<{ v: ReturnType<typeof verdict>; confidence?: string | null }>) {
  const count = (k: string) => verdicts.filter((x) => x.v === k).length
  const correct = count("correct"), partial = count("partial"), wrong = count("wrong"), missed = count("missed"), none = count("correct_none"), fp = count("false_positive")
  const proposed = correct + partial + wrong + fp
  const targets = correct + partial + wrong + missed
  const byConf: Record<string, string> = {}
  for (const c of ["high", "medium", "low"]) {
    const xs = verdicts.filter((x) => x.confidence === c && ["correct", "partial", "wrong", "false_positive"].includes(x.v))
    if (xs.length) byConf[c] = `${xs.filter((x) => x.v === "correct").length}/${xs.length} goed`
  }
  return {
    products: verdicts.length, correct, partial, wrong, missed, correctNone: none, falsePositive: fp,
    precision: pct(correct, proposed), coverage: pct(correct, targets), byConfidence: byConf,
  }
}

async function main() {
  const { MATCH_CONFIG } = await import("../lib/recognition/config")
  const m = await import("../lib/recognition/matching")
  const { prepareImage, embedImages, toVector } = await import("../lib/recognition/embeddings")
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) as any

  // ── Testset beheren ──
  const slugsOf = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  for (const [cmd, add] of [["add", true], ["remove", false]] as const) {
    for (const slug of slugsOf(opt(cmd))) {
      const { data: p } = await sb.from("projects").select("id, title").eq("slug", slug).maybeSingle()
      if (!p) { console.log(`– ${slug}: niet gevonden`); continue }
      if (add) await sb.from("recognition_eval_projects").upsert({ project_id: p.id, note: opt("project-note") ?? null })
      else await sb.from("recognition_eval_projects").delete().eq("project_id", p.id)
      console.log(`${add ? "+" : "–"} ${p.title}`)
    }
  }

  // ── De meetlat ophalen ──
  const { data: setRows } = await sb.from("recognition_eval_projects").select("project_id, note, projects(title, slug)")
  const projectIds = ((setRows ?? []) as any[]).map((r) => r.project_id)
  if (projectIds.length === 0) { console.log("De testset is leeg. Voeg projecten toe met --add slug."); return }
  const { data: dets } = await sb.from("project_photo_detections")
    .select("id, project_id, photo_id, category_id, kind_slug, label, description, brand_cues, box_x0, box_y0, box_x1, box_y1, embedding, review_status")
    .in("project_id", projectIds).in("review_status", ["approved", "rejected", "missing"]).order("project_id").order("photo_id").order("rank")
  const detRows = (dets ?? []) as any[]
  const ids = detRows.map((d) => d.id)
  const matchRows: any[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await sb.from("project_photo_detection_matches")
      .select("detection_id, status, source, level, confidence, reason, brand_id, collection_id, product_id, brands(name), product_collections(name), products(name)")
      .in("detection_id", ids.slice(i, i + 100))
    matchRows.push(...(data ?? []))
  }
  const items: Item[] = detRows.map((d) => {
    const ms = matchRows.filter((x) => x.detection_id === d.id)
    const ok = ms.find((x) => x.status === "approved")
    // Het oorspronkelijke voorstel van Claude: de AI-rij met een reden.
    const ai = ms.find((x) => x.source === "ai" && x.reason && x.level)
    const truth: Truth = d.review_status === "approved" && ok
      ? { kind: "match", level: ok.level ?? "collection", brandId: ok.brand_id, collectionId: ok.collection_id, productId: ok.product_id }
      : { kind: "none" }
    return {
      id: d.id, projectId: d.project_id, photoId: d.photo_id, categoryId: d.category_id, kindSlug: d.kind_slug,
      label: d.label, description: d.description, brandCues: d.brand_cues,
      box: { x0: d.box_x0, y0: d.box_y0, x1: d.box_x1, y1: d.box_y1 }, embedding: d.embedding ?? null,
      truth, truthName: ok ? [ok.brands?.name, ok.level === "brand" ? null : ok.product_collections?.name ?? ok.products?.name].filter(Boolean).join(" · ") : `(geen: ${d.review_status})`,
      stored: ai ? { brandId: ai.brand_id, collectionId: ai.collection_id, productId: ai.product_id, level: ai.level, confidence: ai.confidence } : null,
    }
  })

  if (flag("list")) {
    for (const r of (setRows ?? []) as any[]) {
      const xs = items.filter((x) => x.projectId === r.project_id)
      console.log(`${r.projects?.title} (${r.projects?.slug}): ${xs.length} beoordeeld · ${xs.filter((x) => x.truth.kind === "match").length} met product${r.note ? ` · ${r.note}` : ""}`)
    }
  }
  if (!flag("retrieval") && !flag("judge")) return

  const limit = opt("limit") ? Number(opt("limit")) : items.length
  const todo = items.slice(0, limit)
  const cfg = {
    ...MATCH_CONFIG,
    ...(opt("candidates") ? { candidates: Number(opt("candidates")) } : {}),
    ...(opt("boost") ? { projectBrandBoost: Number(opt("boost")) } : {}),
    ...(opt("search") ? { searchCount: Number(opt("search")) } : {}),
    ...(opt("model") ? { judgeModel: opt("model")! } : {}),
  }
  console.log(`\nTestset: ${projectIds.length} projecten, ${todo.length} beoordeelde producten (${todo.filter((x) => x.truth.kind === "match").length} met product, ${todo.filter((x) => x.truth.kind === "none").length} zonder)`)
  console.log(`Instellingen: ${JSON.stringify(cfg)}`)

  // Vectoren: opgeslagen, anders nu maken (zelf toegevoegde stippen).
  const ctx = await m.loadMatchContext(sb, projectIds)
  const { data: photos } = await sb.from("project_photos").select("id, url").in("id", Array.from(new Set(todo.map((x) => x.photoId))))
  const photoUrl = new Map(((photos ?? []) as any[]).map((p) => [p.id, p.url as string]))
  const crops = new Map<string, string>()
  const needCrop = flag("judge") ? todo : todo.filter((x) => !x.embedding)
  for (let i = 0; i < needCrop.length; i += 8) {
    await Promise.all(needCrop.slice(i, i + 8).map(async (x) => {
      const url = photoUrl.get(x.photoId)
      const c = url ? await prepareImage(url, { crop: x.box, maxSide: 768 }) : null
      if (c) crops.set(x.id, c.dataUrl)
    }))
  }
  const missingVec = todo.filter((x) => !x.embedding && crops.has(x.id))
  if (missingVec.length) {
    const vs = await embedImages(missingVec.map((x) => crops.get(x.id)!))
    missingVec.forEach((x, i) => { if (vs[i]) x.embedding = toVector(vs[i]!) })
  }

  // ── Zoeken op beeld: hoe diep staat het juiste? ──
  const DEPTH = 50
  const retrieval: Array<{ id: string; kind: string | null; rank: number | null; truth: string }> = []
  const tops = new Map<string, Awaited<ReturnType<typeof m.searchCandidates>>>()
  for (const x of todo) {
    if (!x.embedding) continue
    const deep = await m.searchCandidates(sb, x.embedding, { category_id: x.categoryId, project_id: x.projectId }, ctx, cfg, DEPTH)
    tops.set(x.id, deep.slice(0, cfg.candidates))
    if (x.truth.kind !== "match") continue
    const t = x.truth
    const idx = deep.findIndex((c) => t.level === "brand" ? c.brand_id === t.brandId : t.collectionId ? c.collection_id === t.collectionId : c.product_id === t.productId)
    retrieval.push({ id: x.id, kind: x.kindSlug, rank: idx >= 0 ? idx + 1 : null, truth: x.truthName })
  }
  const within = (k: number) => retrieval.filter((r) => r.rank != null && r.rank <= k).length
  const retrievalMetrics = {
    targets: retrieval.length,
    [`top1`]: pct(within(1), retrieval.length),
    [`top3`]: pct(within(3), retrieval.length),
    [`top${cfg.candidates} (wat Claude ziet)`]: pct(within(cfg.candidates), retrieval.length),
    [`top${DEPTH}`]: pct(within(DEPTH), retrieval.length),
    notFound: retrieval.filter((r) => r.rank == null).map((r) => `${r.truth} (${r.kind})`),
  }
  const storedMetrics = summarize(todo.map((x) => ({ v: verdict(x.truth, x.stored), confidence: x.stored?.confidence })))
  console.log("\nZoeken op beeld — staat het juiste product/collectie tussen de kandidaten?")
  console.log(retrievalMetrics)
  console.log("\nOpgeslagen voorstellen (zoals ze in productie zijn gedaan) tegen de meetlat:")
  console.log(storedMetrics)

  if (flag("retrieval")) {
    const { error } = await sb.from("recognition_eval_runs").insert({ mode: "retrieval", config: { ...cfg, embeddingModel: m.matchPipeline(cfg).embeddingModel }, metrics: { retrieval: retrievalMetrics, stored: storedMetrics }, details: retrieval, note: opt("note") ?? null })
    if (error) console.error("Meting niet opgeslagen:", error.message)
  }

  // ── Het hele koppelen opnieuw, met Claude ──
  if (!flag("judge")) return
  const judgeable = todo.filter((x) => crops.has(x.id) && (tops.get(x.id)?.length ?? 0) > 0)
  console.log(`\n--judge: ${judgeable.length} verzoeken aan ${cfg.judgeModel} (direct, niet via batch).`)
  if (!flag("yes")) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await rl.question("Doorgaan? (j/n) ")
    rl.close()
    if (!/^j/i.test(answer.trim())) return
  }
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const allTop = judgeable.flatMap((x) => tops.get(x.id)!)
  const names = await m.nameLookup(sb, {
    brandIds: [...allTop.map((c) => c.brand_id), ...Array.from(ctx.projectBrands.values()).flatMap((s) => Array.from(s))],
    collectionIds: allTop.map((c) => c.collection_id), productIds: allTop.map((c) => c.product_id),
  })
  const images = await m.fetchCandidateImages(allTop.map((c) => c.image_url))
  const judged: Array<{ id: string; truth: string; v: ReturnType<typeof verdict>; confidence: string | null; suggestion: string | null; reason: string }> = []
  let done = 0
  const queue = [...judgeable]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let x = queue.shift(); x; x = queue.shift()) {
      const top = tops.get(x.id)!
      const params = m.buildJudgeParams({
        d: { id: x.id, project_id: x.projectId, category_id: x.categoryId ?? "", label: x.label, description: x.description, brand_cues: x.brandCues },
        cropBase64: crops.get(x.id)!.split(",")[1], top, names, images,
        projectBrandNames: Array.from(ctx.projectBrands.get(x.projectId) ?? []).map((id) => names.brand(id)).filter(Boolean),
      }, cfg)
      try {
        const msg = await client.messages.create(params as any)
        const j = m.parseJudgement(msg.content as any, top)
        const c = j.match != null && j.level ? top[j.match - 1] : null
        const s = c ? { brandId: c.brand_id, collectionId: c.collection_id, productId: c.product_id, level: j.level! } : null
        judged.push({ id: x.id, truth: x.truthName, v: verdict(x.truth, s), confidence: s ? j.confidence : null, suggestion: c ? names.describe(c.brand_id, c.collection_id, c.product_id) : null, reason: j.reason })
      } catch (err) {
        console.error(`  ${x.id}: ${String(err).slice(0, 160)}`)
      }
      process.stdout.write(`\r  ${++done}/${judgeable.length}`)
    }
  }))
  const judgeMetrics = summarize(judged)
  console.log("\n\nOpnieuw gekoppeld met deze instellingen, tegen de meetlat:")
  console.log(judgeMetrics)
  for (const j of judged.filter((x) => x.v === "wrong" || x.v === "false_positive" || x.v === "partial")) {
    console.log(`  ${j.v.padEnd(14)} meetlat: ${j.truth}  ·  voorstel: ${j.suggestion}  ·  ${j.reason}`)
  }
  const { error } = await sb.from("recognition_eval_runs").insert({ mode: "judge", config: m.matchPipeline(cfg), metrics: { retrieval: retrievalMetrics, stored: storedMetrics, judge: judgeMetrics }, details: judged, note: opt("note") ?? null })
  if (error) console.error("Meting niet opgeslagen:", error.message)
}

main().catch((e) => { console.error(e); process.exit(1) })
