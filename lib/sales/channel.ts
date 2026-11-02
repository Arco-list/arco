/**
 * Het acquisitiekanaal van een bedrijf — één ladder voor /admin/sales,
 * /admin/companies en de contactkaart.
 *
 * Drie oppervlakken stelden dezelfde vraag en kwamen op drie
 * vocabulaires uit. Het dashboard bracht New Pros terug tot Invites ›
 * Showcase › Outreach › Organisch met Outbound ernaast; Companies bood
 * acht opties waarvan er vier niet konden vullen; Sales plakte elk
 * signaal als extra pill naast de vorige.
 *
 * Twee soorten, en het verschil is het hele punt:
 *
 *   PRIMAIR (exclusief)  invite › showcase › outreach › organic
 *     Precies één per bedrijf. Een upgrade VERVANGT: een koud contact
 *     dat een showcasepagina kreeg is Showcase, niet "Outreach ·
 *     Showcase". Zonder die regel matchte zo'n bedrijf beide filters en
 *     telde het in twee funnelkolommen tegelijk.
 *
 *   OVERLAY (additief)   outbound, email
 *     Komt ERBIJ en vervangt nooit. "Geraakt door outbound" is geen
 *     kanaal maar een aanraking; een showcasebedrijf dat we ook gebeld
 *     hebben hoort onder Showcase én onder Outbound te vallen. Dit is
 *     dezelfde lezing die het dashboard aanhoudt: 'touched by', nooit
 *     'thanks to'.
 *
 * Een upgrade wist de geschiedenis niet, alleen het label. De koude
 * mails blijven in de e-maillog en op de contactkaart staan; het kanaal
 * zegt waar dit bedrijf NU zit.
 */

/** Exclusief: precies één per bedrijf, hoogste bewijs wint. */
export const CHANNEL_ORDER = ["invite", "showcase", "outreach", "organic"] as const
export type Channel = (typeof CHANNEL_ORDER)[number]

/** Additief: komt naast het primaire kanaal, vervangt het nooit. */
export const CHANNEL_OVERLAY_ORDER = ["outbound", "email"] as const
export type ChannelOverlay = (typeof CHANNEL_OVERLAY_ORDER)[number]

export const CHANNEL_LABEL: Record<Channel | ChannelOverlay, string> = {
  invite: "Invite",
  showcase: "Showcase",
  outreach: "Outreach",
  // Dezelfde naam als op het dashboard. Heette 'Direct' op Companies,
  // maar beide betekenen hetzelfde: niemand van ons heeft ze bereikt.
  organic: "Organisch",
  outbound: "Outbound",
  email: "Email",
}

export const channelLabel = (c: string): string =>
  CHANNEL_LABEL[c as Channel | ChannelOverlay] ?? c.charAt(0).toUpperCase() + c.slice(1)

/**
 * Het bewijs waaruit het primaire kanaal volgt. Elk oppervlak vult dit
 * uit zijn eigen kolommen; de ladder hieronder is voor allemaal gelijk.
 */
export type ChannelEvidence = {
  /** Een credit op een gepubliceerd project, of een geconsumeerd
   *  invite-token. Sterkste claim: hun werk staat al op iemands pagina. */
  invite?: boolean
  /** Showcase-bewijs uit lib/sales/showcase-evidence.ts, of een
   *  geconsumeerd showcase-token. */
  showcase?: boolean
  /** Een koude pitch: apollo-herkomst of een geconsumeerd
   *  outreach-token. */
  outreach?: boolean
  /** Ze vonden ons zelf en claimden vanaf de site (claim_tokens.channel
   *  'platform'). Positief bewijs, en daarom sterker dan de
   *  apollo-herkomst eronder: een oude import die nooit op een mail van
   *  ons klikte is organisch binnengekomen, niet via outreach. */
  selfClaimed?: boolean
}

/**
 * Hoogste bewijs wint. `organic` is de bodem, geen bewijs — wie door de
 * hele ladder valt is door niemand van ons bereikt.
 */
export function resolveChannel(ev: ChannelEvidence): Channel {
  if (ev.invite) return "invite"
  if (ev.showcase) return "showcase"
  if (ev.selfClaimed) return "organic"
  if (ev.outreach) return "outreach"
  return "organic"
}

export type ChannelOverlays = { outbound?: boolean; email?: boolean }

/**
 * Of een rij door het kanaalfilter komt.
 *
 * Overlays OR'en naast het primaire kanaal, zodat "Showcase + Outbound"
 * aanvinken alles teruggeeft dat showcase IS of outbound geraakt is —
 * en een showcasebedrijf dat we gebeld hebben onder beide valt. Een
 * lege selectie filtert niet.
 */
export function matchesChannelFilter(
  selected: readonly string[],
  channel: Channel,
  overlays: ChannelOverlays = {},
): boolean {
  if (selected.length === 0) return true
  for (const s of selected) {
    if (s === "outbound") {
      if (overlays.outbound) return true
      continue
    }
    if (s === "email") {
      if (overlays.email) return true
      continue
    }
    if (s === channel) return true
  }
  return false
}

/**
 * Bedrijven die een uitnodiging hebben gekregen — het invite-equivalent
 * van lib/sales/showcase-evidence.ts, en om dezelfde reden.
 *
 * Companies las invite uit de CREDITS op een project. Dat is een
 * huidige stand: trek je de credit later in, dan verdwijnt het bewijs
 * dat we die club ooit hebben uitgenodigd. Arco Testbedrijf heeft twee
 * credits op 'removed' staan en las daardoor niet als invite op
 * Companies, terwijl Sales hem gewoon onder Invite toonde — precies de
 * tegenspraak die we bij Showcase al hadden.
 *
 * De prospectrij met source='invites' wordt door
 * dispatchProfessionalInvite geschreven en nooit meer weggehaald, dus
 * die is het duurzame bewijs. Credits blijven ernaast staan als tweede
 * bron (een bedrijf kan een credit hebben zonder dat er ooit een
 * uitnodiging uitging).
 *
 * Gepagineerd: prospects telt 3.600+ rijen en PostgREST kapt een select
 * zonder range stil af op 1.000. Het filter maakt het nu klein, maar
 * dat is geen eigenschap om op te bouwen.
 */
export async function fetchInviteEvidence(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<Set<string>> {
  const invited = new Set<string>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("prospects")
      .select("company_id")
      .eq("source", "invites")
      .not("company_id", "is", null)
      .order("id")
      .range(from, from + PAGE - 1)
    if (error) break
    const rows = (data ?? []) as Array<{ company_id: string | null }>
    for (const r of rows) if (r.company_id) invited.add(r.company_id)
    if (rows.length < PAGE) break
  }
  return invited
}

/**
 * Bedrijven met minstens één handmatige outbound-aanraking (bellen,
 * afspraak, handmatige mail, LinkedIn — no-answer meegerekend).
 *
 * De log hangt aan een contact, niet aan een bedrijf, en aan twee
 * soorten contact: `prospect_id` voor de salesfunnel en
 * `company_contact_id` voor een contactpersoon op een bestaand bedrijf.
 * Beide worden opgelost, want een bedrijf dat alleen via de tweede weg
 * gebeld is viel anders stil buiten het Outbound-filter.
 */
export async function fetchOutboundTouchedCompanies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<Set<string>> {
  const touched = new Set<string>()

  const { data: logRows } = await supabase
    .from("outbound_contact_log")
    .select("prospect_id, company_contact_id")
  if (!logRows?.length) return touched

  const prospectIds = [...new Set(
    (logRows as Array<{ prospect_id: string | null }>).map((r) => r.prospect_id).filter(Boolean),
  )] as string[]
  const contactIds = [...new Set(
    (logRows as Array<{ company_contact_id: string | null }>).map((r) => r.company_contact_id).filter(Boolean),
  )] as string[]

  const [prospectRes, contactRes] = await Promise.all([
    prospectIds.length
      ? supabase.from("prospects").select("company_id").in("id", prospectIds)
      : Promise.resolve({ data: [] }),
    contactIds.length
      ? supabase.from("company_contacts").select("company_id").in("id", contactIds)
      : Promise.resolve({ data: [] }),
  ])

  for (const r of [...(prospectRes.data ?? []), ...(contactRes.data ?? [])] as Array<{ company_id: string | null }>) {
    if (r.company_id) touched.add(r.company_id)
  }
  return touched
}
