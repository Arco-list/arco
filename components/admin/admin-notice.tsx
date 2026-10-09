import type { ReactNode } from "react"

/**
 * Een melding als derde balk, onder de header en de sub-nav.
 *
 * Als blok binnen de inhoud zat zo'n melding tussen de pagina-elementen
 * en duwde hij de tabel omlaag — terwijl het niet over de tabel gaat
 * maar over de pagina als geheel. Hier is hij full-bleed, met .wrap
 * erbinnen zodat de tekst op dezelfde lijn begint als de rest, en met
 * een onderrand die de reeks balken afmaakt.
 *
 * NIET STICKY, anders dan de twee balken erboven. Die bevatten
 * bediening die bereikbaar moet blijven; dit is een mededeling die je
 * één keer leest. Hem laten meescrollen zou de hele pagina lang ruimte
 * kosten voor iets wat na de eerste regel is begrepen.
 *
 * Bedoeld voor de staat van de pagina — data die achterloopt, een sync
 * die niet draait, een omgeving die niet live is. Niet voor de uitkomst
 * van een handeling: daarvoor is er toast.
 */

export type AdminNoticeTone = "warning" | "danger" | "info"

// Dezelfde drie paren als de alerts elders in de admin, zodat een
// waarschuwing overal dezelfde kleur heeft.
const TONE: Record<AdminNoticeTone, string> = {
  warning: "bg-[#fffbeb] border-[#fde68a] text-[#92400e]",
  danger: "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]",
  info: "bg-[#ECF3F3] border-[#cfe0e0] text-[#015660]",
}

export function AdminNotice({
  tone = "warning",
  children,
  action,
}: {
  tone?: AdminNoticeTone
  children: ReactNode
  /** Rechts in de balk: een link naar waar het probleem op te lossen is. */
  action?: ReactNode
}) {
  return (
    <div className={`border-b ${TONE[tone]}`} role="status">
      <div className="wrap">
        {/* Geen bolletje ervoor: de kleur van de balk zegt al wat voor
            melding het is, en zonder begint de tekst op dezelfde lijn
            als de inhoud eronder. */}
        <div className="flex items-center gap-4 py-3 text-[13px] leading-[1.45]">
          <div className="flex-1 min-w-0">{children}</div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
    </div>
  )
}
