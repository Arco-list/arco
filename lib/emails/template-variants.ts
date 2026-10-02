import "server-only"

/**
 * From the name the queue schedules to the template that actually ships.
 *
 * Four drip steps are scheduled under an ABSTRACT id and resolved to a
 * concrete variant at send time, because which variant fits depends on
 * facts about the company that may still change before the mail goes
 * out: whether it publishes its own projects, whether a credit is
 * waiting, which funnel it came in through.
 *
 * That is fine for sending and wrong for previewing. The Contact Card
 * timeline shows a step the moment it is QUEUED, so clicking a pending
 * "Listed Professionals" asked the preview route for
 * `listed-professionals` — an id no renderer has, because the real
 * templates are `-publisher` and `-contributor`. The popup said
 * "Template not found", which reads as a broken mail rather than an
 * unresolved name.
 *
 * So the preview resolves it the same way the sender does, through the
 * sender's own builders. Not a lookup table that guesses: a table would
 * be a second answer to a question the builders already answer, and the
 * two would drift the first time a rule changed.
 */

/**
 * The abstract ids, each listing its variants with the DEFAULT FIRST.
 *
 * The default is what the preview falls back to with no company to ask
 * about — previewing from the /emails template list, say. It matches
 * the degradation the builders themselves pick (see owned-welcome:
 * "degrade to the publisher framing rather than failing the send").
 */
export const ABSTRACT_TEMPLATE_VARIANTS: Record<string, readonly string[]> = {
  "visitor-nudge": ["visitor-nudge-platform", "visitor-nudge-showcase", "visitor-nudge-invite"],
  "owned-welcome": ["owned-publisher", "owned-contributor", "owned-invited"],
  "company-live": ["company-live-publisher", "company-live-contributor"],
  "listed-professionals": ["listed-professionals-publisher", "listed-professionals-contributor"],
}

export function isAbstractTemplate(template: string): boolean {
  return template in ABSTRACT_TEMPLATE_VARIANTS
}

/**
 * Which template a given recipient would actually receive.
 *
 * Returns the input unchanged for every concrete template, so callers
 * can run everything through it. With a company it asks the sender's
 * builder for the real answer; without one it takes the default
 * variant, and the caller is told which id came back so it can say so.
 *
 * ONLY THE TEMPLATE ID is taken from the builders — their `variables`
 * are deliberately discarded. A preview renders the shared fixture, and
 * a popup that quietly swapped in a real company's data would also be
 * handing the "Send test" button a mail about someone else's firm.
 */
export async function resolveTemplateVariant(
  template: string,
  companyId: string | null,
  email: string | null,
): Promise<string> {
  const variants = ABSTRACT_TEMPLATE_VARIANTS[template]
  if (!variants) return template

  const fallback = variants[0]
  if (!companyId) return fallback

  try {
    switch (template) {
      case "visitor-nudge": {
        const { buildVisitorNudge } = await import("@/lib/visitor-nudge")
        const { template: resolved } = await buildVisitorNudge(companyId, email ?? "")
        return resolved
      }
      case "owned-welcome": {
        const { buildOwnedWelcome } = await import("@/lib/owned-welcome")
        const { template: resolved } = await buildOwnedWelcome(companyId, email ?? "")
        return resolved
      }
      case "company-live": {
        const { buildCompanyLive } = await import("@/lib/listed-mails")
        const { template: resolved } = await buildCompanyLive(companyId)
        return resolved
      }
      case "listed-professionals": {
        const { buildListedProfessionals } = await import("@/lib/listed-mails")
        const { template: resolved } = await buildListedProfessionals(companyId)
        return resolved
      }
      default:
        return fallback
    }
  } catch (err) {
    // A preview is not worth failing over. Show the default variant
    // rather than the 404 this whole function exists to prevent.
    console.error("[template-variants] Failed to resolve variant", { template, companyId, err })
    return fallback
  }
}
