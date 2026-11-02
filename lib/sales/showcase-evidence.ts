/**
 * Welke bedrijven in het Showcase-kanaal zitten — één antwoord voor de
 * Sales-tabel, de contactkaart en de Companies-tabel.
 *
 * Die drie beantwoordden dezelfde vraag met verschillend bewijs, en gaven
 * daardoor verschillende antwoorden over hetzelfde bedrijf:
 *
 *   contactkaart     verstuurde templates   prospect-* → Showcase
 *   Sales-tabel      prospects.source       apollo     → Outreach
 *   Companies-tabel  companies.source       manual     → Showcase
 *
 * AL architecten kreeg `prospect-intro`, maar kwam ooit uit een Apollo-
 * import. De kaart zei Showcase, de tabel Outreach, Companies Showcase.
 * Alle drie "klopten" binnen hun eigen definitie.
 *
 * Twee dingen die GEEN bewijs zijn, en waarom:
 *
 * `companies.status === 'prospected'` was de hoofdtoets in de tabel. Dat
 * is een huidige stand, geen geschiedenis: zodra een showcasebedrijf
 * daadwerkelijk gaat listen verlaat het die status en zegt de toets
 * "nee". De fout trof dus uitsluitend de geslaagde gevallen — hoe beter
 * showcase werkt, hoe meer bedrijven eruit vielen.
 *
 * Een `arco`-prospectrij lijkt het te zijn maar is het niet. Die wordt
 * alleen gemunt voor een bedrijf dat als showcase binnenkwam ZONDER
 * bestaand contact (zie syncPlatformProspects). Promoveer je een
 * Apollo-contact later naar showcase, dan komt die rij er bewust niet —
 * dus hij mist per constructie elke upgrade.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Alles ophalen, niet de eerste duizend.
 *
 * PostgREST kapt een select zonder range stil af op 1.000 rijen. Met
 * 3.646 prospects betekende dat: welk bedrijf als Showcase werd herkend
 * hing af van waar zijn contactrij toevallig in die eerste duizend viel.
 * Vier bedrijven met een geldige arco-rij vielen zo willekeurig af, en
 * er kwam geen enkele fout uit — het antwoord was gewoon stil verkeerd.
 */
const PAGE = 1000
async function fetchAll<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: (from: number, to: number) => any,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) break
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

/**
 * Wat als showcase-mail telt.
 *
 * Niet alleen de intro-serie: `visitor-nudge-showcase` is de
 * showcase-variant van de bezoekersherinnering en draagt dezelfde
 * pitch. Alleen op `prospect-` matchen liet Zecc Architecten als
 * Outreach lezen terwijl ze juist een showcase-nudge hadden gekregen.
 *
 * Twee patronen in plaats van een prefix, zodat een latere
 * showcase-variant van een stage-mail er vanzelf onder valt zolang
 * "showcase" in de naam staat.
 */
export const SHOWCASE_TEMPLATE_PATTERNS = ["prospect-%", "%showcase%"] as const

export type ShowcaseEvidence = {
  /** Bedrijven met een verstuurde of klaarstaande showcase-mail. */
  pitched: Set<string>
  /** Bedrijven die NU op `prospected` staan — wij hebben een pagina uit
   *  hun werk gebouwd, de pitch moet nog. Companies toont die status
   *  letterlijk als "Showcased", dus een ander kanaal ernaast is een
   *  tegenspraak in één rij. */
  pageBuilt: Set<string>
  /** Bedrijven die als showcase binnenkwamen en inmiddels geconverteerd
   *  zijn — zie `historical` hieronder. */
  historical: Set<string>
}

/** Beide verzamelingen samen: zit dit bedrijf in het Showcase-kanaal? */
export function isShowcase(companyId: string | null | undefined, ev: ShowcaseEvidence): boolean {
  if (!companyId) return false
  return ev.pitched.has(companyId) || ev.historical.has(companyId) || ev.pageBuilt.has(companyId)
}

/**
 * Haalt het bewijs op in drie queries.
 *
 * REGEL 1 — gepitcht. Er is een showcase-mail verstuurd, of er staat er
 * een klaar in de wachtrij. Dit is wat "kanaal" hoort te betekenen:
 * welke pitch heeft dit bedrijf gekregen. Het blijft staan als het
 * bedrijf doorschuift, want een verstuurde mail verdwijnt niet.
 *
 * Een gebouwde pagina waar nog geen mail over uitging telt mee via
 * REGEL 3, niet hier — zie daar waarom.
 *
 * REGEL 2 — historisch. Bedrijven met een `arco`-rij die inmiddels
 * geconverteerd zijn. De showcase-templates bestaan pas sinds midden
 * september; wie daarvóór via showcase binnenkwam en listte heeft die
 * mails nooit gekregen, en regel 1 zou hun geschiedenis herschrijven
 * naar Outreach. Een `arco`-rij betekent "als showcase binnengekomen",
 * en een conversie betekent dat er een pitch geweest is. Samen is dat
 * bewijs genoeg.
 *
 * Expliciet beperkt tot geconverteerde bedrijven; de onbenaderde
 * werkvoorraad hoort bij regel 3.
 *
 * REGEL 3 — pagina gebouwd. Bedrijven die NU op `prospected` staan.
 * Companies toont die status letterlijk als "Showcased", dus er een
 * ander kanaal naast zetten is een tegenspraak binnen één rij — zo las
 * een reeks bedrijven even "Showcased · Direct".
 *
 * Dit is niet dezelfde fout als de oude toets. Die GEBRUIKTE `prospected`
 * als enige bewijs, en verloor daarmee precies de bedrijven die
 * converteerden, want die verlaten die status. Hier staat hij onderaan:
 * regel 1 en 2 vangen de geconverteerde gevallen al op, en regel 3 dekt
 * alleen de groep die nog in de wachtkamer zit.
 *
 * Het blijft wel een werkvoorraad, geen conversiebewijs — wie listing
 * rate per kanaal meet, moet zich realiseren dat deze groep een pagina
 * heeft maar nooit een pitch kreeg.
 */
export async function fetchShowcaseEvidence(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): Promise<ShowcaseEvidence> {
  const pitched = new Set<string>()
  const historical = new Set<string>()
  const pageBuilt = new Set<string>()

  // E-mail → company_id. Beide bewijsregels hangen aan prospects, dus
  // die kaart wordt één keer gebouwd en twee keer gebruikt.
  const prospectRows = await fetchAll<{ email: string | null; company_id: string; source: string | null }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (from, to) => (supabase as any)
      .from("prospects")
      .select("email, company_id, source")
      .not("company_id", "is", null)
      .order("id")
      .range(from, to),
  )

  const companyByEmail = new Map<string, string>()
  const arcoCompanies = new Set<string>()
  for (const r of prospectRows) {
    if (r.email) companyByEmail.set(r.email.toLowerCase(), r.company_id)
    if (r.source === "arco") arcoCompanies.add(r.company_id)
  }

  // PostgREST heeft geen OR-LIKE in één filter, dus één `or()` met beide
  // patronen — goedkoper dan twee rondjes per tabel.
  const orFilter = SHOWCASE_TEMPLATE_PATTERNS.map((p) => `template.like.${p}`).join(",")

  // Verstuurd.
  const sentRows = await fetchAll<{ recipient_email: string | null }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (from, to) => (supabase as any)
      .from("email_events")
      .select("recipient_email")
      .eq("event_type", "sent")
      .or(orFilter)
      .order("id")
      .range(from, to),
  )
  for (const r of sentRows) {
    const id = r.recipient_email ? companyByEmail.get(r.recipient_email.toLowerCase()) : undefined
    if (id) pitched.add(id)
  }

  // Klaarstaand — nog niet verzonden en niet geannuleerd.
  const queuedRows = await fetchAll<{ email: string | null }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (from, to) => (supabase as any)
      .from("email_drip_queue")
      .select("email")
      .is("sent_at", null)
      .is("cancelled_at", null)
      .or(orFilter)
      .order("id")
      .range(from, to),
  )
  for (const r of queuedRows) {
    const id = r.email ? companyByEmail.get(r.email.toLowerCase()) : undefined
    if (id) pitched.add(id)
  }

  // Historisch (arco-rij én geconverteerd) en pagina-gebouwd (nu op
  // `prospected`) komen uit dezelfde statusquery.
  const statusRows = await fetchAll<{ id: string; status: string | null }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (from, to) => (supabase as any)
      .from("companies")
      .select("id, status")
      .in("status", ["listed", "owned", "verified", "prospected"])
      .order("id")
      .range(from, to),
  )
  for (const r of statusRows) {
    if (pitched.has(r.id)) continue
    if (r.status === "prospected") pageBuilt.add(r.id)
    else if (arcoCompanies.has(r.id)) historical.add(r.id)
  }

  return { pitched, historical, pageBuilt }
}
