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
  const pages = data.pages.filter((p) => side === "all" || p.side === side).slice(0, 10)
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
          gebruikt. */}
      <div className="wrap" style={{ paddingTop: 36, paddingBottom: 96 }}>

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
            <Panel title="Top 10 queries" scope={`${sideLabel} · 28 days`} head={["Query", "Impr.", "Clicks", "Pos."]}>
              {queries.length === 0 ? (
                <tr><td colSpan={4} className="text-[#c4c4c2] text-[12.5px]">No queries for this type yet.</td></tr>
              ) : queries.map((q) => (
                <tr key={q.query}>
                  <td className="text-[12.5px] max-w-[230px] truncate" title={q.query}>{q.query}</td>
                  <Num v={int(q.impressions)} />
                  <Num v={q.clicks ? String(q.clicks) : "·"} dim={!q.clicks} />
                  <Num v={q.position != null ? dec1(q.position) : "·"} warn={(q.position ?? 0) > 20} />
                </tr>
              ))}
            </Panel>

            <Panel title="Top 10 pages" scope={`${sideLabel} · 28 days`} head={["Page", "Impr.", "Clicks", "Pos."]}>
              {pages.length === 0 ? (
                <tr><td colSpan={4} className="text-[#c4c4c2] text-[12.5px]">No pages for this type yet.</td></tr>
              ) : pages.map((p) => (
                <tr key={p.url}>
                  <td className="max-w-[230px] truncate" title={p.url}><code className="text-[11.5px]">{p.url}</code></td>
                  <Num v={int(p.impressions)} />
                  <Num v={p.clicks ? String(p.clicks) : "·"} dim={!p.clicks} />
                  <Num v={p.position != null ? dec1(p.position) : "·"} warn={(p.position ?? 0) > 20} />
                </tr>
              ))}
            </Panel>
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
        className={`cursor-pointer ${open ? "arco-cr-attached" : ""}`}
        style={{ ...(open ? { borderBottom: "none" } : {}), ...bg("parent") }}
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

      {/* De conversie verschijnt pas bij uitklappen — ingeklapt is een
          metriek zijn naam en zijn lijn, net als op het dashboard, waar
          het CR-blok met de subs mee open en dicht gaat.

          arco-cr-attached erbij zodat de rij zijn onderruimte inlevert:
          de conversie hoort tegen de scheidingslijn aan te zitten, en
          die lijn is tegelijk de grens naar de groepen eronder. */}
      {open && (
        <tr className="arco-cr-row arco-cr-attached" style={bg("parent")} {...groupProps("parent")}>
          <td>
            <div className="flex items-center gap-1.5" style={{ paddingLeft: 31, marginTop: -16 }}>
              <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
                {m.sub.label}
              </span>
              <InfoIcon definition={m.sub.tip} />
            </div>
          </td>
          <td>
            <ValueCell values={m.sub.calc(allTypes)} tone="accent" pull={16} formatFn={m.sub.format} />
          </td>
        </tr>
      )}

      {open && PAGE_GROUPS.map((g, gi) => {
        const keys = allTypes.filter((t) => GROUP_OF[t] === g)
        // De laatste groep houdt zijn onderruimte: dat is de adempauze
        // vóór de volgende metriek.
        const isLast = gi === PAGE_GROUPS.length - 1
        return (
          <Fragment key={g}>
            {/* arco-cr-row én -attached: boven- én onderruimte ingeleverd,
                zodat een groep met zijn conversie samen één compacte regel
                vormt in plaats van twee volwaardige tabelrijen. */}
            <tr
              className="arco-cr-row arco-cr-attached"
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
            <tr
              className={`arco-cr-row${isLast ? "" : " arco-cr-attached"}`}
              style={bg(g)}
              {...groupProps(g)}
            >
              <td>
                <div className="flex items-center gap-1.5 pl-7" style={{ marginTop: -10 }}>
                  <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
                    {m.sub.label}
                  </span>
                </div>
              </td>
              <td>
                <ValueCell values={m.sub.calc(keys)} tone="accent" pull={10} formatFn={m.sub.format} />
              </td>
            </tr>
          </Fragment>
        )
      })}
    </Fragment>
  )
}

function Num({ v, dim, warn }: { v: string; dim?: boolean; warn?: boolean }) {
  return (
    <td className={`text-right text-[12.5px] tabular-nums ${warn ? "text-[#92400e] font-semibold" : dim ? "text-[#c4c4c2]" : ""}`}>
      {v}
    </td>
  )
}

function Panel({ title, scope, head, children }: {
  title: string; scope: string; head: string[]; children: React.ReactNode
}) {
  return (
    <div className="arco-table-wrap rounded-[3px]">
      <div className="px-4 py-3 bg-[#FAFAF9] border-b border-[#e5e5e4] flex justify-between gap-2.5">
        <span className="text-xs font-semibold">{title}</span>
        <span className="text-[11px] text-[#a1a1a0]">{scope}</span>
      </div>
      <table className="arco-table" style={{ minWidth: 0 }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? "left" : "right" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
