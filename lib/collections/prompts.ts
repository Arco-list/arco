import "server-only"

/**
 * De vier vragen aan Claude in de collectiepijplijn, als batch-verzoeken
 * (lib/collections/pipeline). Gestructureerde uitvoer: elk antwoord is
 * JSON volgens het schema. Sonnet volstaat voor dit werk; via de batch-API
 * kost het de helft.
 */

export const PIPELINE_MODEL = "claude-sonnet-5-5"
export const MAX_OVERVIEW_PAGES = 8
export const MAX_AMBIANCE_PHOTOS = 10
export const MAX_PHOTO_CANDIDATES = 20

export type BatchRequest = { custom_id: string; params: Record<string, unknown> }

/** Eén regel per categorie: "slug — Groep › Subgroep › Soort". */
export type CategoryLine = { slug: string; path: string }

const categoryMenu = (cats: CategoryLine[]) => cats.map((c) => `${c.slug} — ${c.path}`).join("\n")

// ── 1. Welke pagina's tonen de collecties? ─────────────────────────────

export const PICK_PAGES_SCHEMA = {
  type: "object",
  properties: { pages: { type: "array", items: { type: "string" } } },
  required: ["pages"],
  additionalProperties: false,
} as const

export function pickPagesRequest(customId: string, brandName: string, origin: string, urls: Array<{ url: string; title: string | null }>): BatchRequest {
  return {
    custom_id: customId,
    params: {
      model: PIPELINE_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: PICK_PAGES_SCHEMA } },
      messages: [{
        role: "user",
        content: `Below are pages from the website of the brand "${brandName}" (${origin}). We want to list the brand's COLLECTIONS: its named product lines, series or families (for a lighting brand "Mito" or "Sento", for a furniture brand "Bart" or "Monster"; for a brand that names each product, like a fitness brand with a treadmill "IRENA", the named products).

Pick the pages that together show the brand's whole range as an overview: collection or series overview pages, product category pages that list products, a "products" or "collections" index. Each page costs money to read, so pick as few as cover the range:
- when one index page lists the whole range ("all products", "collections"), return only that page;
- use category pages only when the range is split over them;
- one language version only — English if the site has it — never the same page in two languages.
Do NOT pick individual product pages, blog/news, about, contact, dealers, downloads or legal pages.

Return at most ${MAX_OVERVIEW_PAGES} URLs, the most complete first, copied exactly from the list. Return an empty list if none fit.

Pages (url | title):
${urls.map((u) => `${u.url}${u.title ? ` | ${u.title}` : ""}`).join("\n")}`,
      }],
    },
  }
}

// ── 2. Collecties op een overzichtspagina ──────────────────────────────

export type OverviewCollection = { name: string; url: string | null; image_url: string | null; description: string | null; category_slug: string | null }
export const OVERVIEW_SCHEMA = {
  type: "object",
  properties: {
    brand_description: { type: ["string", "null"] },
    collections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: ["string", "null"] },
          image_url: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          category_slug: { type: ["string", "null"] },
        },
        required: ["name", "url", "image_url", "description", "category_slug"],
        additionalProperties: false,
      },
    },
  },
  required: ["brand_description", "collections"],
  additionalProperties: false,
} as const

export function overviewRequest(customId: string, brandName: string, pageUrl: string, text: string, images: string[], cats: CategoryLine[]): BatchRequest {
  return {
    custom_id: customId,
    params: {
      model: PIPELINE_MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: { type: "json_schema", schema: OVERVIEW_SCHEMA } },
      // De categorielijst is voor elk verzoek gelijk: cachebaar.
      system: [{ type: "text", text: `Product categories (slug — group › subgroup › kind):\n${categoryMenu(cats)}`, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `You are cataloguing the brand "${brandName}" for an editorial directory of interior and architecture products.

Below is one page of the brand's website (text with [links](...) and ![images](...)), followed by every image URL found on the page. List the brand's COLLECTIONS on this page: the named product lines, series or families the brand itself uses ("Mito", "Sento", "b3", "Bart"). When the brand names each product individually instead of grouping them into lines (a fitness brand with a treadmill "IRENA" and a rowing machine "VARTA"), each named product counts as a collection.

Do NOT include: sizes, colours or variants of one line; generic categories ("Pendant lights", "Sofas", "Outdoor"); navigation and utility pages; seasonal groupings ("Novelties 2026"); accessories, spare parts, gift cards; other brands.

For each collection:
- name: as the brand writes it, normal capitalisation, without the brand name or trademark signs;
- url: the absolute URL of its own page on this site, or null;
- image_url: the image that shows it on this page — take it from the page text or, when the text has none next to it, from the image list (match on file name or position); the largest version available; or null;
- description: one short sentence from the page, or null;
- category_slug: what kind of product it is, as the most specific slug from the category list that covers the whole collection (a kind if it is one kind of product, else its subgroup); null if nothing fits.

Keep the page order. At most 80.

Also give brand_description: one or two editorial sentences in English on what the brand makes and what it is known for, max 240 characters, based on this page; null if the page says nothing usable about the brand.

Page URL: ${pageUrl}

Page content:
${text}

Image URLs on the page:
${images.slice(0, 300).join("\n")}`,
      }],
    },
  }
}

// ── 3. Een collectiepagina lezen ───────────────────────────────────────

export type CollectionRead = {
  description: string | null
  designer: string | null
  launch_year: number | null
  category_slug: string | null
  kind_slugs: string[]
  products: Array<{ name: string; url: string | null; image_url: string | null; kind_slug?: string | null }>
  photos: string[]
}
export const COLLECTION_READ_SCHEMA = {
  type: "object",
  properties: {
    description: { type: ["string", "null"] },
    designer: { type: ["string", "null"] },
    launch_year: { type: ["integer", "null"] },
    category_slug: { type: ["string", "null"] },
    kind_slugs: { type: "array", items: { type: "string" } },
    products: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, url: { type: ["string", "null"] }, image_url: { type: ["string", "null"] }, kind_slug: { type: ["string", "null"] } },
        required: ["name", "url", "image_url", "kind_slug"],
        additionalProperties: false,
      },
    },
    photos: { type: "array", items: { type: "string" } },
  },
  required: ["description", "designer", "launch_year", "category_slug", "kind_slugs", "products", "photos"],
  additionalProperties: false,
} as const

export function collectionReadRequest(customId: string, collectionName: string, brandName: string, pageUrl: string, text: string, images: string[], cats: CategoryLine[]): BatchRequest {
  return {
    custom_id: customId,
    params: {
      model: PIPELINE_MODEL,
      max_tokens: 6000,
      output_config: { effort: "low", format: { type: "json_schema", schema: COLLECTION_READ_SCHEMA } },
      system: [{ type: "text", text: `Product categories (slug — group › subgroup › kind):\n${categoryMenu(cats)}`, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `This is the page of the collection "${collectionName}" by the brand "${brandName}" (text with [links](...) and ![images](...)), followed by the image URLs found on it. It is being catalogued for an editorial directory of interior and architecture products.

Give:
- description: one or two sentences in English on what defines this collection, taken from the page; null if nothing usable.
- designer: the person or studio named as its designer, or null.
- launch_year: the year it was introduced, or null.
- category_slug: the most specific slug from the category list that covers the WHOLE collection; a collection spanning several kinds gets their common subgroup. Null if nothing fits.
- kind_slugs: the specific kinds of product it contains, as kind slugs from the list (a lounge chair, a dining table, a treadmill), most important first, at most 8. Outdoor products take the outdoor kinds.
- products: the individual products of THIS collection the page lists (not colour or finish variants, not other collections, accessories or navigation): name in normal capitalisation without the brand name; url of its own page or null; image_url from the image list or null; kind_slug: the most specific kind slug from the category list for this one product (a lounge chair, a footstool), or null. Page order, at most 40.
- photos: the image URLs from the list that show THIS collection — interiors or settings with it in place, studio shots and details — excluding logos, icons, badges, people portraits, PDF thumbnails and images of other collections ("related", "you may also like"). Put interiors and real settings first. At most ${MAX_PHOTO_CANDIDATES}, copied exactly from the list.

Page URL: ${pageUrl}

Page content:
${text}

Image URLs on the page:
${images.slice(0, 200).join("\n")}`,
      }],
    },
  }
}

// ── 4. Sfeerbeelden kiezen (met beeld) ─────────────────────────────────

export type PhotoChoice = { ambiance: number[]; product_shot: number | null }
export const PHOTO_CHOICE_SCHEMA = {
  type: "object",
  properties: {
    ambiance: { type: "array", items: { type: "integer" } },
    product_shot: { type: ["integer", "null"] },
  },
  required: ["ambiance", "product_shot"],
  additionalProperties: false,
} as const

export function photoChoiceRequest(customId: string, collectionName: string, brandName: string, imageUrls: string[]): BatchRequest {
  const content: Array<Record<string, unknown>> = [{
    type: "text",
    text: `These are numbered photos from the page of the collection "${collectionName}" by "${brandName}".

- ambiance: the numbers of the photos that show this collection in a real or styled setting — a room, terrace, garden, pool, with surroundings visible. Not studio cut-outs on a plain background, not close-ups of materials, not photos where the collection is not the subject. Choose at most ${MAX_AMBIANCE_PHOTOS}, best first, and make them varied: different rooms, angles and set-ups rather than near-duplicates of one scene.
- product_shot: the number of the single best studio photo of the product on a plain background, or null if there is none.`,
  }]
  imageUrls.forEach((url, i) => {
    content.push({ type: "text", text: `Photo ${i + 1}:` })
    content.push({ type: "image", source: { type: "url", url } })
  })
  return {
    custom_id: customId,
    params: {
      model: PIPELINE_MODEL,
      max_tokens: 1500,
      output_config: { effort: "low", format: { type: "json_schema", schema: PHOTO_CHOICE_SCHEMA } },
      messages: [{ role: "user", content }],
    },
  }
}
