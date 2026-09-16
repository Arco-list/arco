"use client"

import { useState } from "react"

import { CompanyLookup } from "@/components/company-lookup"

/**
 * The shipped lookup, fed fixtures. Three kinds of row, because they
 * are what a reader has to tell apart: a company Arco already knows and
 * someone manages, one that is free to claim, and one we only found
 * because Google has it.
 */
const RESULTS = [
  { key: "arco:1", name: "Tuintechniek van Rijswijk B.V.", city: "Amsterdam", badge: { label: "Claim", tone: "claim" as const } },
  { key: "arco:2", name: "Hollander Techniek", city: "Kampen", badge: { label: "Op Arco", tone: "on-arco" as const }, note: "Hollander Techniek wordt al beheerd door iemand anders." },
  { key: "arco:3", name: "Uniek Speelprojecten", city: null, badge: { label: "Claim", tone: "claim" as const } },
  { key: "place:1", name: "Niekerk (gem. Grootegast)", city: "Niekerk", separated: true },
  { key: "place:2", name: "paardentandarts Niek Jansen", city: "Raalte" },
]

export function CompanyLookupPreview() {
  const [value, setValue] = useState("niek")
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div style={{ maxWidth: 560 }}>
      <CompanyLookup
        label="Bedrijf"
        inputId="design-lookup"
        value={value}
        onChange={setValue}
        placeholder="Zoek een bedrijf..."
        results={value.trim().length >= 2 ? RESULTS : []}
        expandedKey={expanded}
        onSelect={(key) => setExpanded((prev) => (prev === key ? null : key))}
        hint="Staat je bedrijf er niet tussen? Arco is voorlopig alleen open voor bedrijven in Nederland."
      />
    </div>
  )
}
