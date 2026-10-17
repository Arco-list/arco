"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { useLocale } from "next-intl"

import { AdminTabs, useAdminTab } from "@/components/admin/admin-tabs"
import { AdminNotice } from "@/components/admin/admin-notice"
import { ReadMoreBody } from "@/components/project/read-more-body"
import type { BrandData } from "./actions"
import { COPY, type Copy, type Lang } from "./copy"

/**
 * Wat Arco is, voor wie, en in welke woorden.
 *
 * DRIE STATEN, NIET TWEE. Een deel staat vast, een deel moet nog beslist
 * worden, en een deel is bewust uitgesteld. Die laatste twee op één hoop
 * gooien leest als onaf terwijl "later" juist een genomen besluit is —
 * vandaar dat elke sectie zijn status draagt in plaats van dat je hem uit
 * de toon moet opmaken.
 *
 * De live cijfers staan erbij waar een sectie al bestaat. Een doelgroep
 * met een getal bestaat; een doelgroep zonder getal is gepland. Dat
 * verschil hoort niemand erbij te onthouden.
 */

/** Duizendtallen volgen de taal van het document: 6.860 of 6,860. */
const fmt = (lang: Lang) => (n: number) => n.toLocaleString(lang === "nl" ? "nl-NL" : "en-US")

/** De tekstboom van de gekozen taal, zodat Tag en de secties hem niet
 *  allemaal als prop hoeven door te geven. */
const CopyContext = createContext<Copy>(COPY.nl)
const useCopy = () => useContext(CopyContext)

type Status = "set" | "open" | "later"

const STATUS_CLS: Record<Status, string> = {
  set: "border-[#016D75] text-[#016D75] bg-[#ECF3F3]",
  open: "border-[#fde68a] text-[#92400e] bg-[#fffbeb]",
  later: "border-[#e5e5e4] text-[#a1a1a0] bg-[#FAFAF9]",
}

function Tag({ s, children }: { s: Status; children?: ReactNode }) {
  const t = useCopy()
  return (
    <span className={`text-[9px] leading-none uppercase tracking-[0.07em] px-[7px] py-[3px] rounded-[10px] border whitespace-nowrap ${STATUS_CLS[s]}`}>
      {children ?? t.status[s]}
    </span>
  )
}

/** Kop binnen een sectie, in de subsectie-typografie van het
 *  ontwerpsysteem — een trap onder .arco-section-title. */
function Heading({ children, aside, className = "" }: {
  children: ReactNode; aside?: string; className?: string
}) {
  return (
    <div className={`flex items-baseline gap-2.5 flex-wrap mb-3 ${className}`}>
      <h3 className="arco-subsection-title m-0">{children}</h3>
      {aside && <span className="text-[11px] text-[#a1a1a0]">{aside}</span>}
    </div>
  )
}

function Section({ n, id, title, children }: {
  n: number; id: string; title: string; children: ReactNode
}) {
  return (
    <section style={{ paddingTop: 46 }}>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <span className="arco-eyebrow text-[#c4c4c2] tabular-nums">{String(n).padStart(2, "0")}</span>
        <h2 className="arco-section-title" id={id} style={{ scrollMarginTop: 140 }}>{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/**
 * De hero als tekst, niet als plaatje.
 *
 * Eerst stond hier de hele homepage-hero nagebouwd: donkere grond,
 * verloop, wit op zwart. Dat toonde de omgeving en niet de regel — en de
 * omgeving staat niet ter discussie. Nu alleen de twee dingen waar een
 * besluit over viel, in de twee klassen waarin ze verschijnen:
 * .arco-hero-title en .arco-eyebrow.
 *
 * 72px is geen willekeurige keuze maar de bovenkant van de live schaal
 * (.arco-hero-title loopt 42–72px op 5,5vw). Op een breed scherm is dit
 * dus exact wat een bezoeker ziet; smaller schaalt hij mee naar beneden.
 *
 * TWEE REGELS MET EEN HARDE AFBREKING, niet met een maxWidth. De regel
 * moet overal hetzelfde breken, en een breedtebeperking laat dat aan het
 * toeval van de schermmaat over. Dit is ook hoe de live hero het doet —
 * twee aparte sleutels met een <br /> ertussen — dus de twee regels
 * hieronder vallen straks één op één samen met hero_line1 en hero_line2.
 */
function HeroLines({ line1, line2, eyebrow, size = 72 }: {
  line1: string; line2: string; eyebrow: string; size?: number
}) {
  return (
    <div className="py-10">
      <h1 className="arco-hero-title m-0" style={{ fontSize: size, lineHeight: 1.05 }}>
        {line1}<br />{line2}
      </h1>
      <p className="arco-eyebrow mt-7 mb-0">{eyebrow}</p>
    </div>
  )
}

/**
 * Het Arco-woordmerk, en "public" nagetekend in hetzelfde systeem.
 *
 * Het logo is een woordmerk: vier losse paden, geen lettertype. "public"
 * kon dus niet gezet worden — het is opgebouwd uit de maten die uit het
 * merk zelf zijn gemeten:
 *
 *   x-hoogte      190,2
 *   stokbreedte    45
 *   buitenstraal   95,1   (bol = x-hoogte, dus perfect rond)
 *   binnenstraal   50,1
 *   letterafstand  21,5   (gemeten tussen de a en de r)
 *
 * DE b HEEFT GEEN VOET: zijn stok loopt van de stokhoogte tot het
 * bolmidden en niet door tot de grondlijn. Op die hoogte raakt de ring
 * precies de stoklijn, en eronder buigt hij naar rechts weg — de ring
 * sluit de vorm dus zelf. Dat is ook de reden dat het bolmidden de
 * juiste stophoogte is en niet de x-hoogte: stopt de stok hoger, dan
 * zweeft hij los boven een cirkel en leest de letter als een o.
 *
 * DE u EN DE b OVERLAPPEN, en de ruimte ertussen is een TERMINAL en
 * geen uitsparing. De bak van de u houdt op bij 52° — dezelfde hoek en
 * dezelfde afgeronde radiale snede als de onderkant van de c verderop
 * in het woord. De u staat daarmee open aan de rechterkant, net als die
 * c, en het woord opent en sluit met hetzelfde gebaar. De b blijft heel
 * en schuift er met zijn stok overheen: die stok staat precies waar de
 * rechterstok van de u zou staan en neemt diens werk over.
 *
 * Een uitsparing — een gat in de b om het wit terug te winnen — werkte
 * hier niet, en dat is leerzaam genoeg om te bewaren. Zo'n gat is geen
 * letterrand: liet je het de stok volgen, dan liep het verticaal langs
 * de u naar beneden en sneed het de bak af, die daar juist naar rechts
 * uitbuigt tot voorbij de stok. Bond je het aan de bol, dan vrat het
 * door de bol van de b. Het wit moet uit de letter zelf komen.
 *
 * Links in de viewBox zit 21,5 aanloop, zodat de afstand tussen de o van
 * het logo en de p gelijk is aan die tussen de p en de u. Zonder die
 * aanloop raken ze elkaar, want het logo-bestand eindigt precies op de
 * rand van de o.
 *
 * OVERSHOOT 4,0 boven en 2,86 onder: de ronde letters steken buiten de
 * x-hoogte uit, de rechte niet. Dat is geen smaak maar een meting aan
 * het logo, op 12 px per eenheid: de bol van de a, de c en de o eindigen
 * daar op 190,2 terwijl de stokken van de a en de r op 187,3 stoppen, en
 * boven staat de stok van de r op 4,0 en elke ronde vorm op 0. Zonder
 * die overshoot stond alles in public op één lijn — intern netjes, maar
 * de l en de i hingen dan 3,5 onder de stokken van arco ernaast, terwijl
 * de ronde letters wél klopten. Ronde vormen die exact op de grondlijn
 * eindigen lezen hoog; vandaar dat het vak dit overal doet.
 *
 * HOEKRADIUS 5,19 op elke platte terminal — gemeten aan de stok van de
 * a, waar de bocht van 190,221 naar 185,031 loopt. Vandaar dat de bak
 * van de u een gevuld pad is en geen stroke: een stroke kan geen
 * hoekradius dragen, alleen een vlakke of halfronde kop. De stok is een
 * eigen rechthoek die er bovenop valt.
 *
 * DE c IS HIER SYMMETRISCH, anders dan in het logo. Daar loopt de
 * opening van 52° boven de horizontaal tot 5° eronder: het onderbeen
 * loopt ver door omdat het ruimte moet maken voor de o die erin haakt.
 * Als sluitletter van "public" haakt er niets in, dus beide benen
 * stoppen op 52° — de hoek van de bovenkant in het merk, gespiegeld.
 *
 * Twee valkuilen zaten in die c, allebei in de boogvlaggen. Een boog
 * linksom is sweep=0 en niet 1, want de y-as wijst omlaag. En de
 * hoekafronding moet VOORBIJ de terminal aanzetten (th + do), niet
 * ervoor: de buitenboog passeert de terminalhoek eerder dan de
 * verschoven hoek, dus met th − do sneed hij er doorheen en liep de
 * terminal spits toe in plaats van afgerond.
 */
function PublicWordmark({ height, color }: { height: number; color: string }) {
  // Gedeeld met het logo ernaast: dat krijgt `height` px voor een viewBox
  // van 191, dus 191 en niet 190,2 is hier de deler. De inkt van het logo
  // is 190,2 hoog in een viewBox van 191 — reken je met 190,2, dan staat
  // public 0,63 eenheid lager dan arco. Dat is onder de pixel op elke
  // maat waarop het slot staat, maar het is wel twee schalen in één woord.
  const scale = height / 191
  return (
    <svg
      viewBox="0 0 913.3 339.8"
      style={{ height: 339.8 * scale, display: "block", color, fill: color }}
      role="img"
      aria-label="public"
    >
      <rect x="21.50" y="78.80" width="45.00" height="261.00" rx="5.19" /><circle cx="116.60" cy="169.90" r="72.60" fill="none" stroke="currentColor" stroke-width="45.0" />
      <rect x="378.40" y="0.00" width="45.00" height="169.90" rx="5.19" /><circle cx="473.50" cy="169.90" r="72.60" fill="none" stroke="currentColor" stroke-width="45.0" />
      <rect x="233.20" y="78.80" width="45.00" height="103.10" rx="5.19" /><path d="M233.20,169.90A95.1,95.1 0 0 0 382.67,247.92A5.19,5.19 0 0 0 383.65,240.75L362.34,213.47A5.19,5.19 0 0 0 354.90,212.36A50.1,50.1 0 0 1 278.20,169.90Z" />
      <rect x="590.10" y="0.00" width="45.00" height="262.14" rx="5.19" />
      <rect x="656.60" y="78.80" width="45.00" height="183.34" rx="5.19" /><circle cx="679.10" cy="30.30" r="22.50" />
      <path d="M872.57,91.88A95.1,95.1 0 1 0 872.57,247.92A5.19,5.19 0 0 0 873.55,240.75L852.24,213.47A5.19,5.19 0 0 0 844.80,212.36A50.1,50.1 0 1 1 844.80,127.44A5.19,5.19 0 0 0 852.24,126.33L873.55,99.05A5.19,5.19 0 0 0 872.57,91.88Z" />
    </svg>
  )
}

function BrandLockup({ suffix, tight, height = 38 }: { suffix?: boolean; tight?: boolean; height?: number }) {
  const H = height
  return (
    <div className="flex items-start" style={{ gap: tight ? 0 : "0.18em" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Arco%20Logo%20Large%20(1).svg"
        alt="Arco"
        style={{ height: H, display: "block", marginTop: (74.8 / 191) * H }}
      />
      {suffix && <PublicWordmark height={H} color="var(--arco-mid, #6b6b68)" />}
    </div>
  )
}

function BrandStorySpecimen() {
  const t = useCopy()
  return (
    <div className="py-8">
      {/* Zelfde uitklap als op de projectpagina: de tekst staat altijd
          in de DOM en wordt alleen verborgen, en de knop is dezelfde
          plus die 45° draait. Hier stond een eigen variant met een
          chevron — twee affordances voor hetzelfde gebaar. */}
      {/* .arco-body-text draagt geen marge — op de projectpagina staan die
          alinea's in een container die dat regelt, hier niet. De afstand
          komt daarom van buitenaf: [&>div] is het uitklapblok onder de
          kern, [&_p+p] zijn de alinea's daarbinnen. 24px is ongeveer één
          regel op 15/1,7, zodat de witruimte tussen alinea's groter is
          dan die binnen een alinea. */}
      <div className="max-w-[58ch] mx-auto text-center [&>div]:mt-6 [&_p+p]:mt-6">
        {/* De pay-off staat op de homepage als kop boven dit verhaal, dus
            hier ook — anders toont het specimen alleen de helft van wat
            de bezoeker leest. 28px in plaats van de 36 van de homepage:
            dat is de seriefmaat die dit document al gebruikt, dus het
            past in de bestaande typeladder in plaats van er een maat
            bij te verzinnen. Verwarring met een sectiekop ligt niet op
            de loer: die staan links uitgelijnd, deze staat gecentreerd
            binnen het specimen. */}
        <p
          className="m-0 mb-5 text-[28px] font-light leading-[1.25]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {t.story.payoff}
        </p>
        <p className="m-0 text-[15px] leading-[1.65]">{t.story.lead}</p>
        <ReadMoreBody
          paragraphs={[t.story.p1, t.story.p2, t.story.p3]}
          moreLabel={t.story.more}
          lessLabel={t.story.less}
        />
      </div>
    </div>
  )
}

/**
 * De drie benefits, in de opmaak van de homepage maar zonder kop en
 * zonder nummering — letterlijk .how-title en .how-body, dezelfde
 * klassen die de blokken daar dragen, zodat dit specimen meegroeit als
 * die opmaak verandert. Stond eerder op een eigen 14px, waardoor het
 * kleiner oogde dan de productblokken verderop in dit document, die wel
 * al die klassen gebruikten.
 *
 * Dit waren de drie items uit de eyebrow, uitgeschreven. Dat is het
 * niet meer: sinds de homepage ze als "Hoe Arco werkt" toont, zijn het
 * drie STAPPEN — ontdekken, de makers vinden, ze benaderen. De eyebrow
 * draagt nu de drie bewijzen (gerealiseerd, vermeld, redactioneel) en
 * deze blokken de route. Verander je het ene, kijk dan of het andere
 * nog klopt; ze lopen niet meer synchroon.
 *
 * Op de homepage staan hier 01-02-03 bij, want daar is het een route.
 * Hier niet: dit specimen staat onder het merkverhaal en toont de
 * teksten, niet de volgorde waarin je ze doorloopt.
 */
function HowSpecimen() {
  const t = useCopy()
  const features = t.benefits()
  // Dezelfde blokvorm als de alternatieven in sectie 3 en de principes
  // in sectie 4: drie kolommen, kop en tekst, verder niets.
  return (
    <div className="grid gap-8 md:grid-cols-3 md:gap-10">
      {features.map((f) => (
        <div key={f.title}>
          <h3 className="how-title">{f.title}</h3>
          <p className="how-body m-0">{f.body}</p>
          {/* Waar deze publieke claim op rust. Het nummer wordt opgezocht
              in sectie 4 in plaats van hier herhaald, zodat het meeschuift
              als de principes van volgorde wisselen — en een principe dat
              wordt hernoemd zonder dat dit meegaat, verdwijnt hier zichtbaar
              in plaats van stil te verwijzen naar iets dat niet bestaat. */}
          <p className="m-0 mt-3 text-[11px] text-[#a1a1a0]">
            {t.benefitsRests}{" "}
            {f.rests
              .map((name) => {
                const i = t.principles.items.findIndex(([title]) => title === name)
                return i < 0 ? null : `${String(i + 1).padStart(2, "0")} ${name}`
              })
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ))}
    </div>
  )
}

/**
 * De zes kanalen uit sectie 3 op twee assen: overzicht en vertrouwen.
 *
 * De coördinaten staan hier en niet in de tekstboom omdat ze geen taal
 * hebben — ze volgen uit de beperkingen die bij elk kanaal staan. Mond-
 * tot-mond scoort hoog op vertrouwen en laag op overzicht omdat daar
 * letterlijk staat "het reikt tot één of twee namen"; gidsen andersom
 * omdat daar "reputatie wordt een score" staat. Verandert een beperking,
 * dan hoort de punt mee te schuiven.
 *
 * ARCO STAAT OP ZIJN BESTEMMING, niet op zijn stand. Het vertrouwen is
 * gebouwd — 313 van de 313 koppelingen loopt via een vakgenoot — maar
 * het volledige overzicht is 101 bureaus en dus nog niet waar. Die punt
 * is een doel en het bijschrift zegt dat erbij; stilzwijgend hoog
 * plotten zou de kaart tot een plaatje maken dat zichzelf gelijk geeft.
 */
const QUADRANT: Record<string, { x: number; y: number; anchor: "start" | "end" }> = {
  "word-of-mouth": { x: 8, y: 92, anchor: "start" },
  referral: { x: 20, y: 82, anchor: "start" },
  editorial: { x: 34, y: 64, anchor: "start" },
  social: { x: 39, y: 19, anchor: "start" },
  directories: { x: 82, y: 30, anchor: "end" },
  search: { x: 92, y: 11, anchor: "end" },
}

const PLOT_H = 260

function QuadrantMap({ channels }: { channels: { key: string; t: string }[] }) {
  const t = useCopy()
  const pts = [
    ...channels.filter((c) => QUADRANT[c.key]).map((c) => ({ ...QUADRANT[c.key], label: c.t, arco: false })),
    { x: 80, y: 84, anchor: "end" as const, label: "Arco", arco: true },
  ]
  // HTML en geen SVG: in een SVG schaalt de tekst mee met de kolom, dus
  // een viewBox van 620 die op 1100 px wordt uitgerekt zet elk label op
  // bijna het dubbele van de bedoelde maat. Hier is het gewone tekst in
  // de klassen van de pagina, en schaalt alleen het vlak.
  return (
    <div className="max-w-[640px] mx-auto">
      <div className="flex gap-2.5">
        {/* Beide assen krijgen dezelfde opbouw: eindpunt — naam — eindpunt,
            op één lijn. De y-as is daarvoor één gedraaide kolom naast het
            vlak, met een vaste hoogte gelijk aan het vlak zodat "laag" en
            "hoog" precies op de uiteinden van de as vallen.

            vertical-rl plus rotate(180deg) keert de inline-as om, dus de
            eerste in de DOM verschijnt ONDERAAN. Vandaar laag, naam, hoog
            in die volgorde. */}
        <div
          className="arco-eyebrow text-[#a1a1a0] flex justify-between self-start"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: PLOT_H }}
        >
          <span className="text-[#c4c4c2]">{t.positioning.lowY}</span>
          <span>{t.positioning.axisY}</span>
          <span className="text-[#c4c4c2]">{t.positioning.highY}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative border-l border-b border-[#e5e5e4]" style={{ height: PLOT_H }}>
            <div className="absolute inset-y-0 left-1/2 w-px bg-[#f2f2f1]" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-[#f2f2f1]" />
            {pts.map((p) => (
              <span key={p.label}>
                <span
                  className={`absolute rounded-full ring-2 ring-white ${p.arco ? "bg-[#1c1c1a]" : "bg-[#8a8a88]"}`}
                  style={{
                    left: `${p.x}%`, top: `${100 - p.y}%`,
                    width: p.arco ? 9 : 7, height: p.arco ? 9 : 7,
                    transform: "translate(-50%, -50%)",
                  }}
                />
                {p.arco ? (
                  // Het woordmerk in plaats van het woord: Arco is het
                  // onderwerp van de kaart en niet nog een kanaal.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/Arco%20Logo%20Large%20(1).svg"
                    alt="Arco"
                    className="absolute"
                    style={{
                      left: `${p.x}%`, top: `${100 - p.y}%`, height: 12,
                      transform: "translate(calc(-100% - 12px), -50%)",
                    }}
                  />
                ) : (
                  <span
                    className="absolute text-[11.5px] whitespace-nowrap text-[#6b6b68]"
                    style={{
                      left: `${p.x}%`, top: `${100 - p.y}%`,
                      transform: p.anchor === "end"
                        ? "translate(calc(-100% - 12px), -50%)"
                        : "translate(12px, -50%)",
                    }}
                  >
                    {p.label}
                  </span>
                )}
              </span>
            ))}
          </div>
          <div className="flex justify-between items-baseline arco-eyebrow mt-2">
            <span className="text-[#c4c4c2]">{t.positioning.low}</span>
            <span>{t.positioning.axisX}</span>
            <span className="text-[#c4c4c2]">{t.positioning.high}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Tabel in de opmaak van de pagina: kop in eyebrow-stijl, hairlines,
 *  eerste kolom zwaarder, cijferkolommen rechts uitgelijnd. */
function Table({ headers, rows, firstCol, numericFrom }: {
  headers: string[]; rows: string[][]; firstCol?: boolean; numericFrom?: number
}) {
  const num = (i: number) => numericFrom !== undefined && i >= numericFrom
  return (
    <div className="border border-[#e5e5e4] rounded-[3px] overflow-x-auto">
      <table className="w-full border-collapse min-w-[760px]">
        <thead><tr>
          {headers.map((h, i) => (
            <th key={h || i} className={`text-[10px] uppercase tracking-[0.09em] text-[#a1a1a0] font-medium px-4 py-2.5 border-b border-[#d4d4d3] bg-[#FAFAF9] whitespace-nowrap ${
              num(i) ? "text-right" : "text-left"
            }`}>{h}</th>
          ))}
        </tr></thead>
        <tbody className="text-[13px]">
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => (
                <td key={i} className={`px-4 py-3 border-b border-[#e5e5e4] align-top ${
                  i === 0 && firstCol ? "font-medium whitespace-nowrap" : "text-[#6b6b68]"
                } ${num(i) ? "text-right tabular-nums whitespace-nowrap" : ""}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Een zoekresultaat zoals Google het toont, voor en na.
 *
 * Googleblauw staat hier als vaste waarde en niet als token: dit is geen
 * element van ons ontwerpsysteem maar een nabootsing van dat van iemand
 * anders. Zou het meebewegen met de merkkleuren, dan is het geen
 * specimen meer maar een illustratie.
 */
function Serp({ tag, url, title, desc, done }: {
  tag: string; url: string; title: string; desc: string; done?: boolean
}) {
  return (
    <div className="border border-[#e5e5e4] rounded-[3px] p-4">
      {/* "in code" en niet "live": het staat geschreven maar is niet
          uitgerold, en dat verschil is op deze pagina het hele punt. */}
      <div className={`arco-eyebrow mb-2 ${done ? "text-[#016D75]" : "text-[#c4c4c2]"}`}>{tag}</div>
      <div className="text-[12px] text-[#6b6b68] mb-1">{url}</div>
      <div className="text-[18px] leading-[1.25] mb-1" style={{ color: "#1a0dab" }}>{title}</div>
      <div className="text-[13px] leading-[1.45] text-[#6b6b68]">{desc}</div>
    </div>
  )
}

export function BrandClient({ data }: { data: BrandData }) {
  const view = useAdminTab(["brand", "seo"] as const)
  // De taal volgt de locale uit de URL, die de taalkiezer in de header
  // zet. Hier stond een eigen NL|EN-pil in de stickybalk: twee knoppen
  // voor dezelfde keuze, die ook nog uit elkaar konden lopen — je kon
  // de header op Engels zetten en dit document op Nederlands houden.
  const lang: Lang = useLocale() === "en" ? "en" : "nl"
  const { proof, audience } = data

  const t = COPY[lang]
  const num = fmt(lang)

  return (
    <CopyContext.Provider value={t}>
      <AdminTabs
        title="Brand"
        tabs={[
          { key: "brand", label: "Brand" },
          { key: "seo", label: "SEO" },
        ]}
        active={view}
      />

      {view === "brand" ? (
        <div className="wrap" style={{ paddingTop: 36, paddingBottom: 96 }}>

          {/* ── 1 ─────────────────────────────────────────── */}
          <Section n={1} id="hero" title={t.sections.hero}>
            {/* De volgorde van de eyebrow is niet vrij: elk item slaat op
                het woord ervóór. "Redactioneel samengesteld" na "makers"
                leest als de redactie die samenstelt; ervóór zou het op de
                architectuur slaan, en die stellen wij niet samen.

                HIER STOND "vertrouwd door architecten". Dat klopte als
                beschrijving van de toelating — elke koppeling loopt via
                een uitnodiging van de architect — maar niet als claim.
                Een architect kiest niet het team dat een project bouwt;
                dat doen de opdrachtgever en de aannemer net zo goed. De
                regel beloofde dus een beslissing die ergens anders valt,
                en sprak bovendien één van de vier doelgroepen aan terwijl
                de huiseigenaar de vraagkant is.

                Erger was dat de ladder zichzelf tegensprak: het
                merkverhaal, de benefits en de vergelijkingstabel zeggen
                allemaal dat het bewijs het gebouwde werk is. Alleen de
                bovenste trede zei iets anders, en dat is juist de trede
                die de rest samenvat.

                "Bewezen" en niet "vertrouwd", om twee redenen. Taalkundig
                neemt "vertrouwd door X" een handelende persoon — met "hun
                werk" op die plek leest het als het werk dat vertrouwt.
                En inhoudelijk: deze pagina noemt overal het bewijs in
                plaats van het oordeel. Vertrouwen is de uitkomst, werk is
                de grond; de grond staat er. Het collegiale deel verdwijnt
                niet, het zakt één trede naar "met eer aan de makers",
                waar het als toegangsbewijs is uitgeschreven. */}
            <HeroLines line1={t.hero.line1} line2={t.hero.line2} eyebrow={t.hero.eyebrow} />
          </Section>

          {/* ── 2 ─────────────────────────────────────────── */}
          <Section n={2} id="merkverhaal" title={t.sections.story}>
            <BrandStorySpecimen />
            <div className="mt-8">
              <HowSpecimen />
            </div>
          </Section>

          {/* ── 3 ─────────────────────────────────────────── */}
          <Section n={3} id="probleem" title={t.sections.problem}>
            <div className="py-8">
              <div className="max-w-[58ch] mx-auto text-center">
                <p className="m-0 text-[15px] leading-[1.65]">{t.problem.statement}</p>
                <p className="mt-6 mb-0 text-[15px] leading-[1.65] text-[#6b6b68]">
                  {t.problem.statementNote}
                </p>
              </div>
            </div>

            <p className="arco-eyebrow text-center mt-7 mb-6">{t.problem.heading}</p>
            {/* Blokken, niet één tabel. De beperkingen zijn het punt van
                deze sectie, en in een tabelcel worden het lopende zinnen
                die je per rij moet uitpluizen. Opgesomd onder een lijn
                staan ze los van elkaar en zie je in één oogopslag dat
                elk kanaal op drie dingen tekortschiet.

                De voorbeelden staan onder de omschrijving en niet naast
                de naam: het kanaal is de categorie, Google is er een
                instantie van. Andersom zou Google de kop worden. */}
            <div className="grid gap-8 md:grid-cols-3 md:gap-10">
              {t.problem.channels.map((c) => (
                <div key={c.t}>
                  <h3 className="text-[14px] font-medium m-0 mb-2">{c.t}</h3>
                  <p className="m-0 text-[14px] leading-[1.6] text-[#6b6b68]">{c.how}</p>
                  <p className="m-0 mt-2.5 text-[12px] text-[#a1a1a0]">{c.ex}</p>
                  <ul className="m-0 mt-4 pt-4 border-t border-[#ebebea] list-none p-0 grid gap-1.5">
                    {c.limits.map((l) => (
                      <li key={l} className="flex gap-2 text-[12.5px] leading-[1.5] text-[#6b6b68]">
                        <span aria-hidden className="text-[#c4c4c2] select-none">—</span>
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {/* ── 4 ─────────────────────────────────────────── */}
          <Section n={4} id="positionering" title={t.sections.positioning}>
            {/* Principes, geen kernwaarden — die staan op Over ons. Een
                waarde zegt wat we belangrijk vinden; een principe stuurt
                een beslissing. Alleen het tweede is bruikbaar als je moet
                kiezen tussen twee features. */}
            {/* Zelfde zetting als de kern van het merkverhaal en de stelling
                bij het probleem: één gecentreerde kolom van 58 tekens op
                15/1,65. Die drie zinnen openen hun sectie en doen hetzelfde
                werk, dus horen ze er hetzelfde uit te zien. */}
            <div className="py-8">
              <div className="max-w-[58ch] mx-auto text-center">
                {/* Harde afbreking na de komma, geen maxWidth — zoals de
                    hero. Een breedtebeperking laat de plek van de breuk
                    aan de schermmaat over; deze regel moet overal op
                    dezelfde plek breken. */}
                <p className="m-0 text-[15px] leading-[1.65]">
                  {t.positioning.core1}<br />{t.positioning.core2}
                </p>
                <p className="mt-6 mb-0 text-[15px] leading-[1.65] text-[#6b6b68]">
                  {t.positioning.coreNote}
                </p>
              </div>
            </div>

            {/* De kaart staat direct onder de kernzin omdat ze hetzelfde
                zegt: de assen zijn letterlijk de twee woorden uit die zin.
                Een eigen kop erboven zou "vertrouwen en overzicht" voor de
                derde keer binnen een halve pagina herhalen. */}
            <QuadrantMap channels={t.problem.channels} />

            <Heading className="mt-12">{t.principles.heading}</Heading>
            <div className="grid gap-8 md:grid-cols-3 md:gap-10">
              {t.principles.items.map(([title, body]) => (
                <div key={title}>
                  <h3 className="text-[14px] font-medium m-0 mb-2">{title}</h3>
                  <p className="m-0 text-[14px] leading-[1.6] text-[#6b6b68]">{body}</p>
                </div>
              ))}
            </div>


          </Section>

          {/* ── 5 ─────────────────────────────────────────── */}
          <Section n={5} id="brands" title={t.sections.brands}>
            {/* Logo, status, body — in die volgorde en strak op elkaar.
                De naam stond er eerst als <h3> boven de tekst, maar het
                woordmerk eronder zegt hem al; die kop herhaalde alleen
                wat het logo toont en duwde de body een regel weg. */}
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <BrandLockup height={15} />
                </div>
                <p className="how-body m-0">{t.brands.arco.body(num(proof.projects))}</p>
              </div>

              <div>
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <BrandLockup suffix tight height={15} />
                  <Tag s="later" />
                </div>
                <p className="how-body m-0">{t.brands.public.body}</p>
              </div>
            </div>
          </Section>

          {/* ── 6 ─────────────────────────────────────────── */}
          <Section n={6} id="doelgroepen" title={t.sections.audiences}>
            {/* .how-number in zijn oorspronkelijke rol: een getal boven de
                naam. Deze sectie deelt die vorm met Products — de twee
                secties beantwoorden dezelfde vraag ("wat hebben we, en
                wat nog niet") en horen er dus hetzelfde uit te zien. Een
                doelgroep die bestaat heeft een getal, een geplande een
                streepje, en dat verschil hoeft niemand erbij te onthouden.

                Onder de tekst staat de MARKT: hoeveel er in Nederland en
                wereldwijd zijn. Dat is een ander soort getal dan het grote
                bovenaan — dat telt wat wij hebben — en daarom staat het
                klein, apart, en met zijn herkomst in de melding eronder.
                Zonder dat onderscheid zou "—" boven "40" lezen als een
                tegenspraak in plaats van als dekking. */}
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
              {t.audiences.items(audience, num).map((a) => (
                <div key={a.t}>
                  {/* Het vak boven de naam draagt het getal, of — als dat
                      er nog niet is — het label dat zegt waarom niet. Een
                      streepje plus een pill naast de titel zei twee keer
                      hetzelfde en liet het vak leeg staan. */}
                  {a.later ? (
                    <div className="flex items-end" style={{ height: 36, marginBottom: 20 }}>
                      <Tag s="later" />
                    </div>
                  ) : (
                    <div className="how-number">{a.n}</div>
                  )}
                  <div className="mb-2.5">
                    <h3 className="how-title m-0">{a.t}</h3>
                  </div>
                  <p className="how-body m-0">{a.b}</p>
                  {a.nl ? (
                    <dl className="m-0 mt-3.5 pt-3 border-t border-[#ebebea] grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                      <dt className="text-[11px] text-[#a1a1a0]">{t.audiences.nl}</dt>
                      <dd className="m-0 text-[12px] tabular-nums text-[#6b6b68]">{a.nl}</dd>
                      <dt className="text-[11px] text-[#a1a1a0]">{t.audiences.world}</dt>
                      <dd className="m-0 text-[12px] tabular-nums text-[#6b6b68]">{a.world}</dd>
                    </dl>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-8">
              <AdminNotice tone="warning">{t.audiences.notice()}</AdminNotice>
            </div>
          </Section>

          {/* ── 7 ─────────────────────────────────────────── */}
          <Section n={7} id="products" title={t.sections.products}>
            {/* Zelfde blokvorm als de doelgroepen: een getal boven de
                naam, en een streepje waar het product nog niet bestaat.
                Stond eerst in omrande kaarten, wat ze zwaarder maakte
                dan de secties eromheen zonder dat er meer in stond. */}
            <div className="grid gap-10 md:grid-cols-3">
              {t.products.items({ payingSubscriptions: audience.payingSubscriptions }, num).map((pr) => (
                <div key={pr.t}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <h3 className="how-title m-0">{pr.t}</h3>
                    {pr.later ? <Tag s="later" /> : null}
                  </div>
                  <p className="how-body m-0">{pr.b}</p>
                  {/* Onder de lijn staat hoe het geld binnenkomt — of dat
                      het nergens vandaan komt. Dat laatste is net zo goed
                      informatie: twee van de zes dragen geen omzet en
                      bestaan omdat ze de andere vier dragen. */}
                  <div className="mt-4 pt-4 border-t border-[#ebebea] text-[12.5px] leading-[1.55] text-[#6b6b68]">
                    {pr.rows.map(([label, price]) => (
                      <div key={label} className="flex justify-between gap-4 py-[1px]">
                        <span>{label}</span>
                        <span className="tabular-nums text-[#1c1c1a]">{price}</span>
                      </div>
                    ))}
                    {pr.m ? <p className={`m-0 ${pr.rows.length ? "mt-2.5" : ""}`}>{pr.m}</p> : null}
                    {/* Het plafond, niet een verwachting: iedere
                        professional of ieder merk op dit abonnement. */}
                    {pr.tam ? (
                      <p className={`m-0 text-[#a1a1a0] ${pr.rows.length ? "mt-2.5" : ""}`}>{pr.tam}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      ) : (
        <div className="wrap" style={{ paddingTop: 36, paddingBottom: 96 }}>
          {/* ── 1 ─────────────────────────────────────────── */}
          <Section n={1} id="formules" title={t.seo.sections.formulas}>
            {/* Eerst alle negen typen in één tabel — ook die zonder
                verkeer, want juist daar wordt nu niets gestuurd. Daarna
                drie uitgewerkte voorbeelden: de drie typen waar de
                formule het meeste verschil maakt. */}
            <Table headers={t.seo.formulas.headers} rows={t.seo.formulas.rows} firstCol numericFrom={3} />
            <p className="text-xs text-[#a1a1a0] mt-3 max-w-[86ch]">{t.seo.formulas.note}</p>

            <div className="grid gap-9 mt-10">
              {t.seo.formulas.items.map((f) => (
                <div key={f.type}>
                  <h3 className="arco-label m-0 mb-3">{f.type}</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Serp tag={t.seo.formulas.pattern} url={f.url} title={f.titlePattern} desc={f.descPattern} />
                    <Serp tag={f.done ? t.seo.formulas.inCode : t.seo.formulas.proposed} url={f.url} title={f.titleNew} desc={f.descNew} done={f.done} />
                  </div>
                  <p className="text-xs text-[#a1a1a0] mt-3 max-w-[90ch]">{f.note}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── 2 ─────────────────────────────────────────── */}
          <Section n={2} id="arco-paginas" title={t.seo.sections.pages}>
            <Table headers={t.seo.pages.headers} rows={t.seo.pages.rows} firstCol />
            <p className="text-xs text-[#a1a1a0] mt-3 max-w-[86ch]">{t.seo.pages.note}</p>
          </Section>

        </div>
      )}
    </CopyContext.Provider>
  )
}
