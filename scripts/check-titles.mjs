#!/usr/bin/env node
/**
 * Elke publieke pagina hoort een eigen <title> te hebben.
 *
 * app/layout.tsx zet een title.default. Een pagina zonder eigen titel
 * erft die stilzwijgend — geen fout, geen waarschuwing. Zo voerden
 * /about, /businesses/architects en /homeowner dezelfde titel als
 * arcolist.com zelf, en concurreerden ze met de enige zoekopdracht die
 * we betrouwbaar winnen. Sinds de homepage zijn eigen titel heeft is het
 * een graad erger: wie de default erft, voert nu een Engelse regel die
 * geen enkele pagina meer bewust draagt.
 *
 * Deze controle leest geen HTML maar de broncode: staat er een `title`
 * binnen metadata of generateMetadata? Grover dan renderen, maar het
 * draait in een seconde en vangt precies het geval dat stil is.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"

const ROOT = "app/[locale]"

/** Achter een login of op noindex — die staan niet in zoekresultaten. */
const SKIP = /^(admin|dashboard|components|styles|claim|login|signup|reset-password|update-password|create-company|new-project|auth|invite)$/

/** De homepage is de enige pagina die de layout-default TERECHT voert:
 *  daar is Arco het onderwerp. Elke andere pagina die hem erft, erft de
 *  titel van de homepage en concurreert ermee. */
const ALLOWED_DEFAULT = new Set(["app/[locale]/page.tsx"])

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return SKIP.test(name) ? [] : walk(full)
    return name === "page.tsx" ? [full] : []
  })

/**
 * Zet dit blok een titel?
 *
 * Drie vormen tellen mee. `title: x` is de gewone. De verkorte notatie
 * `{ title, description }` gebruiken de project- en bedrijfspagina's,
 * die hun titel eerst in een variabele bouwen. En een SPREAD uit een
 * helper — `...arcoPageMeta("/about", locale)` — levert hem net zo
 * goed; die vorm bestaat juist omdat de negen Arco-pagina's hun titel
 * uit één bestand horen te halen in plaats van negen keer apart. Een
 * helper kan ook het hele object zijn — `return arcoPageMeta(...)` —
 * en dat telt om dezelfde reden mee.
 *
 * Een spread die GEEN titel bevat glipt hiermee door de controle. Dat
 * is bewust: deze controle vangt de pagina die niets zet, niet de
 * helper die iets verkeerds teruggeeft. Dat laatste is een typefout en
 * geen stille erfenis.
 */
const hasTitleInBlock = (block) =>
  /\btitle\s*[:,]|\btitle\s*\}/.test(block)
  || /\.\.\.\w+\s*\(/.test(block)
  || /return\s+\w+\s*\(/.test(block)

/** Dezelfde vraag voor een heel bestand, voor layout.tsx ernaast. */
const hasTitle = (src) =>
  /export (async function generateMetadata|const metadata)/.test(src) && hasTitleInBlock(src)

const pages = walk(ROOT).filter((f) => !ALLOWED_DEFAULT.has(f))
const missing = []

for (const file of pages) {
  const src = readFileSync(file, "utf8")

  // Een clientcomponent kan geen metadata exporteren, dus mag een
  // layout.tsx ernaast het doen — zo doet /homeowner het. Die layout
  // geldt voor elke route eronder, dus als hij een titel zet is de
  // pagina gedekt.
  const layout = join(dirname(file), "layout.tsx")
  if (existsSync(layout) && hasTitle(readFileSync(layout, "utf8"))) continue

  // Een route die alleen redirect rendert nooit en heeft geen titel nodig.
  const hasMeta = /export (async function generateMetadata|const metadata)/.test(src)
  if (!hasMeta && /\bredirect\s*\(/.test(src)) continue
  if (!hasMeta) {
    missing.push({ file, reden: "geen metadata" })
    continue
  }

  // Alleen BINNEN het metadatablok zoeken, niet in het hele bestand:
  // /about heeft `title: ""` in een cover-object en kwam zo door de
  // controle heen terwijl zijn metadata alleen alternates teruggaf.
  //
  // Afbakenen op de VOLGENDE top-level declaratie, niet op accolades —
  // generateMetadata({ params }: { params: ... }) heeft accolades in
  // zijn parameterlijst, en een teller sloot het blok daar al af.
  const start = src.search(/export (async function generateMetadata|const metadata)/)
  const rest = src.slice(start + 1)
  const next = rest.search(/\n(export|async function|function|const|type|interface)\s/)
  const block = next < 0 ? src.slice(start) : src.slice(start, start + 1 + next)

  if (!hasTitleInBlock(block)) {
    missing.push({ file, reden: "metadata zonder title" })
  }
}

if (missing.length === 0) {
  console.log(`✓ ${pages.length} pagina's, allemaal met een eigen titel`)
  process.exit(0)
}

console.error(`\n✗ ${missing.length} van ${pages.length} pagina's erven de titel van de layout:\n`)
for (const m of missing) console.error(`   ${m.file.padEnd(48)} ${m.reden}`)
console.error("\n   app/layout.tsx zet een title.default; zonder eigen titel voert de")
console.error("   pagina die Engelse standaardregel, die geen pagina meer bewust draagt.\n")
process.exit(1)
