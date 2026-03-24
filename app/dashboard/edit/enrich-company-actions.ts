"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"

type EnrichCompanyInput = {
  companyId: string
  companyName: string
  website: string | null
  domain: string | null
  editorialSummary: string | null
  googleTypes: string[] | null
  city: string | null
  country: string | null
}

export async function enrichCompanyAction(input: EnrichCompanyInput): Promise<void> {
  const supabase = createServiceRoleSupabaseClient()
  const updateData: Record<string, unknown> = {}

  // AI description generation
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic()
      const context = [
        `Company name: ${input.companyName}`,
        input.city ? `Location: ${input.city}${input.country ? `, ${input.country}` : ""}` : null,
        input.editorialSummary ? `About (from Google): ${input.editorialSummary}` : null,
        input.googleTypes?.length ? `Services: ${input.googleTypes.join(", ")}` : null,
        input.website ? `Website: ${input.website}` : null,
      ].filter(Boolean).join("\n")

      const message = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Write a 2-3 sentence professional company description for an architecture/interior design marketplace listing. Third-person tone, concise, under 300 characters. Focus on what they do and their expertise. Return only the description text, no quotes or labels.\n\n${context}`,
        }],
      })

      const text = message.content.find((b) => b.type === "text")?.text?.trim()
      if (text) {
        updateData.description = text.slice(0, 500)
      }
    } catch {
      // AI generation failed — non-fatal
    }
  }

  // 3. Persist enriched data
  if (Object.keys(updateData).length > 0) {
    await supabase
      .from("companies")
      .update(updateData)
      .eq("id", input.companyId)
  }
}
