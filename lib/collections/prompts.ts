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
export const MAX_DETAIL_PHOTOS = 6
export const MAX_PHOTO_CANDIDATES = 24

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
    brand_description_nl: { type: ["string", "null"] },
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
  required: ["brand_description", "brand_description_nl", "collections"],
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

Also give brand_description: three or four editorial sentences in English (60–100 words) on the brand — where it comes from, what it makes, its design language and what it is known for — based on this page, factual and without marketing superlatives; null if the page says nothing usable about the brand. And brand_description_nl: the same text in natural, editorial Dutch (as a Dutch design magazine would write it), or null.

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
  description_nl?: string | null
  designer: string | null
  launch_year: number | null
  category_slug: string | null
  kind_slugs: string[]
  materials?: string[]
  materials_nl?: string[]
  finishes?: string[]
  finishes_nl?: string[]
  products: Array<{ name: string; url: string | null; image_url: string | null; extra_image_urls?: string[]; variants?: string | null; kind_slug?: string | null }>
  photos: string[]
}
export const COLLECTION_READ_SCHEMA = {
  type: "object",
  properties: {
    description: { type: ["string", "null"] },
    description_nl: { type: ["string", "null"] },
    designer: { type: ["string", "null"] },
    launch_year: { type: ["integer", "null"] },
    category_slug: { type: ["string", "null"] },
    kind_slugs: { type: "array", items: { type: "string" } },
    materials: { type: "array", items: { type: "string" } },
    materials_nl: { type: "array", items: { type: "string" } },
    finishes: { type: "array", items: { type: "string" } },
    finishes_nl: { type: "array", items: { type: "string" } },
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: ["string", "null"] },
          image_url: { type: ["string", "null"] },
          extra_image_urls: { type: "array", items: { type: "string" } },
          variants: { type: ["string", "null"] },
          kind_slug: { type: ["string", "null"] },
        },
        required: ["name", "url", "image_url", "extra_image_urls", "variants", "kind_slug"],
        additionalProperties: false,
      },
    },
    photos: { type: "array", items: { type: "string" } },
  },
  required: ["description", "description_nl", "designer", "launch_year", "category_slug", "kind_slugs", "materials", "materials_nl", "finishes", "finishes_nl", "products", "photos"],
  additionalProperties: false,
} as const

export function collectionReadRequest(customId: string, collectionName: string, brandName: string, pageUrl: string, text: string, images: string[], cats: CategoryLine[]): BatchRequest {
  return {
    custom_id: customId,
    params: {
      model: PIPELINE_MODEL,
      max_tokens: 8000,
      output_config: { effort: "low", format: { type: "json_schema", schema: COLLECTION_READ_SCHEMA } },
      system: [{ type: "text", text: `Product categories (slug — group › subgroup › kind):\n${categoryMenu(cats)}`, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `This is the page of the collection "${collectionName}" by the brand "${brandName}" (text with [links](...) and ![images](...)), followed by the image URLs found on it. It is being catalogued for an editorial directory of interior and architecture products.

Give:
- description: three or four sentences in English (60–100 words) on what defines this collection — its form and idea, materials and finishes, where and how it is used, the designer's intent — taken from the page, factual and without marketing superlatives; null if nothing usable.
- description_nl: the same description in natural, editorial Dutch (as a Dutch design magazine would write it), or null.
- designer: the person or studio named as its designer, or null.
- launch_year: the year it was introduced, or null.
- category_slug: the most specific slug from the category list that covers the WHOLE collection; a collection spanning several kinds gets their common subgroup. Null if nothing fits.
- kind_slugs: the specific kinds of product it contains, as kind slugs from the list (a lounge chair, a dining table, a treadmill), most important first, at most 8. Outdoor products take the outdoor kinds.
- materials: the main materials the page names for this collection, short lowercase English nouns ("glass", "brass", "oak", "bouclé fabric"), at most 6; empty if the page names none. materials_nl: the same list in Dutch ("glas", "messing", "eiken", "bouclé stof"), same order.
- finishes: the finishes and colours it comes in, short lowercase English ("matt white", "black", "gold leaf", "natural oak"), at most 10; empty if none are named. finishes_nl: the same list in Dutch, same order.
- products: the individual products of THIS collection the page lists (not colour, finish or size variants, not other collections, accessories or navigation). Sizes and versions of the same piece (Moon 60 / Moon 80 / Moon 120, a table in 200 and 240 cm, a lamp with a marble or a travertine base) are ONE product; when the whole collection is one piece in several sizes, return that one product under the collection's name: name in normal capitalisation without the brand name; url of its own page or null; image_url from the image list or null; extra_image_urls: up to 2 more images from the list that show THIS product from another angle or in another finish (not ambiance shots, not other products), else empty; variants: the sizes or versions folded into this product, as one short line ("Ø 60, 80, 120 cm", "2- and 3-seater", "marble or travertine base"), or null; kind_slug: the most specific kind slug from the category list for this one product (a lounge chair, a footstool), or null. Page order, at most 40.
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

export type PhotoChoice = { ambiance: number[]; detail?: number[]; product_shot: number | null }
export const PHOTO_CHOICE_SCHEMA = {
  type: "object",
  properties: {
    ambiance: { type: "array", items: { type: "integer" } },
    detail: { type: "array", items: { type: "integer" } },
    product_shot: { type: ["integer", "null"] },
  },
  required: ["ambiance", "detail", "product_shot"],
  additionalProperties: false,
} as const

export function photoChoiceRequest(customId: string, collectionName: string, brandName: string, imageUrls: string[]): BatchRequest {
  const content: Array<Record<string, unknown>> = [{
    type: "text",
    text: `These are numbered photos from the page of the collection "${collectionName}" by "${brandName}".

- ambiance: the numbers of the photos that show this collection in a real or styled setting — a room, terrace, garden, pool, with surroundings visible. Not studio cut-outs on a plain background, not close-ups of materials, not photos where the collection is not the subject. Choose at most ${MAX_AMBIANCE_PHOTOS}, best first, and make them varied: different rooms, angles and set-ups rather than near-duplicates of one scene.
- detail: the numbers of the photos that show this collection close up — a zoomed-in view of the piece, a joint, a shade, a material or finish — that are worth showing in a gallery. Not the photos already chosen as ambiance, not the product_shot, not near-duplicates. At most ${MAX_DETAIL_PHOTOS}, best first.
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
