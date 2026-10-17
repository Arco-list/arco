import "server-only"

/**
 * De koude baan staat tijdelijk dicht. Showcase loopt door.
 *
 * SINDS 17 OKTOBER 2026. Niet omdat outreach faalt — bij gelijke
 * cohortleeftijd staat hij op 2,8%, binnen de band van 2–3% waar het
 * model op gebouwd is. De reden is voorraad.
 *
 * Er staan 2.032 onbenaderde prospects klaar, allemaal met een domein.
 * Je geeft elke prospect één keer uit:
 *
 *   koud mailen, 2,8%                    → ~57 listings
 *   eerst pagina bouwen, showcase 16,7%  → ~340 listings
 *
 * Zelfs onderaan het betrouwbaarheidsinterval van showcase (~6%, n=36)
 * blijft het ruim het dubbele. Elke koude mail die vandaag uitgaat,
 * geeft dus een prospect uit tegen een zesde van zijn waarde — en een
 * eenmaal koud benaderd bedrijf krijgt de showcase-pitch later als
 * tweede indruk in plaats van als eerste.
 *
 * WAT DIT NIET STOPT, met opzet:
 *   - De 452 outreach-opvolgingen die al in email_drip_queue staan
 *     (19 okt t/m 5 nov). Die contacten zijn al uitgegeven; hun
 *     vervolgstappen kosten niets extra en rijpen nog richting die
 *     2,8%. Afkappen gooit listings weg waarvoor al betaald is.
 *   - De showcase-baan. Die deelt dezelfde cron en hetzelfde dagbudget,
 *     dus de poort hieronder filtert per baan en niet per route.
 *   - Invites, en elke stage-mail (visitor-nudge, verified-reminder,
 *     Company Live, de Listed-serie). Die horen bij mensen die al
 *     binnen zijn.
 *
 * WEER AANZETTEN: zet de vlag op false. Dat is de hele ingreep. De
 * cron en de knop op /admin/sales hervatten dan vanzelf, want beide
 * lezen deze constante.
 *
 * DE VRAAG DIE DIT TIJDELIJK HOORT TE MAKEN: hoeveel showcase-pagina's
 * kunnen we per week bouwen? 28 in de week van 10 augustus, daarna
 * 10, 2, 2, 12, 2, 1. Bij 1 à 2 per week is deze pauze duurder dan hij
 * oplevert, want dan ligt de hele koude motor stil voor negen
 * onbenaderde showcase-contacten. Blijft dat antwoord uit, zet hem dan
 * terug op false in plaats van hem te laten staan.
 */
export const COLD_OUTREACH_PAUSED = true

/** Voor logregels en API-antwoorden, zodat een handmatige run zegt
 *  waarom er niets gebeurde in plaats van stil nul terug te geven. */
export const COLD_OUTREACH_PAUSE_REASON =
  "koude outreach staat sinds 17 okt 2026 tijdelijk uit (lib/outreach/cold-pause.ts) — showcase en lopende opvolgingen draaien door"

/**
 * Krijgt deze prospect de showcase-pitch?
 *
 * Spiegelt resolveEffectiveTrack in app/[locale]/admin/sales/actions.ts:
 * het BEDRIJF beslist, niet het bronveld. Een koud Apollo-contact bij
 * een bedrijf waarvoor we inmiddels een pagina bouwden, hoort de
 * showcase-pitch te krijgen — dus die telt hier als showcase en mag
 * door de poort.
 *
 * Staat hier apart zodat de cron de baan kan bepalen uit de rij die hij
 * tóch al ophaalt, zonder per kandidaat een extra bevraging.
 */
export function isShowcaseTrack(row: {
  source?: string | null
  company_id?: string | null
  companies?: { status?: string | null } | null
}): boolean {
  if (row.company_id && row.companies?.status === "prospected") return true
  return row.source === "arco"
}
