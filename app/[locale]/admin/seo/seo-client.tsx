"use client"

import { Fragment, useMemo, useState, useTransition, type CSSProperties } from "react"

import { AdminTabs, useAdminTab } from "@/components/admin/admin-tabs"
import { InfoIcon, SubNumbersCell, TrendlineCell, ValueCell } from "../dashboard/table/table-view"
import {
  GROUP_DEF, GROUP_LABEL, GROUP_OF, MARKET_SIDE, PAGE_GROUPS,
  type PageGroup, type PageType,
} from "@/lib/seo/page-types"
import { SEO_TIMEFRAMES, TIMEFRAME_LABEL, type SeoTimeframe } from "@/lib/seo/timeframes"
import { fetchSeoOverview, type SeoOverview } from "./actions"

/**
 * De SEO-tabel, in de vorm van het groeidashboard.
 *
 * De cellen komen letterlijk daarvandaan (TrendlineCell, ValueCell),
 * niet als kopie: de geometrie — padding, de stippellijn naar de
 * lopende week, de plaatsing van de labels — hoort op één plek te
 * staan. Wat hier bij komt is een formatteerhaak, want vertoningen
 * lezen als 10.498 en een positie als 47,6.
 *
 * UITGEKLAPTE GROEPEN KRIJGEN CIJFERS, GEEN LIJNEN. Het dashboard koos
 * dat bewust voor zijn submetrieken: een stapel kleine grafiekjes onder
 * één ouder maakt er een struikgewas van waarin de lijn van de ouder
 * niet meer opvalt. Zes groepen onder vier metrieken is precies dat
 * geval, dus hier dezelfde keuze.
 */

const FAM = { sup: "#0f766e", acq: "#2563eb" } as const

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Een maandbucket als "aug" tonen en een dagbucket als "4 okt": de
 *  eenheid bepaalt wat er aan het label toegevoegd moet worden om hem
 *  uniek te houden, niet meer dan dat. */
const bucketLabel = (iso: string, tf: SeoTimeframe) => {
  const d = new Date(`${iso}T00:00:00Z`)
  if (tf === "years") return String(d.getUTCFullYear())
  if (tf === "months") return MONTHS[d.getUTCMonth()]
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}


// en-US, niet nl-NL: in een Engelse tabel leest "10.498" als tien komma
// vierhonderdachtennegentig. Punt is hier het duizendtal, komma niet.
const int = (v: number) => (v > 0 ? v.toLocaleString("en-US") : "·")
const dec1 = (v: number) => (v > 0 ? v.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "·")
const pct0 = (v: number) => (v > 0 ? `${Math.round(v)}%` : "·")
const pct2 = (v: number) => (v > 0 ? `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}%` : "·")
/** Search Console levert geen CTR per rij, alleen kliks en vertoningen.
 *  Zelf delen is daarom de enige weg — en nul vertoningen geeft nul,
 *  niet oneindig. */
const ctrOf = (clicks: number | null | undefined, impressions: number) =>
  impressions > 0 ? ((clicks ?? 0) / impressions) * 100 : 0

/** Ondergrens voor de CTR-sortering. Zonder deze staat een zoekopdracht
 *  met één vertoning en één klik bovenaan met 100% — waar en nutteloos.
 *  Gemeten over 28 dagen: van 562 zoekopdrachten hebben er 12 een klik,
 *  en 2 daarvan blijven onder de tien vertoningen. Tien laat dus de echte
 *  tien staan en haalt precies de ruis weg. Rijen eronder krijgen −1 als
 *  sorteerwaarde: ze blijven zichtbaar, maar zakken onder de nullen. */
const CTR_MIN_IMPRESSIONS = 10
const ctrSortValue = (clicks: number | null | undefined, impressions: number) =>
  impressions >= CTR_MIN_IMPRESSIONS ? ctrOf(clicks, impressions) : -1

/** Grove verwachtingscurve voor CTR per positie. Geen meting van Arco maar
 *  de bekende vorm van een zoekresultatenpagina: plek 1 pakt het leeuwendeel,
 *  daaronder zakt het hard, en voorbij de eerste pagina is alles ruis.
 *
 *  Hij is er niet om precies te zijn maar om de VERHOUDING te kleuren. Een
 *  vaste CTR-drempel zou 0,3% op positie 50 rood maken (terwijl dat normaal
 *  is) en 0,3% op positie 3 groen laten (terwijl dat een titelprobleem is).
 *  Precies die omkering was de vondst bij Pro detail: positie 8,5 met 0,51%
 *  waar 2 à 3% hoort — geen rankingprobleem maar een titelprobleem. */
const expectedCtr = (pos: number): number =>
  pos <= 1 ? 28 : pos <= 2 ? 15 : pos <= 3 ? 11 : pos <= 4 ? 8
  : pos <= 5 ? 6 : pos <= 10 ? 3 : pos <= 20 ? 1 : 0.3

/** Groen vanaf 80% van wat op die plek normaal is, oranje onder 40%.
 *  Daartussen geen kleur: dat is gewoon gemiddeld, en een tabel die alles
 *  kleurt zegt niets meer. Onder de vertoningsdrempel ook geen kleur —
 *  met acht vertoningen weet je het nog niet. */
const ctrTone = (clicks: number | null | undefined, impressions: number, pos: number | null): Tone => {
  if (pos == null || impressions < CTR_MIN_IMPRESSIONS) return undefined
  const ratio = ctrOf(clicks, impressions) / expectedCtr(pos)
  return ratio >= 0.8 ? "good" : ratio < 0.4 ? "warn" : undefined
}

/** Positie is absoluut, dus hier wel vaste banden: eerste pagina groen,
 *  voorbij de tweede oranje, daartussen niets. */
const posTone = (pos: number | null): Tone =>
  pos == null ? undefined : pos <= 10 ? "good" : pos > 20 ? "warn" : undefined

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}>
    <path d="M3 2L7 5L3 8" stroke="#a1a1a0" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </svg>
)

type Field = "u" | "i" | "c" | "p"

type Metric = {
  key: string
  label: string
  family: keyof typeof FAM
  field: Field
  tip: string
  format: (v: number) => string
  sub: { label: string; tip?: string; format: (v: number) => string; calc: (keys: PageType[]) => number[] }
}

/**
 * Versheid als statuspil naast de tabs, in plaats van een
 * waarschuwingsbalk boven de pagina.
 *
 * Een balk is een onderbreking: hij duwt de hele pagina omlaag en is
 * even luid of het nu één dag of negen dagen scheelt. De cijfers zijn
 * bijna altijd oud — Search Console loopt zelf twee dagen achter — dus
 * twee dagen is zo vers als het worden kan. Pas boven de vier dagen is
 * er iets mis, en dan is het geen vertraging maar een cron die niet
 * draait. De pil zegt het altijd en schreeuwt alleen als het moet.
 *
 * Zelfde vormgeving als de sync-pil op het groeidashboard, maar zonder
 * klik: er is voor deze bron geen server action om handmatig te syncen.
 */
function FreshnessBadge({ lastDate, staleDays }: { lastDate: string | null; staleDays: number | null }) {
  if (!lastDate || staleDays == null) {
    return (
      <span className="status-pill" style={{ borderColor: "#fde68a", color: "#92400e" }} title="No rows in seo_page_metrics.">
        <span className="status-pill-dot bg-amber-400" />
        no data
      </span>
    )
  }
  const stale = staleDays > 4
  return (
    <span
      className="status-pill"
      style={{ borderColor: stale ? "#fde68a" : "#bbf7d0", color: stale ? "#92400e" : "#166534" }}
      title={
        stale
          ? `Newest row ${lastDate}. Search Console runs two days behind; more than that means /api/cron/sync-seo-pages is not running.`
          : `Newest row ${lastDate}. Search Console itself runs two days behind, so this is as current as it gets.`
      }
    >
      <span className={`status-pill-dot ${stale ? "bg-amber-400" : "bg-emerald-500"}`} />
      {staleDays === 0 ? "today" : `${staleDays}d ago`}
    </span>
  )
}

export function SeoClient({ initialData }: { initialData: SeoOverview }) {
  const [data, setData] = useState(initialData)
  const [pending, startTransition] = useTransition()

  // Tijdvak in state en niet in de URL: het hoort bij de metriektab en
  // verandert vaak, terwijl de tab zelf gedeeld en teruggeknopt wordt.
  const changeTimeframe = (tf: SeoTimeframe) => {
    if (tf === data.timeframe) return
    startTransition(async () => setData(await fetchSeoOverview(tf)))
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>({ vertoningen: true })
  const [sectionOpen, setSectionOpen] = useState(true)
  // In de URL, zoals het dashboard: verversen, de terugknop en een
  // gedeelde link komen allemaal op dezelfde tab uit.
  const view = useAdminTab(["metrics", "top10"] as const)
  const [side, setSide] = useState<"all" | "pro" | "project" | "arco">("all")

  const { weeks, types, published } = data
  const W = weeks.length
  const allTypes = Object.keys(types) as PageType[]

  const sum = useMemo(
    () => (keys: PageType[], field: "u" | "i" | "c" | "i10") =>
      Array.from({ length: W }, (_, i) => keys.reduce((a, k) => a + (types[k]?.[field][i] ?? 0), 0)),
    [types, W],
  )

  // Positie weegt op vertoningen: anders telt een pagina die één keer
  // verscheen even zwaar als een die er 8.000 haalde.
  const weightedPos = useMemo(
    () => (keys: PageType[]) =>
      Array.from({ length: W }, (_, i) => {
        let num = 0
        let den = 0
        for (const k of keys) {
          const p = types[k]?.p[i]
          const imp = types[k]?.i[i] ?? 0
          if (p != null && imp > 0) { num += p * imp; den += imp }
        }
        return den ? Number((num / den).toFixed(1)) : 0
      }),
    [types, W],
  )

  const series = (keys: PageType[], field: Field) => (field === "p" ? weightedPos(keys) : sum(keys, field))

  const ratio = (a: number[], b: number[], scale = 1) =>
    a.map((v, i) => (b[i] ? Number(((scale * v) / b[i]).toFixed(2)) : 0))

  const METRICS: Metric[] = [
    {
      key: "ranked", label: "Ranked pages", family: "sup", field: "u", format: int,
      tip: "Unique URLs that actually appeared in a search result this period — from Search Analytics. Not the same as indexed, which comes from the URL Inspection API: a page can sit in the index and never be shown, and the two regularly disagree.",
      sub: {
        label: "% Ranked", format: pct0,
        tip: "Ranked pages divided by what the sitemap says we publish. That count has only recently started being recorded nightly, so earlier periods are measured against today's sitemap and read too low.",
        calc: (keys) => {
          // De restbak telt aan GEEN van beide kanten mee. Dat zijn per
          // definitie pagina's die we niet aanbieden — /reset-password,
          // een filter-URL met querystring — dus ze horen niet in "van
          // wat we aanbieden is dit deel ranked". Ze zaten wel in de
          // teller en niet in de noemer, wat het totaal omhoog duwde
          // tegen een noemer die ze niet kende.
          const counted = keys.filter((k) => (published[k] ?? 0) > 0)
          const total = counted.reduce((a, k) => a + (published[k] ?? 0), 0)
          return sum(counted, "u").map((v) => (total ? Math.round((100 * v) / total) : 0))
        },
      },
    },
    {
      key: "vertoningen", label: "Impressions", family: "acq", field: "i", format: int,
      tip: "How often one of our pages appeared in a search result. A per-period flow, not a rolling window.",
      sub: {
        label: "Impressions per ranked page", format: dec1,
        tip: "Divided by the pages that actually appeared, not by everything we publish: a page that was never shown cannot produce an impression and would only dilute the figure.",
        calc: (keys) => ratio(sum(keys, "i"), sum(keys, "u")),
      },
    },
    {
      key: "klikken", label: "Clicks", family: "acq", field: "c", format: int,
      tip: "The only thing that turns into a visitor.",
      sub: {
        label: "CTR", format: pct2,
        tip: "Clicks divided by impressions.",
        calc: (keys) => ratio(sum(keys, "c"), sum(keys, "i"), 100),
      },
    },
    {
      key: "positie", label: "Avg. position", family: "acq", field: "p", format: dec1,
      tip: "Weighted by impressions — otherwise a page shown once counts as heavily as one shown 8,000 times.",
      sub: {
        label: "% impressions in positions 1–10", format: pct0,
        tip: "An approximation: Google gives no per-impression position distribution, only a daily average per URL. This counts impressions from URLs whose average that day was 10 or better.",
        calc: (keys) => ratio(sum(keys, "i10"), sum(keys, "i"), 100).map(Math.round),
      },
    },
  ]

  const labels = weeks.map((w) => bucketLabel(w, data.timeframe))

  const timeframes = (
    <div className={`flex items-center gap-1 border border-[#e5e5e4] rounded-[3px] overflow-hidden ${pending ? "opacity-50" : ""}`}>
      {SEO_TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          type="button"
          onClick={() => changeTimeframe(tf)}
          aria-pressed={data.timeframe === tf}
          className={`px-2 sm:px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
            data.timeframe === tf ? "bg-[#1c1c1a] text-white" : "text-[#6b6b68] hover:bg-[#fafaf9]"
          }`}
        >
          <span className="sm:hidden">{TIMEFRAME_LABEL[tf].short}</span>
          <span className="hidden sm:inline">{TIMEFRAME_LABEL[tf].long}</span>
        </button>
      ))}
    </div>
  )

  const chips = (
    <div className="flex items-center gap-1 border border-[#e5e5e4] rounded-[3px] overflow-hidden">
      {(["all", "pro", "project", "arco"] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => setSide(s)}
          aria-pressed={side === s}
          className={`px-2 sm:px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
            side === s ? "bg-[#1c1c1a] text-white" : "text-[#6b6b68] hover:bg-[#fafaf9]"
          }`}
        >
          {s === "all" ? "All" : { pro: "Pro", project: "Project", arco: "Arco" }[s]}
        </button>
      ))}
    </div>
  )

  const queries = data.queries[side] ?? []
  const pages = data.pages.filter((p) => side === "all" || p.side === side)
  const sideLabel = { all: "all types", pro: "Pro", project: "Project", arco: "Arco" }[side]

  return (
    <>
      <AdminTabs
        title="SEO"
        tabs={[
          { key: "metrics", label: "Metrics" },
          { key: "top10", label: "Top 10" },
        ]}
        active={view}
        /* De filter werkt alleen op de twee tabellen, dus hij hoort
           alleen daar in de balk te staan. */
        actions={view === "top10" ? chips : timeframes}
      />

      {/* Versheid — zweeft in de ruimte onder de stickybalk, met nul
          hoogte zodat hij de pagina niet omlaag duwt. Zelfde plaatsing
          als de syncpil op het groeidashboard. */}
      <div className="wrap" style={{ position: "relative", height: 0 }}>
        <div className="absolute right-5 md:right-[60px]" style={{ top: 12 }}>
          <FreshnessBadge lastDate={data.lastDate} staleDays={data.staleDays} />
        </div>
      </div>

      {/* Inline padding, geen pt-/pb-klassen: .wrap zet in globals.css de
          padding-SHORTHAND (0 60px), ongelaagd, en ongelaagde CSS wint
          van elke Tailwind-utility. Een pt-9 hier wordt stil genegeerd —
          vandaar dat het dashboard op zijn .wrap ook een inline stijl
          gebruikt.

          De 52 hangt vast aan de versheidspil hierboven: die staat op
          top 12 en is 18px hoog (.status-pill — 10px regel, 2px padding
          boven en onder, 1px rand), dus er blijft 22px onder over. Stond
          op 36, waardoor dat 6px was en de pil tegen de kolomkoppen
          plakte. De 52 is overgenomen van het groeidashboard, dat exact
          dezelfde pil op dezelfde top-12 zet — twee adminpagina's met
          hetzelfde element horen er dezelfde ruimte omheen te hebben.
          Verander je het een, trek dan het ander mee. */}
      <div className="wrap" style={{ paddingTop: 52, paddingBottom: 96 }}>

        {view === "metrics" && (W === 0 ? (
          <div className="border border-dashed border-[#d4d4d3] rounded-[3px] p-8 bg-[#FAFAF9] text-[#6b6b68] text-sm">
            No Search Console data yet. The cron <code>/api/cron/sync-seo-pages</code> fills{" "}
            <code>seo_page_metrics</code>; with <code>?days=480</code> it pulls everything Google retains.
          </div>
        ) : (
          <div className="arco-table-wrap rounded-[3px]">
            <table className="arco-table md:table-fixed" style={{ minWidth: 0 }}>
              <colgroup className="hidden md:table-column-group">
                <col style={{ width: "30%" }} />
                <col />
              </colgroup>
              <thead className="hidden md:table-header-group">
                <tr>
                  <th style={{ textAlign: "left" }}>Metric</th>
                  <th>
                    <div className="relative" style={{ height: 16 }}>
                      {labels.map((l, i) => (
                        <span
                          key={l}
                          className="absolute whitespace-nowrap"
                          style={{
                            left: `${6 + (i / Math.max(labels.length - 1, 1)) * (100 - 12)}%`,
                            transform: "translateX(-50%)",
                            color: i === labels.length - 1 ? "#c4c4c2" : undefined,
                          }}
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={2} style={{ background: "white" }}>
                    <button
                      type="button"
                      onClick={() => setSectionOpen((o) => !o)}
                      className="flex items-center gap-2"
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    >
                      <Chevron open={sectionOpen} />
                      <span className="arco-eyebrow text-[#a1a1a0]">Search results</span>
                    </button>
                  </td>
                </tr>

                {sectionOpen && METRICS.map((m) => (
                  <MetricBlock
                    key={m.key}
                    metric={m}
                    labels={labels}
                    allTypes={allTypes}
                    series={series}
                    open={!!expanded[m.key]}
                    onToggle={() => setExpanded((e) => ({ ...e, [m.key]: !e[m.key] }))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {view === "top10" && (
          <>
          {/* ── tabellen ─────────────────────────────────────────── */}
          <div className="grid gap-5 md:grid-cols-2">
            <Panel
              title="Top 10 queries"
              scope={`${sideLabel} · 28 days`}
              rows={queries}
              rowKey={(q) => q.query}
              empty="No queries for this type yet."
              cols={[
                { key: "query", label: "Query", sort: (q) => q.query,
                  cell: (q) => <td className="text-[12.5px] max-w-[230px] truncate" title={q.query}>{q.query}</td> },
                { key: "impressions", label: "Impr.", sort: (q) => q.impressions,
                  cell: (q) => <Num v={int(q.impressions)} /> },
                { key: "clicks", label: "Clicks", sort: (q) => q.clicks ?? 0,
                  cell: (q) => <Num v={q.clicks ? String(q.clicks) : "·"} dim={!q.clicks} /> },
                { key: "ctr", label: "CTR", sort: (q) => ctrSortValue(q.clicks, q.impressions),
                  cell: (q) => <Num v={pct2(ctrOf(q.clicks, q.impressions))} dim={!q.clicks} tone={ctrTone(q.clicks, q.impressions, q.position)} /> },
                { key: "position", label: "Pos.", sort: (q) => q.position ?? 999,
                  cell: (q) => <Num v={q.position != null ? dec1(q.position) : "·"} tone={posTone(q.position)} /> },
              ]}
            />

            <Panel
              title="Top 10 pages"
              scope={`${sideLabel} · 28 days`}
              rows={pages}
              rowKey={(p) => p.url}
              empty="No pages for this type yet."
              cols={[
                { key: "page", label: "Page", sort: (p) => p.url,
                  cell: (p) => <td className="max-w-[230px] truncate" title={p.url}><code className="text-[11.5px]">{p.url}</code></td> },
                { key: "impressions", label: "Impr.", sort: (p) => p.impressions,
                  cell: (p) => <Num v={int(p.impressions)} /> },
                { key: "clicks", label: "Clicks", sort: (p) => p.clicks ?? 0,
                  cell: (p) => <Num v={p.clicks ? String(p.clicks) : "·"} dim={!p.clicks} /> },
                { key: "ctr", label: "CTR", sort: (p) => ctrSortValue(p.clicks, p.impressions),
                  cell: (p) => <Num v={pct2(ctrOf(p.clicks, p.impressions))} dim={!p.clicks} tone={ctrTone(p.clicks, p.impressions, p.position)} /> },
                { key: "position", label: "Pos.", sort: (p) => p.position ?? 999,
                  cell: (p) => <Num v={p.position != null ? dec1(p.position) : "·"} tone={posTone(p.position)} /> },
              ]}
            />
          </div>

          <p className="text-xs text-[#a1a1a0] mt-3 max-w-[80ch]">
            <strong className="text-[#6b6b68]">The two tables do not add up to the same total, and they are not meant to.</strong>{" "}
            Google deduplicates per dimension set: with <code>page × query</code> a single search result containing
            two of our pages counts twice, with <code>page</code> only once. The query table therefore runs
            structurally higher. Not a sync error.
          </p>
          </>
        )}
      </div>
    </>
  )
}

/**
 * Eén metriek met zijn conversierij en, uitgeklapt, zijn groepen.
 *
 * Eigen component om dezelfde reden als MetricRowComponent op het
 * dashboard: een metriek en de rijen die eraan hangen zijn aparte
 * <tr>'s, dus een CSS :hover licht er maar één van op. De hover-groep
 * wordt hier bijgehouden zodat het hele blok tegelijk kleurt.
 */
/** Hoe hard de percentageregel omhoog wordt getrokken in de lege
 *  onderruimte van de sparkline erboven. 16 is de waarde die het
 *  groeidashboard voor zijn eerste ouder-CR gebruikt; die pagina is hier
 *  de norm, dus dit getal hoort hetzelfde te zijn.
 *
 *  Heeft even op 8 gestaan om de rijen lucht te geven. Dat was
 *  symptoombestrijding: de krapte kwam niet hiervandaan maar van twee
 *  extra klassen op de groepsrijen hieronder, die boven- en onderruimte
 *  weghaalden waar het dashboard dat niet doet.
 *
 *  Label en getallen MOETEN dezelfde waarde gebruiken, anders lopen de
 *  tekst links en de cijfers rechts verticaal uit elkaar. */
const SUB_PULL = 16

/** Dezelfde trek voor een CR onder een GROEPSrij. Het dashboard gebruikt
 *  hier 10 en niet 16, omdat een sub-sparkline minder onderruimte heeft
 *  dan een ouder-sparkline — zie de notitie bij InlineCRCell. */
const SUB_ROW_PULL = 10

function MetricBlock({
  metric: m, labels, allTypes, series, open, onToggle,
}: {
  metric: Metric
  labels: string[]
  allTypes: PageType[]
  series: (keys: PageType[], field: Field) => number[]
  open: boolean
  onToggle: () => void
}) {
  const [hover, setHover] = useState<string | null>(null)
  const color = FAM[m.family]

  const groupProps = (g: string) => ({
    onMouseEnter: () => setHover(g),
    onMouseLeave: () => setHover((cur) => (cur === g ? null : cur)),
  })
  const bg = (g: string): CSSProperties | undefined =>
    hover === g ? { background: "var(--arco-white)" } : undefined

  return (
    <Fragment>
      {/* Ingeklapt is dit een gewone rij met zijn eigen onderrand; pas
          uitgeklapt hangt de conversierij eraan en laat hij die rand weg. */}
      <tr
        className="cursor-pointer arco-cr-attached"
        style={{ borderBottom: "none", ...bg("parent") }}
        onClick={onToggle}
        {...groupProps("parent")}
      >
        <td>
          <div className="flex items-center gap-2">
            <Chevron open={open} />
            <span className="status-pill-dot shrink-0" style={{ background: color }} />
            <span className="text-[12px] font-medium text-[#1c1c1a]">{m.label}</span>
            <InfoIcon definition={m.tip} />
          </div>
        </td>
        <td>
          <TrendlineCell datapoints={series(allTypes, m.field)} labels={labels} color={color} formatFn={m.format} />
        </td>
      </tr>

      {/* De conversie staat er ALTIJD, ook ingeklapt — zoals de rijen op
          het dashboard die geen subs hebben. Daar luidt de regel: een
          percentage dat niemand kan openklappen is erger dan een
          percentage dat er altijd staat. Hier was hij verstopt achter de
          chevron, waardoor je de belangrijkste helft van een metriek
          (CTR, % ranked) alleen zag als je ernaar zocht.

          arco-cr-attached alleen bij open: dan volgen de groepen en moet
          de rij zijn onderruimte inleveren. Ingeklapt houdt hij die, want
          dan is hij het einde van het blok. */}
      <tr
        className={`arco-cr-row ${open ? "arco-cr-attached" : ""}`}
        style={bg("parent")}
        {...groupProps("parent")}
      >
        <td>
          <div className="flex items-center gap-1.5" style={{ paddingLeft: 31, marginTop: -SUB_PULL }}>
            <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
              {m.sub.label}
            </span>
            <InfoIcon definition={m.sub.tip} />
          </div>
        </td>
        <td>
          <ValueCell values={m.sub.calc(allTypes)} tone="accent" pull={SUB_PULL} formatFn={m.sub.format} />
        </td>
      </tr>

      {open && PAGE_GROUPS.map((g) => {
        const keys = allTypes.filter((t) => GROUP_OF[t] === g)
        // Elke groeps-CR houdt nu zijn onderruimte, ook de laatste: dat
        // is tegelijk de scheiding naar de volgende groep en de adempauze
        // vóór de volgende metriek. Daarmee verviel de isLast-uitzondering.
        return (
          <Fragment key={g}>
            {/* Alleen -attached, net als een sub-rij op het dashboard: de
                onderruimte gaat eraf omdat de conversie eronder hangt, maar
                de bovenruimte blijft. Hier stond ook arco-cr-row, wat die
                bovenruimte óók weghaalde — dat maakte de rijen zichtbaar
                krapper dan dezelfde rijen op /dashboard. */}
            <tr
              className="arco-cr-attached"
              style={{ borderBottom: "none", ...bg(g) }}
              {...groupProps(g)}
            >
              <td>
                <div className="flex items-center gap-2 pl-7">
                  <span className="text-[11px] text-[#1c1c1a]">{GROUP_LABEL[g]}</span>
                  <InfoIcon definition={GROUP_DEF[g]} />
                  {g === "overig" && (
                    <span className="text-[9px] uppercase tracking-[0.06em] text-[#a1a1a0] border border-[#e5e5e4] rounded-[10px] px-1.5">
                      alert
                    </span>
                  )}
                </div>
              </td>
              <td>
                <SubNumbersCell datapoints={series(keys, m.field)} formatFn={m.format} />
              </td>
            </tr>
            {/* Exact de sub-CR van het groeidashboard: alleen
                arco-cr-row, geen eigen padding, pull 10. Zie
                table-view.tsx — "Sub sparklines carry ~10px of bottom
                slack". Hier hebben een tijdje handmatige afwijkingen
                gestaan (pull 0, eigen onderpadding); die maakten het
                verschil met /dashboard groter in plaats van kleiner. */}
            <tr
              className="arco-cr-row"
              style={bg(g)}
              {...groupProps(g)}
            >
              <td>
                <div className="flex items-center gap-1.5 pl-7" style={{ marginTop: -SUB_ROW_PULL }}>
                  <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
                    {m.sub.label}
                  </span>
                </div>
              </td>
              <td>
                <ValueCell values={m.sub.calc(keys)} tone="accent" pull={SUB_ROW_PULL} formatFn={m.sub.format} />
              </td>
            </tr>
          </Fragment>
        )
      })}
    </Fragment>
  )
}

type Tone = "good" | "warn" | undefined

function Num({ v, dim, tone }: { v: string; dim?: boolean; tone?: Tone }) {
  const color = tone === "good" ? "#166534" : tone === "warn" ? "#92400e" : undefined
  return (
    <td
      className={`text-right text-[12.5px] tabular-nums ${!color && dim ? "text-[#c4c4c2]" : ""}`}
      style={color ? { color, fontWeight: 500 } : undefined}
    >
      {v}
    </td>
  )
}

/** Eén kolom van een sorteerbaar paneel: wat er in de kop staat, hoe een
 *  rij wordt getekend, en waarop hij sorteert. Die laatste twee zijn
 *  bewust gescheiden — een cel toont "·" waar de sorteerwaarde 0 is, en
 *  op de tekst sorteren zou alle lege rijen bij elkaar in het midden
 *  zetten in plaats van onderaan. */
type PanelCol<T> = {
  key: string
  label: string
  sort: (row: T) => number | string
  cell: (row: T) => React.ReactNode
}

/** Tabel met sorteerbare koppen. Standaard op de tweede kolom aflopend —
 *  dat is overal vertoningen, en een top 10 die niet op grootte staat is
 *  geen top 10. Klikken wisselt de richting; een andere kolom begint weer
 *  aflopend, want bij deze cijfers is "veel" bijna altijd de vraag. De
 *  enige uitzondering is positie, waar laag juist beter is: die begint
 *  daarom oplopend. */
function Panel<T>({ title, scope, cols, rows, rowKey, empty, limit = 10 }: {
  title: string
  scope: string
  cols: PanelCol<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty: string
  /** De tabel toont er tien, maar kiest wélke tien NA het sorteren —
   *  anders sorteer je alleen binnen de tien grootste. */
  limit?: number
}) {
  // Standaard op CTR: vertoningen zeggen hoe vaak je getoond bent, CTR
  // of dat iets opleverde — en dat laatste is de vraag op deze pagina.
  const [sortKey, setSortKey] = useState(cols.some((c) => c.key === "ctr") ? "ctr" : (cols[1]?.key ?? cols[0].key))
  const [asc, setAsc] = useState(false)

  const sorted = useMemo(() => {
    const col = cols.find((c) => c.key === sortKey)
    if (!col) return rows
    return [...rows].sort((a, b) => {
      const x = col.sort(a)
      const y = col.sort(b)
      const d = typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y))
      return asc ? d : -d
    }).slice(0, limit)
  }, [rows, cols, sortKey, asc, limit])

  const onSort = (key: string) => {
    if (key === sortKey) { setAsc((v) => !v); return }
    setSortKey(key)
    // Positie is de enige kolom waar klein beter is.
    setAsc(key === "position")
  }

  return (
    <div className="arco-table-wrap rounded-[3px]">
      <div className="px-4 py-3 bg-[#FAFAF9] border-b border-[#e5e5e4] flex justify-between gap-2.5">
        <span className="text-xs font-semibold">{title}</span>
        <span className="text-[11px] text-[#a1a1a0]">{scope}</span>
      </div>
      <table className="arco-table" style={{ minWidth: 0 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={c.key} style={{ textAlign: i === 0 ? "left" : "right" }}>
                <button
                  type="button"
                  onClick={() => onSort(c.key)}
                  className="inline-flex items-center gap-1 hover:text-[#1c1c1a] transition-colors"
                  style={{ color: c.key === sortKey ? "var(--arco-black)" : undefined }}
                >
                  {c.label}
                  <span aria-hidden className="text-[8px]" style={{ opacity: c.key === sortKey ? 1 : 0 }}>
                    {asc ? "▲" : "▼"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={cols.length} className="text-[#c4c4c2] text-[12.5px]">{empty}</td></tr>
          ) : sorted.map((row) => (
            <tr key={rowKey(row)}>
              {cols.map((c) => (
                <Fragment key={c.key}>{c.cell(row)}</Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
