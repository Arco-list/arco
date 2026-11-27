import "server-only"

import { JSDOM, VirtualConsole } from "jsdom"
import { Firecrawl } from "@mendable/firecrawl-js"

import { logger } from "@/lib/logger"
import { absoluteHttpUrl } from "@/lib/collections/shared"

/**
 * Een pagina van een merk lezen voor Claude: tekst met links en beelden
 * (markdown-achtig) plus de lijst met beeldadressen.
 *
 * Eerst een gewoon verzoek: de meeste merksites (WordPress, Shopify,
 * Italiaanse meubelsites) sturen hun inhoud als HTML mee, en dat kost
 * niets. Alleen als dat niets bruikbaars oplevert — een site die zijn
 * inhoud pas in de browser opbouwt, een botblokkade, een fout — gaat de
 * pagina via Firecrawl (1 credit), dat de pagina rendert.
 */

export type FetchedPage = {
  url: string
  /** Tekst met [links](...) en ![beelden](...), afgekapt op maxChars. */
  text: string
  images: string[]
  links: string[]
  via: "fetch" | "firecrawl"
}

// Eerst eerlijk wie we zijn: sommige sites (Penta) breken de verbinding af
// als een verzoek zich als Chrome voordoet maar niet als Chrome praat.
// Daarna pas de browservariant, voor sites die bots zonder browsernaam weren.
// Penta weert zelfs "Mozilla/5.0 (compatible; …)", maar laat een kale
// botnaam door.
const USER_AGENTS = [
  "ArcoBot/1.0 (+https://www.arcolist.com)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
]
const BLOCKED = /just a moment|attention required|access denied|security checkpoint|captcha|are you a robot|cf-chl|ddos protection/i
// NOSCRIPT niet overslaan: Shopify en lazy-load-thema's zetten daar het
// echte beeld in.
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "SVG", "IFRAME", "TEMPLATE", "CANVAS", "FORM", "SELECT", "BUTTON"])
const BLOCK_TAGS = new Set(["P", "DIV", "SECTION", "ARTICLE", "LI", "UL", "OL", "TR", "TABLE", "HEADER", "FOOTER", "NAV", "MAIN", "ASIDE", "FIGURE", "H1", "H2", "H3", "H4", "H5", "H6", "BR"])

/** Het grootste beeld uit een srcset ("a.jpg 400w, b.jpg 1200w"). */
function largestFromSrcset(srcset: string | null): string | null {
  if (!srcset) return null
  let best: { url: string; w: number } | null = null
  for (const part of srcset.split(",")) {
    const [url, size] = part.trim().split(/\s+/)
    if (!url) continue
    const w = size ? parseFloat(size) * (size.endsWith("x") ? 1000 : 1) : 0
    if (!best || w >= best.w) best = { url, w }
  }
  return best?.url ?? null
}

function imageSrc(el: Element): string | null {
  const attr = (n: string) => el.getAttribute(n)
  return largestFromSrcset(attr("data-srcset") ?? attr("srcset"))
    ?? attr("data-src") ?? attr("data-lazy-src") ?? attr("data-original") ?? attr("src")
}

/** Zichtbare tekst van een element: zonder SVG, style en script daarbinnen. */
function visibleText(el: Element): string {
  let out = ""
  const walk = (n: Node) => {
    if (n.nodeType === 3) { out += n.textContent ?? ""; return }
    if (n.nodeType !== 1) return
    if (SKIP_TAGS.has((n as Element).tagName.toUpperCase())) return
    n.childNodes.forEach(walk)
  }
  walk(el)
  return out.replace(/\s+/g, " ").trim()
}

/** HTML naar tekst met links en beelden, zoals Firecrawl's markdown ongeveer. */
export function htmlToPageText(html: string, pageUrl: string, maxChars: number): { text: string; images: string[]; links: string[]; title: string } {
  // Stil: jsdom meldt anders elke CSS-regel die het niet begrijpt.
  const dom = new JSDOM(html, { virtualConsole: new VirtualConsole() })
  const doc = dom.window.document
  const images: string[] = []
  const links: string[] = []
  const seenImg = new Set<string>()
  const seenLink = new Set<string>()
  const addImage = (raw: string | null) => {
    // Shopify-sjablonen ("…_{width}x.jpg") invullen.
    const filled = raw?.replace(/\{width\}/g, "1200").replace(/\{height\}/g, "")
    const u = absoluteHttpUrl(filled, pageUrl)
    if (!u || seenImg.has(u) || /\.svg(\?|$)/i.test(u) || u.startsWith("data:")) return null
    seenImg.add(u)
    images.push(u)
    return u
  }
  // Het deelbeeld van de pagina telt ook mee (vaak een sfeerbeeld).
  addImage(doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null)

  const out: string[] = []
  let size = 0
  const push = (s: string) => { if (size < maxChars) { out.push(s); size += s.length } }

  const walk = (node: Node) => {
    if (size >= maxChars) return
    if (node.nodeType === 3) {
      const t = (node.textContent ?? "").replace(/\s+/g, " ")
      if (t.trim()) push(t)
      return
    }
    if (node.nodeType !== 1) return
    const el = node as Element
    const tag = el.tagName.toUpperCase()
    if (SKIP_TAGS.has(tag)) return
    // Beelden als CSS-achtergrond (WordPress-thema's, Penta): op hun plek in de tekst.
    const style = el.getAttribute("style")
    if (style && style.includes("url(")) {
      for (const m of style.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        const u = addImage(m[1])
        if (u) push(` ![](${u}) `)
      }
    }
    if (tag === "IMG" || tag === "SOURCE") {
      const u = addImage(imageSrc(el))
      if (u && tag === "IMG") push(` ![${(el.getAttribute("alt") ?? "").trim()}](${u}) `)
      return
    }
    if (tag === "A") {
      const href = absoluteHttpUrl(el.getAttribute("href"), pageUrl)
      const inner = visibleText(el)
      if (href && !seenLink.has(href)) { seenLink.add(href); links.push(href) }
      // Beelden in een link (een productkaart) ook meenemen: <img> en
      // CSS-achtergronden, zowel op de link zelf als daarbinnen. (Niet met
      // [style*="url("]: jsdom's selector struikelt over de haakjes.)
      el.querySelectorAll("img, source").forEach((img) => { const u = addImage(imageSrc(img)); if (u && img.tagName === "IMG") push(` ![${(img.getAttribute("alt") ?? "").trim()}](${u}) `) })
      ;[el, ...Array.from(el.querySelectorAll("[style]"))].forEach((x) => {
        for (const m of (x.getAttribute("style") ?? "").matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) { const u = addImage(m[1]); if (u) push(` ![](${u}) `) }
      })
      // Een link zonder tekst (de naam staat in een SVG of als beeld): het
      // laatste deel van het adres als tekst, zodat Claude de link herkent.
      const label = inner || (el.getAttribute("aria-label") ?? el.getAttribute("title") ?? "").trim()
        || (href ? decodeURIComponent(new URL(href).pathname.split("/").filter(Boolean).pop() ?? "").replace(/[-_]+/g, " ") : "")
      if (href) push(` [${label}](${href}) `)
      else if (inner) push(inner)
      return
    }
    const block = BLOCK_TAGS.has(tag)
    if (block) push("\n")
    if (/^H[1-6]$/.test(tag)) push(`${"#".repeat(Number(tag[1]))} `)
    el.childNodes.forEach(walk)
    if (block) push("\n")
  }
  if (doc.body) walk(doc.body)
  const text = out.join("").replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim().slice(0, maxChars)
  return { text, images, links, title: doc.title ?? "" }
}

/** Is wat het gewone verzoek opleverde genoeg om mee te werken? */
function usable(page: { text: string; images: string[]; links: string[]; title: string }): boolean {
  if (BLOCKED.test(page.title) || BLOCKED.test(page.text.slice(0, 2000))) return false
  // Woorden inclusief linktekst (op een overzicht staan de namen in links),
  // zonder de adressen zelf.
  const words = page.text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\]\([^)]*\)/g, " ").split(/\s+/).filter((w) => /[a-z]{2}/i.test(w)).length
  if (words < 120 || (page.images.length < 3 && page.links.length < 15)) return false
  // Veel links maar weinig beelden: het raster met productbeelden wordt pas
  // in de browser ingeladen (PENT: 79 links, 13 beelden, terwijl Firecrawl
  // er 259 vond). Dan Firecrawl, dat de pagina rendert.
  if (page.links.length >= 40 && page.images.length * 4 < page.links.length) return false
  return true
}

/**
 * Shopify-winkels laden hun productraster vaak pas in de browser, maar elke
 * winkel heeft een openbare feed per collectie (/collections/<naam>/products.json)
 * met titel, link en beelden. Die voegen we toe aan wat Claude leest.
 */
async function shopifyFeed(pageUrl: string, ua: string): Promise<{ text: string; images: string[] } | null> {
  let u: URL
  try { u = new URL(pageUrl) } catch { return null }
  const m = u.pathname.match(/\/collections\/([^/?#]+)/)
  const feed = m ? `${u.origin}/collections/${m[1]}/products.json?limit=250` : `${u.origin}/products.json?limit=250`
  try {
    const res = await fetch(feed, { headers: { "User-Agent": ua, Accept: "application/json" }, signal: AbortSignal.timeout(20000), cache: "no-store" })
    if (!res.ok) return null
    const data = (await res.json()) as { products?: Array<{ title: string; handle: string; product_type?: string; images?: Array<{ src: string }> }> }
    const products = data.products ?? []
    if (products.length === 0) return null
    const images: string[] = []
    const lines = products.map((p) => {
      const img = p.images?.[0]?.src ? absoluteHttpUrl(p.images[0].src, u.origin) : null
      if (img) images.push(img)
      return `- [${p.title}](${u.origin}/products/${p.handle})${p.product_type ? ` (${p.product_type})` : ""}${img ? ` ![${p.title}](${img})` : ""}`
    })
    return { text: `\n\n## Products in this shop collection (from the shop's product feed)\n${lines.join("\n")}\n`, images }
  } catch {
    return null
  }
}

/**
 * Een galerij of raster dat pas in de browser wordt gevuld: lege
 * plaatshouders (placeholder.svg, lege data:-beelden) of een bron die het
 * script zelf ophaalt (data-json-source). Brokis Double: 40 <img>-tags in de
 * HTML, waarvan 12 plaatshouders; gerenderd 50 collectiebeelden en vijf
 * producten in plaats van twee. Dan Firecrawl, ook als de tekst vol lijkt.
 */
function clientRendered(html: string): boolean {
  // Alleen plaatshouders zonder echt beeld erachter: een lazy-load-thema met
  // het beeld in data-src of srcset lezen we zelf al (imageSrc).
  const placeholders = (html.match(/<img\b[^>]*>/gi) ?? []).filter((tag) =>
    /\ssrc="(?:[^"]*placeholder[^"]*|data:image\/[^"]*)"/i.test(tag) && !/\s(?:data-src|data-srcset|srcset|data-lazy-src|data-original)="[^"]+"/i.test(tag)).length
  return placeholders >= 3 || /\sdata-json-source="/i.test(html)
}

const isShopify = (html: string) => /cdn\.shopify\.com|\/cdn\/shop\/|Shopify\.theme|shopify-section/.test(html)

export async function fetchPage(
  url: string,
  opts: { maxChars: number; mainContentOnly?: boolean; firecrawlKey?: string; /** Meteen Firecrawl: sites die hun raster pas in de browser laden terwijl de HTML vol genoeg lijkt (minotti.com). */ render?: boolean },
): Promise<FetchedPage | null> {
  // 1. Gratis, met elke identificatie één keer.
  for (const ua of opts.render ? [] : USER_AGENTS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": ua, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en,nl;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      })
      const type = res.headers.get("content-type") ?? ""
      if (res.ok && type.includes("html")) {
        const html = await res.text()
        const page = htmlToPageText(html, res.url || url, opts.maxChars)
        // Shopify: de productfeed erbij (gratis), ook als het raster ontbreekt.
        if (!opts.mainContentOnly && isShopify(html)) {
          const feed = await shopifyFeed(res.url || url, ua)
          if (feed) {
            const images = Array.from(new Set([...feed.images, ...page.images]))
            return { url: res.url || url, text: (page.text + feed.text).slice(0, opts.maxChars + 40_000), images, links: page.links, via: "fetch" }
          }
        }
        if (usable(page) && !clientRendered(html)) return { url: res.url || url, text: page.text, images: page.images, links: page.links, via: "fetch" }
      }
    } catch {
      // volgende identificatie, anders Firecrawl
    }
  }

  // 2. Firecrawl, als de sleutel er is.
  const key = opts.firecrawlKey ?? process.env.FIRECRAWL_API_KEY
  if (!key) return null
  try {
    const doc = await new Firecrawl({ apiKey: key }).scrape(url, {
      formats: ["markdown", "links", "images"],
      timeout: 45000,
      waitFor: 4000,
      onlyMainContent: Boolean(opts.mainContentOnly),
    }) as any
    const text = ((doc?.markdown ?? "") as string).slice(0, opts.maxChars)
    const images = Array.from(new Set(((doc?.images ?? []) as string[]).map((u) => absoluteHttpUrl(u, url)).filter((u): u is string => Boolean(u) && !/\.svg(\?|$)/i.test(u as string))))
    const links = ((doc?.links ?? []) as string[]).map((u) => absoluteHttpUrl(u, url)).filter((u): u is string => Boolean(u))
    if (!text.trim() && images.length === 0) return null
    return { url, text, images, links, via: "firecrawl" }
  } catch (err) {
    logger.warn("Firecrawl scrape failed", { url, error: err instanceof Error ? err.message : String(err) })
    return null
  }
}
