/**
 * Een pagina ophalen zoals de collectiepijplijn dat doet, zonder Firecrawl:
 * laat zien of de gratis route volstaat en wat Claude te zien krijgt.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-fetch-page.ts <url> [<url>…]
 */
async function main() {
  const { fetchPage } = await import("../lib/collections/fetch-page")
  for (const url of process.argv.slice(2)) {
    const page = await fetchPage(url, { maxChars: 150_000, firecrawlKey: "" })
    if (!page) { console.log(`${url}\n  → niet gratis te lezen (zou naar Firecrawl gaan)`); continue }
    console.log(`${url}\n  → ${page.via}: ${page.text.length} tekens, ${page.images.length} beelden, ${page.links.length} links`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
