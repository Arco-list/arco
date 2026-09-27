/**
 * The funnel stage a contact is in, and how it looks.
 *
 * Lives in lib rather than beside the Sales table because it is no
 * longer only the Sales table's business: the Outbound popup shows the
 * same stage on the same contact, and a Visitor that reads blue in one
 * place and red in the other is worse than no pill at all.
 *
 * NOT IMPORTED FROM actions.ts. That file is 'use server', and a type
 * pulled from it into anything the client bundles drags the whole
 * server module along — which is how /emails went blank earlier. The
 * union lives here; the server imports it, not the other way round.
 */

export type ProspectStatus =
  | "prospect"
  | "contacted"
  | "visitor"
  | "verified"
  | "owned"
  // Mirror of companies.status 'unlisted' — claimed, page currently
  // hidden. Written only by the company→prospect mirror in
  // syncPlatformProspects; parked under Listed in the funnel.
  | "unlisted"
  | "active"
  | "removed"

/**
 * `dot` is the Tailwind class the tables render; `dotHex` the same
 * colour for surfaces that style inline. They sit on one line per
 * status so a change to either without the other is visible here
 * rather than discovered on screen.
 */
export const PROSPECT_STATUS_CONFIG: Record<
  ProspectStatus,
  { label: string; cls: string; dot: string; dotHex: string }
> = {
  prospect: { label: "Prospect", cls: "bg-amber-50 text-amber-700", dot: "bg-[#f59e0b]", dotHex: "#f59e0b" },
  contacted: { label: "Contacted", cls: "bg-amber-50 text-amber-700", dot: "bg-[#f59e0b]", dotHex: "#f59e0b" },
  visitor: { label: "Visitor", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]", dotHex: "#2563eb" },
  verified: { label: "Verified", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]", dotHex: "#2563eb" },
  owned: { label: "Owned", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]", dotHex: "#2563eb" },
  unlisted: { label: "Unlisted", cls: "bg-gray-50 text-gray-600", dot: "bg-[#a1a1a0]", dotHex: "#a1a1a0" },
  active: { label: "Listed", cls: "bg-purple-50 text-purple-800 font-semibold", dot: "bg-[#7c3aed]", dotHex: "#7c3aed" },
  // Removed never renders in the funnel — the row hides any contact
  // with this status, and the company row drops entirely if every
  // contact is removed. Kept so stray rows don't crash a render.
  removed: { label: "Removed", cls: "bg-gray-50 text-gray-500", dot: "bg-[#a1a1a0]", dotHex: "#a1a1a0" },
}

/** Company statuses, for contacts that have no prospect row. Same
 *  colours the Companies table uses. */
export const COMPANY_STATUS_DOT_HEX: Record<string, string> = {
  added: "#dc2626",
  unclaimed: "#dc2626",
  deactivated: "#dc2626",
  created: "#2563eb",
  verified: "#2563eb",
  owned: "#2563eb",
  listed: "#7c3aed",
  unlisted: "#a1a1a0",
  invited: "#f59e0b",
  prospected: "#f59e0b",
}
