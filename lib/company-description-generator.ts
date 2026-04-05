import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

const LOCALE_NAMES: Record<string, string> = { nl: "Dutch", en: "English" }

/**
 * Generate and save a company description (both languages) without requiring auth.
 * Used for auto-generating on first page view.
 * Returns the description in the requested locale, or null on failure.
 */
export async function generateAndSaveCompanyDescription(
  companyId: string,
  locale: string = "en"
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const supabase = createServiceRoleSupabaseClient()

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, description, city, country, founded_year, languages, certificates, services_offered, domain, primary_service_id, translations")
    .eq("id", companyId)
    .single()

  if (!company) return null

  // Don't regenerate if description already exists
  if (company.description?.trim()) return company.description

  // Resolve service names
  let serviceNames: string[] = []
  if (company.services_offered?.length) {
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", company.services_offered)
    serviceNames = (cats ?? []).map(c => c.name).filter(Boolean) as string[]
  }

  // Fetch website content
  let websiteContent = ""
  if (company.domain) {
    try {
      const url = company.domain.startsWith("http") ? company.domain : `https://${company.domain}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "ArcoBot/1.0" },
      })
      clearTimeout(timeout)
      if (res.ok) {
        const html = await res.text()
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[\s\S]*?<\/header>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&[a-z]+;/gi, " ")
          .replace(/\s+/g, " ")
          .trim()
        websiteContent = text.slice(0, 2000)
      }
    } catch {}
  }

  const context = [
    `Company name: ${company.name}`,
    company.city ? `Location: ${company.city}${company.country ? `, ${company.country}` : ""}` : null,
    company.founded_year ? `Founded: ${company.founded_year}` : null,
    serviceNames.length > 0 ? `Services: ${serviceNames.join(", ")}` : null,
    company.languages?.length ? `Languages: ${(company.languages as string[]).join(", ")}` : null,
    company.certificates?.length ? `Certificates: ${(company.certificates as string[]).join(", ")}` : null,
    company.domain ? `Website: ${company.domain}` : null,
    websiteContent ? `Website content:\n${websiteContent}` : null,
  ].filter(Boolean).join("\n")

  const langName = LOCALE_NAMES[locale] ?? "English"

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic()

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You write company descriptions for Arco, a curated marketplace for architecture, interior design and construction professionals in the Netherlands.

Tone: professional, warm, confident. Third-person. Active voice. No superlatives or clichés. Focus on what the company does, their expertise, and what makes them distinctive. 3-4 sentences, 60-80 words. Write in ${langName}. Return only the description text — no quotes, labels, or preamble.

${context}`,
      }],
    })

    const description = message.content.find((b) => b.type === "text")?.text?.trim()?.slice(0, 750)
    if (!description) return null

    // Save and translate
    const otherLocale = locale === "nl" ? "en" : "nl"
    const otherLang = locale === "nl" ? "English" : "Dutch"
    const translations = ((company.translations as Record<string, any>) ?? {})
    if (!translations[locale]) translations[locale] = {}
    translations[locale].description = description

    // Translate to other language
    try {
      const translateMsg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `Translate the following company description to ${otherLang}. Keep the same tone and style. Return only the translated text, no quotes or labels.\n\n${description}`,
        }],
      })
      const translated = translateMsg.content.find((b) => b.type === "text")?.text?.trim()
      if (translated) {
        if (!translations[otherLocale]) translations[otherLocale] = {}
        translations[otherLocale].description = translated.slice(0, 750)
      }
    } catch {}

    await supabase.from("companies").update({ description, translations }).eq("id", companyId)

    return description
  } catch (e) {
    logger.error("Failed to auto-generate company description", { companyId }, e as Error)
    return null
  }
}
