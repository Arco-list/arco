import { createServerSupabaseClient } from "@/lib/supabase/server"
import { PROVINCES, cityLabel, provinceKey } from "@/lib/provinces"

/**
 * Programmatic hub pages for the professionals discover —
 * /professionals/{slug} for cities, provinces and services, plus nested
 * /professionals/{city}/{service} combos. Same contract as the project
 * hubs: only minted when the slice clears MIN_PRO_HUB_COMPANIES, company
 * detail slugs always win a collision, and the professional filter
 * provider maps filter state <-> hub paths so hub pages ARE the
 * discover page, pre-filtered.
 */

export const MIN_PRO_HUB_COMPANIES = 3

export type ProHubKind = "city" | "province" | "service" | "service-city" | "service-province" | "category" | "category-city" | "category-province"

export type ProHub = {
  kind: ProHubKind
  slug: string
  /** City name as stored, province EN key, or the service EN name. */
  name: string
  count: number
  /** city / province / service-city: exact company_city spellings covered. */
  cityNames?: string[]
  /** province / service-province hubs: canonical EN region key. */
  region?: string
  /** service / service-city: the specialty slug == filter URL token. */
  serviceSlug?: string
  serviceName?: string
  serviceNameNl?: string
  /** category / category-city / category-province: the parent service
   *  GROUP (e.g. design-planning) == categories filter URL token. */
  categorySlug?: string
  categoryName?: string
  categoryNameNl?: string
}

/** Plural display forms for the service hubs we expect; fallback
 *  appends an "s" to the stored name. */
const SERVICE_PLURALS: Record<string, { nl: string; en: string }> = {
  architect: { nl: "Architecten", en: "Architects" },
  "interior-designer": { nl: "Interieurontwerpers", en: "Interior designers" },
  "garden-designer": { nl: "Tuinontwerpers", en: "Garden designers" },
}

export function servicePlural(hub: ProHub, locale: string): string {
  const known = hub.serviceSlug ? SERVICE_PLURALS[hub.serviceSlug] : undefined
  if (known) return locale === "nl" ? known.nl : known.en
  const base = (locale === "nl" ? hub.serviceNameNl : hub.serviceName) ?? hub.serviceName ?? hub.slug
  return `${base}s`
}

export function proCitySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

type MvRow = {
  company_city: string | null
  company_state_region: string | null
  primary_specialty_slug: string | null
  primary_service_name: string | null
  primary_service_name_nl: string | null
}

export async function getProfessionalHubs(): Promise<ProHub[]> {
  const supabase = await createServerSupabaseClient()
  const [{ data }, { data: cats }] = await Promise.all([
    supabase
      .from("mv_professional_summary")
      .select("company_city, company_state_region, primary_specialty_slug, primary_service_name, primary_service_name_nl")
      .in("company_status", ["listed", "prospected"]),
    supabase.from("categories").select("id, slug, name, name_nl, parent_id"),
  ])
  const rows = (data ?? []) as MvRow[]
  // service slug -> parent category (service GROUP, e.g. design-planning)
  const catById = new Map((cats ?? []).map((c) => [c.id, c]))
  const parentBySvcSlug = new Map<string, { slug: string; name: string; nameNl: string | null }>()
  for (const c of cats ?? []) {
    if (!c.parent_id || !c.slug) continue
    const parent = catById.get(c.parent_id)
    if (parent?.slug && parent.name) parentBySvcSlug.set(c.slug, { slug: parent.slug, name: parent.name, nameNl: parent.name_nl })
  }

  const cityAgg = new Map<string, { name: string; count: number; names: Set<string> }>()
  const provinceAgg = new Map<string, { count: number; names: Set<string> }>()
  const serviceAgg = new Map<string, { name: string; nameNl: string | null; count: number }>()
  const comboAgg = new Map<string, { city: string; serviceSlug: string; name: string; nameNl: string | null; count: number; names: Set<string> }>()
  const provinceComboAgg = new Map<string, { region: string; serviceSlug: string; name: string; nameNl: string | null; count: number; names: Set<string> }>()
  type CatAgg = { slug: string; name: string; nameNl: string | null; count: number; names: Set<string>; region?: string; city?: string }
  const categoryAgg = new Map<string, CatAgg>()
  const categoryCityAgg = new Map<string, CatAgg>()
  const categoryProvinceAgg = new Map<string, CatAgg>()

  for (const row of rows) {
    const city = row.company_city?.trim()
    const cSlug = city ? proCitySlug(city) : ""
    if (city && cSlug) {
      const entry = cityAgg.get(cSlug) ?? { name: city, count: 0, names: new Set<string>() }
      entry.count += 1
      entry.names.add(city)
      cityAgg.set(cSlug, entry)
    }
    const region = provinceKey(row.company_state_region)
    if (region && city) {
      const entry = provinceAgg.get(region) ?? { count: 0, names: new Set<string>() }
      entry.count += 1
      entry.names.add(city)
      provinceAgg.set(region, entry)
    }
    const svc = row.primary_specialty_slug?.trim()
    if (svc && row.primary_service_name) {
      const entry = serviceAgg.get(svc) ?? { name: row.primary_service_name, nameNl: row.primary_service_name_nl, count: 0 }
      entry.count += 1
      serviceAgg.set(svc, entry)
      if (city && cSlug) {
        const key = `${cSlug}/${svc}`
        const combo = comboAgg.get(key) ?? { city, serviceSlug: svc, name: row.primary_service_name, nameNl: row.primary_service_name_nl, count: 0, names: new Set<string>() }
        combo.count += 1
        combo.names.add(city)
        comboAgg.set(key, combo)
      }
      if (region && city) {
        const key = `${PROVINCES[region].slug}/${svc}`
        const combo = provinceComboAgg.get(key) ?? { region, serviceSlug: svc, name: row.primary_service_name, nameNl: row.primary_service_name_nl, count: 0, names: new Set<string>() }
        combo.count += 1
        combo.names.add(city)
        provinceComboAgg.set(key, combo)
      }
      const parent = parentBySvcSlug.get(svc)
      if (parent) {
        const base = categoryAgg.get(parent.slug) ?? { slug: parent.slug, name: parent.name, nameNl: parent.nameNl, count: 0, names: new Set<string>() }
        base.count += 1
        if (city) base.names.add(city)
        categoryAgg.set(parent.slug, base)
        if (city && cSlug) {
          const key = `${cSlug}/${parent.slug}`
          const cc = categoryCityAgg.get(key) ?? { slug: parent.slug, name: parent.name, nameNl: parent.nameNl, count: 0, names: new Set<string>(), city }
          cc.count += 1
          cc.names.add(city)
          categoryCityAgg.set(key, cc)
        }
        if (region && city) {
          const key = `${PROVINCES[region].slug}/${parent.slug}`
          const cp = categoryProvinceAgg.get(key) ?? { slug: parent.slug, name: parent.name, nameNl: parent.nameNl, count: 0, names: new Set<string>(), region }
          cp.count += 1
          cp.names.add(city)
          categoryProvinceAgg.set(key, cp)
        }
      }
    }
  }

  const hubs: ProHub[] = [
    ...Array.from(cityAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({ kind: "city" as const, slug, name: v.name, count: v.count, cityNames: Array.from(v.names) })),
    ...Array.from(provinceAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([region, v]) => ({
        kind: "province" as const,
        slug: PROVINCES[region].slug,
        name: region,
        count: v.count,
        cityNames: Array.from(v.names),
        region,
      })),
    ...Array.from(serviceAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({
        kind: "service" as const,
        slug,
        name: v.name,
        count: v.count,
        serviceSlug: slug,
        serviceName: v.name,
        serviceNameNl: v.nameNl ?? undefined,
      })),
    ...Array.from(comboAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({
        kind: "service-city" as const,
        slug,
        name: v.city,
        count: v.count,
        cityNames: Array.from(v.names),
        serviceSlug: v.serviceSlug,
        serviceName: v.name,
        serviceNameNl: v.nameNl ?? undefined,
      })),
    ...Array.from(provinceComboAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({
        kind: "service-province" as const,
        slug,
        name: v.region,
        count: v.count,
        cityNames: Array.from(v.names),
        region: v.region,
        serviceSlug: v.serviceSlug,
        serviceName: v.name,
        serviceNameNl: v.nameNl ?? undefined,
      })),
    ...Array.from(categoryAgg.values())
      .filter((v) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map((v) => ({
        kind: "category" as const,
        slug: v.slug,
        name: v.name,
        count: v.count,
        categorySlug: v.slug,
        categoryName: v.name,
        categoryNameNl: v.nameNl ?? undefined,
      })),
    ...Array.from(categoryCityAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({
        kind: "category-city" as const,
        slug,
        name: v.city as string,
        count: v.count,
        cityNames: Array.from(v.names),
        categorySlug: v.slug,
        categoryName: v.name,
        categoryNameNl: v.nameNl ?? undefined,
      })),
    ...Array.from(categoryProvinceAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({
        kind: "category-province" as const,
        slug,
        name: v.region as string,
        count: v.count,
        cityNames: Array.from(v.names),
        region: v.region,
        categorySlug: v.slug,
        categoryName: v.name,
        categoryNameNl: v.nameNl ?? undefined,
      })),
  ].sort((a, b) => b.count - a.count)

  return hubs
}

export async function resolveProfessionalHub(slug: string): Promise<ProHub | null> {
  const hubs = await getProfessionalHubs()
  return hubs.find((h) => h.slug === slug) ?? null
}

export type ProHubCopy = { h1: string; metaTitle: string; description: string; crumb: string }

export function proHubCopy(hub: ProHub, locale: string): ProHubCopy {
  const nl = locale === "nl"
  if (hub.kind === "city" || hub.kind === "province") {
    const where = hub.kind === "city"
      ? cityLabel(hub.name, locale)
      : (PROVINCES[hub.name] ? (nl ? PROVINCES[hub.name].nl : PROVINCES[hub.name].en) : hub.name)
    return {
      h1: nl ? `Professionals in ${where}` : `Professionals in ${where}`,
      metaTitle: nl
        ? `Architecten en interieurontwerpers in ${where}`
        : `Architects & interior designers in ${where}`,
      // ~155 chars: a description that fills the whole SERP snippet.
      // Shorter ones got padded by Google with scraped breadcrumb +
      // footer text ("Professionals/Nederland/ Arco Global BV.").
      description: nl
        ? `Vind architecten en interieurontwerpers in ${where} op Arco. Bekijk gerealiseerde projecten van lokale studio's, vergelijk hun werk en neem direct contact op.`
        : `Find architects and interior designers in ${where} on Arco. Browse completed projects by local studios, compare their work and get in touch directly.`,
      crumb: where,
    }
  }
  if (hub.kind === "category" || hub.kind === "category-city" || hub.kind === "category-province") {
    const label = (nl ? hub.categoryNameNl : hub.categoryName) ?? hub.categoryName ?? hub.slug
    const where = hub.kind === "category-city"
      ? cityLabel(hub.name, locale)
      : hub.kind === "category-province"
        ? (PROVINCES[hub.name] ? (nl ? PROVINCES[hub.name].nl : PROVINCES[hub.name].en) : hub.name)
        : (nl ? "Nederland" : "the Netherlands")
    return {
      h1: `${label} professionals in ${where}`,
      metaTitle: nl
        ? `${label} professionals in ${where} – bekijk hun projecten`
        : `${label} professionals in ${where} – browse their projects`,
      description: nl
        ? `Vind ${label} professionals in ${where} op Arco. Bekijk hun gerealiseerde projecten, vergelijk studio's en neem direct contact op met het juiste bureau.`
        : `Find ${label} professionals in ${where} on Arco. Browse their completed projects, compare studios and get in touch with the right firm directly.`,
      crumb: label,
    }
  }
  const plural = servicePlural(hub, locale)
  const where = hub.kind === "service-city"
    ? cityLabel(hub.name, locale)
    : hub.kind === "service-province"
      ? (PROVINCES[hub.name] ? (nl ? PROVINCES[hub.name].nl : PROVINCES[hub.name].en) : hub.name)
      : (nl ? "Nederland" : "the Netherlands")
  return {
    h1: `${plural} in ${where}`,
    metaTitle: nl
      ? `${plural} in ${where} – bekijk hun projecten`
      : `${plural} in ${where} – browse their projects`,
    description: nl
      ? `Vind ${plural.toLowerCase()} in ${where} op Arco. Bekijk portfolio's met gerealiseerde projecten — van villa's tot interieurs — vergelijk studio's en neem direct contact op.`
      : `Find ${plural.toLowerCase()} in ${where} on Arco. Browse portfolios of completed projects — from villas to interiors — compare studios and get in touch directly.`,
    crumb: plural,
  }
}

// ─── Service-hub prose + FAQ ─────────────────────────────────────────────────
// Hand-written editorial copy for the NATIONAL service hubs only
// (/professionals/architect, /professionals/interior-designer) — the two
// head-term landing pages. Deliberately NOT templated across geo variants:
// thirty spun near-duplicates read as doorway filler to Google. Rendered
// below the grid (photography stays above the fold) with FAQPage JSON-LD.
//
// Tone: high-end. The pitch is the perfect match on realized work and the
// value a good studio adds — not price shopping. Cost is framed at
// total-project level (what clients actually budget), never hourly-first.

export type ServiceHubProse = {
  /** JE-style platform block ("what Arco adds"), rendered right after the
   *  FAQ. "{count}" in a paragraph is replaced with the live company
   *  count of the hub. */
  platform: { heading: string; paragraphs: string[] }
  sections: Array<{ heading: string; paragraphs: string[] }>
  faqHeading: string
  faqs: Array<{ question: string; answer: string }>
}

export const SERVICE_HUB_PROSE: Record<string, Record<"nl" | "en", ServiceHubProse>> = {
  architect: {
    nl: {
      platform: {
        heading: "Vind jouw architect op Arco",
        paragraphs: [
          "Op Arco vind je momenteel {count} architectenbureaus met gerealiseerd werk in Nederland. Gebruik de filters om te zoeken op locatie of dienst, en bekijk per bureau afgeronde projecten — gefotografeerd ruimte voor ruimte, met de materialen en details zoals ze zijn opgeleverd.",
          "Elk bureau heeft een eigen handschrift — de een excelleert in strakke nieuwbouw aan het water, de ander in het transformeren van monumentaal erfgoed. De beste voorspeller van jouw resultaat is werk dat al gebouwd is: herken je jouw ambitie in een gerealiseerd project, dan is de match gevonden. Je neemt rechtstreeks en kosteloos contact op met het bureau — en ziet per project ook de studio's waarmee is samengewerkt, van interieurontwerper tot landschapsarchitect.",
        ],
      },
      sections: [
        {
          heading: "Wat een goede architect toevoegt",
          paragraphs: [
            "Het verschil tussen een huis en een huis dat blijft verrassen, zit in het ontwerp. Een goede architect haalt meer uit een kavel dan er op het eerste gezicht in zit: licht dat op het juiste moment binnenvalt, zichtlijnen die ruimtes groter maken dan hun vierkante meters, materialen die mooier worden naarmate ze ouder worden. Dat is geen luxe bovenop het bouwbudget — het is wat bepaalt of een huis over twintig jaar nog klopt.",
            "De architecten op Arco laten dat zien met gerealiseerd werk: gebouwde villa's, verbouwingen en transformaties, gefotografeerd zoals ze zijn opgeleverd. “Architect” is bovendien een beschermde titel — wie op Arco staat, toont wat die titel in de praktijk waard is.",
          ],
        },
        {
          heading: "Budget en waarde",
          paragraphs: [
            "Denk bij een architect niet in uurtarieven maar in het totale project. Het honorarium voor een volledig traject — van eerste schets tot esthetische begeleiding van de bouw — beweegt in Nederland doorgaans rond de 8 tot 12% van de bouwsom, en verdient zich terug in wat er tegenover staat: een ontwerp dat het maximale uit het budget haalt, fouten voorkomt die tijdens de bouw kostbaar zijn, en een huis oplevert dat aantoonbaar meer waard is dan de som van de bouwkosten. Bespreek in het eerste gesprek het totale budget en de ambitie — een goed bureau ontwerpt daarbinnen, niet erbovenop.",
          ],
        },
              ],
      faqHeading: "Veelgestelde vragen over architecten",
      faqs: [
        {
          question: "Wat kost een architect bij nieuwbouw of een grote verbouwing?",
          answer: "Kijk naar het totale project, niet naar het uurtarief. Voor een volledig traject ligt het honorarium doorgaans rond de 8 tot 12% van de bouwsom, afhankelijk van de complexiteit en de rol van de architect. Daar staat tegenover dat een goed ontwerp het maximale uit het bouwbudget haalt en kostbare fouten in de uitvoering voorkomt. Vraag een voorstel met een heldere fase-indeling, afgestemd op jouw totaalbudget.",
        },
        {
          question: "Wanneer betrek ik een architect bij mijn plannen?",
          answer: "Zo vroeg mogelijk — idealiter vóór de aankoop van een kavel of woning. Juist in de eerste fase bepaalt een architect wat er ruimtelijk mogelijk is en waar de kansen van een plek liggen. Bij nieuwbouw, een vergunningplichtige verbouwing of een constructieve ingreep is een architect vrijwel altijd de juiste keuze.",
        },
        {
          question: "Wat is het verschil tussen een architect en een bouwkundig ontwerper?",
          answer: "“Architect” is in Nederland een beschermde titel: alleen wie is ingeschreven in het Architectenregister mag zich zo noemen, na een erkende opleiding en beroepservaring. Een bouwkundig ontwerper kan degelijk tekenwerk leveren, maar de titel staat voor een bewezen ontwerp- en opleidingsniveau. Beoordeel uiteindelijk beide op hetzelfde: gerealiseerd werk.",
        },
        {
          question: "Hoe vind ik de architect die bij mijn project past?",
          answer: "Zoek de match in gebouwd werk, niet in beloften. Bekijk afgeronde projecten die lijken op jouw opgave — zelfde type woning, vergelijkbare ambitie — en let op detaillering en materiaalgebruik. Plan daarna een kennismaking met twee of drie bureaus: een bouwtraject duurt al snel twee jaar, dus de klik telt. Op Arco bekijk je van elk bureau het gerealiseerde portfolio, ruimte voor ruimte.",
        },
        {
          question: "Kan ik via Arco direct contact opnemen met een architect?",
          answer: "Ja. Elk bureau op Arco heeft een eigen pagina met gerealiseerde projecten en contactgegevens. Je benadert het bureau rechtstreeks en kosteloos — zonder tussenpersoon, leadformulier of commissie.",
        },
      ],
    },
    en: {
      platform: {
        heading: "Find your architect on Arco",
        paragraphs: [
          "Arco currently features {count} architecture firms with realized work in the Netherlands. Use the filters to search by location or service, and browse each firm's completed projects — photographed room by room, with the materials and details as delivered.",
          "Every firm has its own signature — one excels at crisp new-builds on the water, another at transforming listed heritage. The best predictor of your result is work that has already been built: when you recognize your ambition in a realized project, the match is made. You contact the firm directly and free of charge — and see, per project, the studios it was made with, from interior designer to landscape architect.",
        ],
      },
      sections: [
        {
          heading: "What a good architect adds",
          paragraphs: [
            "The difference between a house and a house that keeps surprising you lies in the design. A good architect gets more out of a plot than meets the eye: light that arrives at the right moment of the day, sightlines that make rooms feel larger than their square footage, materials that grow more beautiful as they age. That isn't a luxury on top of the construction budget — it's what decides whether a house still feels right twenty years on.",
            "The architects on Arco prove it with realized work: built villas, renovations and transformations, photographed as delivered. “Architect” is also a protected title in the Netherlands — the firms on Arco show what that title is worth in practice.",
          ],
        },
        {
          heading: "Budget and value",
          paragraphs: [
            "Think total project, not hourly rates. The fee for a complete assignment — from first sketch to aesthetic supervision of construction — typically moves around 8 to 12% of the construction sum in the Netherlands, and earns itself back in what it delivers: a design that extracts the most from the budget, prevents mistakes that are expensive to fix on site, and results in a house demonstrably worth more than the sum of its building costs. Discuss the total budget and the ambition in the first meeting — a good firm designs within it, not on top of it.",
          ],
        },
              ],
      faqHeading: "Frequently asked questions about architects",
      faqs: [
        {
          question: "What does an architect cost for a new build or major renovation?",
          answer: "Think in terms of the total project, not the hourly rate. For a complete assignment the fee typically moves around 8 to 12% of the construction sum, depending on complexity and the architect's role. In return, a good design extracts the most from the budget and prevents costly mistakes on site. Ask for a proposal with a clear phase breakdown, aligned with your total budget.",
        },
        {
          question: "When should I involve an architect?",
          answer: "As early as possible — ideally before buying the plot or property. It's in that first phase that an architect determines what is spatially possible and where a site's opportunities lie. For a new build, a permit-required renovation or a structural intervention, an architect is almost always the right choice.",
        },
        {
          question: "What is the difference between an architect and a building designer?",
          answer: "“Architect” is a protected title in the Netherlands: only professionals enrolled in the Architects Register may use it, after accredited education and professional experience. A building designer can deliver solid drawings, but the title stands for a proven level of design and training. Ultimately, judge both by the same measure: realized work.",
        },
        {
          question: "How do I find the architect that fits my project?",
          answer: "Look for the match in built work, not in promises. Browse completed projects that resemble your own assignment — the same type of home, a comparable ambition — and study the detailing and materials. Then meet two or three firms: a building project easily spans two years, so chemistry counts. On Arco you can explore each firm's realized portfolio room by room.",
        },
        {
          question: "Can I contact an architect directly through Arco?",
          answer: "Yes. Every firm on Arco has its own page with realized projects and contact details. You approach the firm directly and free of charge — no middleman, no lead forms, no commission.",
        },
      ],
    },
  },
  "interior-designer": {
    nl: {
      platform: {
        heading: "Vind jouw interieurontwerper op Arco",
        paragraphs: [
          "Op Arco vind je momenteel {count} interieurstudio's met gerealiseerd werk in Nederland. Gebruik de filters om te zoeken op locatie of dienst, en blader per studio door afgeronde interieurs — gefotografeerd ruimte voor ruimte, van keuken tot badkamer.",
          "Elke studio heeft een signatuur — warm minimalisme, klassiek met een moderne snede, uitgesproken kleur en verzamelde kunst. De beste manier om te weten of een studio bij je past, is kijken naar wat ze hebben gemaakt: herken je jouw smaak in een gerealiseerd interieur, dan heb je je match gevonden. Je neemt rechtstreeks en kosteloos contact op met de studio — en ziet per project het complete team erachter, van architect tot meubelmaker.",
        ],
      },
      sections: [
        {
          heading: "Wat een interieurontwerper toevoegt",
          paragraphs: [
            "Een interieur dat klopt, herken je meteen — al kun je niet altijd benoemen waarom. Dat is het werk van een goede interieurontwerper: licht, indeling, materialen, maatwerk en kunst die samen één verhaal vertellen, afgestemd op hoe jij woont. Waar een aannemer oplevert wat is getekend, tilt een ontwerper het project naar een hoger niveau — met keuzes die je zelf niet had bedacht en een samenhang die een woning blijvend waardevoller maakt.",
            "De studio's op Arco tonen dat niveau met gerealiseerde interieurs, gefotografeerd ruimte voor ruimte. Zo zie je niet alleen stijl, maar vakmanschap: de detaillering van een kastenwand, de overgang tussen materialen, de rust in een lichtplan.",
          ],
        },
        {
          heading: "Budget en waarde",
          paragraphs: [
            "Denk bij interieurontwerp in het totale project, niet in uurtarieven. Bepalend is het interieurbudget als geheel — afwerking, maatwerk, meubels, verlichting — waarvan het ontwerphonorarium doorgaans een beperkt deel is, in de praktijk vaak in de orde van 10 tot 15%. Juist dat deel bepaalt het rendement van de rest: een goede ontwerper voorkomt dure missers, weet waar investeren loont en waar het slimmer kan, en haalt uit hetzelfde budget een aantoonbaar rijker resultaat. Bespreek in de kennismaking het totaalbudget en de ambitie — een goede studio maakt daarbinnen het maximale verschil.",
          ],
        },
              ],
      faqHeading: "Veelgestelde vragen over interieurontwerpers",
      faqs: [
        {
          question: "Wat kost een interieurontwerper voor een complete woning?",
          answer: "Reken vanuit het totale interieurbudget — afwerking, maatwerk, meubels en verlichting samen — in plaats vanuit een uurtarief. Het ontwerphonorarium is daarvan doorgaans een beperkt deel, in de praktijk vaak in de orde van 10 tot 15%, meestal als vaste aanneemsom per fase afgesproken. Een goede studio verdient dat terug door dure missers te voorkomen en meer uit hetzelfde budget te halen.",
        },
        {
          question: "Wat voegt een interieurontwerper toe die ik zelf niet kan?",
          answer: "Samenhang en niveau. Een ontwerper bewaakt het geheel — lichtplan, materialen, maatwerk, styling — en maakt keuzes die je zelf niet had bedacht: een indeling die beter werkt, materialen die mooier verouderen, details die het verschil maken. Het resultaat is een interieur dat als één geheel voelt en de woning blijvend waardevoller maakt.",
        },
        {
          question: "Wat is het verschil tussen een interieurarchitect en een interieurontwerper?",
          answer: "“Interieurarchitect” is een beschermde titel voor wie is ingeschreven in het Architectenregister; “interieurontwerper” mag iedereen zich noemen. De titel garandeert een erkende opleiding, maar zegt niet alles — er zijn uitstekende studio's zonder registratie. Beoordeel een studio daarom vooral op gerealiseerd werk.",
        },
        {
          question: "Wanneer betrek ik een interieurontwerper bij mijn project?",
          answer: "Zo vroeg mogelijk. Bij nieuwbouw of een grote verbouwing loont het om de interieurontwerper al tijdens het bouwkundig ontwerp aan te haken: lichtplan, installaties en maatwerk zitten dan vanaf het begin in de tekeningen, in plaats van dat ze er later ingepast moeten worden. Ook voor één ruimte — een keuken, badkamer of woonverdieping — begint een goed traject vóór de uitvoering.",
        },
        {
          question: "Kan ik via Arco direct contact opnemen met een interieurontwerper?",
          answer: "Ja. Elke studio op Arco heeft een eigen pagina met gerealiseerde interieurs en contactgegevens. Je benadert de studio rechtstreeks en kosteloos — zonder tussenpersoon, leadformulier of commissie.",
        },
      ],
    },
    en: {
      platform: {
        heading: "Find your interior designer on Arco",
        paragraphs: [
          "Arco currently features {count} interior studios with realized work in the Netherlands. Use the filters to search by location or service, and browse each studio's completed interiors — photographed room by room, from kitchen to bathroom.",
          "Every studio has a signature — warm minimalism, classic with a modern edge, outspoken colour and collected art. The best way to know whether a studio fits you is to look at what they have made: when you recognize your taste in a realized interior, you have found your match. You contact the studio directly and free of charge — and see, per project, the complete team behind it, from architect to furniture maker.",
        ],
      },
      sections: [
        {
          heading: "What an interior designer adds",
          paragraphs: [
            "You recognize an interior that works the moment you step in — even if you can't always say why. That is the craft of a good interior designer: light, layout, materials, custom work and art telling one story, attuned to how you live. Where a contractor delivers what was drawn, a designer lifts the project to a higher level — with choices you wouldn't have thought of yourself, and a coherence that adds lasting value to a home.",
            "The studios on Arco show that level with realized interiors, photographed room by room. You see more than style: you see craftsmanship — the detailing of a cabinet wall, the transition between materials, the calm of a well-considered lighting plan.",
          ],
        },
        {
          heading: "Budget and value",
          paragraphs: [
            "Think in terms of the total project, not hourly rates. What matters is the interior budget as a whole — finishes, custom work, furniture, lighting — of which the design fee is typically a limited share, in practice often in the order of 10 to 15%. That share determines the return on all the rest: a good designer prevents expensive missteps, knows where investing pays off and where it can be done smarter, and draws a demonstrably richer result from the same budget. Discuss the total budget and the ambition at the first meeting — a good studio makes the maximum difference within it.",
          ],
        },
              ],
      faqHeading: "Frequently asked questions about interior designers",
      faqs: [
        {
          question: "What does an interior designer cost for a complete home?",
          answer: "Reason from the total interior budget — finishes, custom work, furniture and lighting combined — rather than from an hourly rate. The design fee is typically a limited share of that, in practice often in the order of 10 to 15%, usually agreed as a fixed fee per phase. A good studio earns it back by preventing expensive missteps and drawing more from the same budget.",
        },
        {
          question: "What does an interior designer add that I couldn't do myself?",
          answer: "Coherence and level. A designer guards the whole — lighting plan, materials, custom work, styling — and makes choices you wouldn't have thought of: a layout that works better, materials that age beautifully, details that make the difference. The result is an interior that feels like one whole and adds lasting value to the home.",
        },
        {
          question: "What is the difference between an interior architect and an interior designer?",
          answer: "“Interior architect” is a protected title in the Netherlands for professionals enrolled in the Architects Register; anyone may call themselves an “interior designer”. The title guarantees accredited training but isn't everything — there are excellent studios without registration. Above all, judge a studio by its realized work.",
        },
        {
          question: "When should I involve an interior designer in my project?",
          answer: "As early as possible. For a new build or major renovation it pays to bring the interior designer in during the architectural design: lighting, installations and custom work are then part of the drawings from day one, rather than fitted in afterwards. Even for a single space — a kitchen, bathroom or living floor — a good assignment starts before execution.",
        },
        {
          question: "Can I contact an interior designer directly through Arco?",
          answer: "Yes. Every studio on Arco has its own page with realized interiors and contact details. You approach the studio directly and free of charge — no middleman, no lead forms, no commission.",
        },
      ],
    },
  },
}
