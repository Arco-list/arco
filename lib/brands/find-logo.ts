import "server-only"

import { JSDOM, VirtualConsole } from "jsdom"

import { absoluteHttpUrl } from "@/lib/collections/shared"

/**
 * Logokandidaten van de website van een merk, de beste eerst. Gratis: één
 * verzoek naar de homepage. Niet van LinkedIn of Instagram — die tonen
 * profielen alleen na inloggen, weren bots, verbieden scrapen en geven
 * een klein vierkant.
 *
 *   header  het logo in de kop van de site (img of inline SVG met "logo"
 *           in klasse, id, alt, naam of link naar de homepage) — meestal de
 *           scherpste versie
 *   schema  het logo uit de gestructureerde data (schema.org Organization)
 *   icon    het app-icoon (apple-touch-icon, groot favicon) — vierkant,
 *           past vaak precies in een ronde disc
 */

export type LogoCandidate = {
  kind: "header" | "schema" | "icon"
  label: string
  /** Adres van het beeld, of null bij een inline SVG. */
  url: string | null
  /** De SVG-code van een inline logo. */
  svg: string | null
}

const USER_AGENTS = [
  "ArcoBot/1.0 (+https://www.arcolist.com)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
]
const LOGO_WORD = /logo|brand|wordmark|site-title|navbar-brand/i

async function fetchHtml(url: string): Promise<{ html: string; url: string } | null> {
  for (const ua of USER_AGENTS) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": ua, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(20000), cache: "no-store" })
      if (res.ok && (res.headers.get("content-type") ?? "").includes("html")) return { html: await res.text(), url: res.url || url }
    } catch {
      // volgende identificatie
    }
  }
  return null
}

function largestFromSrcset(srcset: string | null): string | null {
  if (!srcset) return null
  let best: { url: string; w: number } | null = null
  for (const part of srcset.split(",")) {
    const [u, size] = part.trim().split(/\s+/)
    if (!u) continue
    const w = size ? parseFloat(size) * (size.endsWith("x") ? 1000 : 1) : 0
    if (!best || w >= best.w) best = { url: u, w }
  }
  return best?.url ?? null
}

const imgSrc = (el: Element) =>
  largestFromSrcset(el.getAttribute("srcset") ?? el.getAttribute("data-srcset"))
  ?? el.getAttribute("data-src") ?? el.getAttribute("src")

/** Een inline SVG als zelfstandig bestand: met namespace, zonder scripts. */
function standaloneSvg(svg: Element): string | null {
  const clone = svg.cloneNode(true) as Element
  clone.querySelectorAll("script, foreignObject").forEach((n) => n.remove())
  for (const el of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
    // Niets uitvoerbaars: de SVG wordt vanaf onze eigen opslag geserveerd.
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name) || /^\s*(javascript|data):/i.test(attr.value)) el.removeAttribute(attr.name)
    }
  }
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  // Een logo met <use href="#…"> naar een symbool elders op de pagina valt niet los te halen.
  if (clone.querySelector("use")) return null
  const markup = clone.outerHTML
  return markup.length > 200 && markup.length < 200_000 ? markup : null
}

export async function findLogoCandidates(website: string): Promise<LogoCandidate[]> {
  const page = await fetchHtml(website)
  if (!page) return []
  // Stil: jsdom meldt anders elke CSS-regel die het niet begrijpt.
  const doc = new JSDOM(page.html, { virtualConsole: new VirtualConsole() }).window.document
  const base = page.url
  const origin = (() => { try { return new URL(base).origin } catch { return base } })()
  const out: LogoCandidate[] = []
  const seen = new Set<string>()
  const addUrl = (kind: LogoCandidate["kind"], label: string, raw: string | null) => {
    const u = absoluteHttpUrl(raw, base)
    if (!u || seen.has(u) || u.startsWith("data:")) return
    seen.add(u)
    out.push({ kind, label, url: u, svg: null })
  }

  // 1. Header: een element met "logo" in klasse/id/alt/naam, of de link naar
  //    de homepage bovenaan, met daarin een img of inline SVG.
  const scope = doc.querySelector("header") ?? doc.body
  const marked = Array.from(scope?.querySelectorAll("img, svg, a, div, span") ?? []).filter((el) => {
    const s = [el.getAttribute("class"), el.id, el.getAttribute("alt"), el.getAttribute("aria-label"), el.getAttribute("src"), el.getAttribute("title")].join(" ")
    return LOGO_WORD.test(s)
  })
  const homeLinks = Array.from(scope?.querySelectorAll("a[href]") ?? []).filter((a) => {
    try { const u = new URL(a.getAttribute("href")!, base); return u.origin === origin && (u.pathname === "/" || /^\/[a-z]{2}\/?$/i.test(u.pathname)) } catch { return false }
  }).slice(0, 3)
  for (const el of [...marked, ...homeLinks].slice(0, 20)) {
    const tag = el.tagName.toLowerCase()
    const imgs = tag === "img" ? [el] : Array.from(el.querySelectorAll("img"))
    for (const img of imgs.slice(0, 2)) addUrl("header", "Site header", imgSrc(img))
    const svgs = tag === "svg" ? [el] : Array.from(el.querySelectorAll("svg"))
    for (const svg of svgs.slice(0, 1)) {
      const markup = standaloneSvg(svg)
      if (markup && !seen.has(markup)) { seen.add(markup); out.push({ kind: "header", label: "Site header (SVG)", url: null, svg: markup }) }
    }
    if (out.filter((c) => c.kind === "header").length >= 3) break
  }

  // 2. Gestructureerde data: schema.org Organization.logo.
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const data = JSON.parse(script.textContent ?? "")
      const nodes: any[] = Array.isArray(data) ? data : data?.["@graph"] ?? [data]
      for (const n of nodes) {
        const logo = n?.logo
        const url = typeof logo === "string" ? logo : logo?.url ?? logo?.contentUrl
        if (url) addUrl("schema", "Structured data", url)
      }
    } catch {
      // ongeldige JSON-LD
    }
  }

  // 3. App-icoon: apple-touch-icon, anders het grootste favicon (≥ 96 px of SVG).
  const icons = Array.from(doc.querySelectorAll('link[rel~="apple-touch-icon"], link[rel~="icon"], link[rel="apple-touch-icon-precomposed"]'))
    .map((l) => {
      const sizes = l.getAttribute("sizes") ?? ""
      const px = Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10)).filter((n) => !isNaN(n)))
      const href = l.getAttribute("href")
      const svg = /\.svg(\?|$)/i.test(href ?? "") || l.getAttribute("type") === "image/svg+xml"
      const apple = /apple/i.test(l.getAttribute("rel") ?? "")
      return { href, score: apple ? 1000 + px : svg ? 900 : px }
    })
    .filter((i) => i.href && i.score >= 96)
    .sort((a, b) => b.score - a.score)
  for (const i of icons.slice(0, 2)) addUrl("icon", "App icon", i.href)
  if (!icons.length) addUrl("icon", "App icon", `${origin}/apple-touch-icon.png`)

  return out.slice(0, 6)
}
