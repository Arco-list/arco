"use client"

import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"

/**
 * De drie stappen — laag op de pagina, na de projecten en de bureaus.
 *
 * Een gebruiksaanwijzing landt pas als iemand het ding wil. Vlak onder
 * de hero zegt "Ontdek afgerond werk" tegen iemand dat hij moet doen wat
 * hij al aan het doen is; hier is het een antwoord op "en nu?". Stap 3
 * is bovendien de conversiestap, en die hoort pas nadat iemand zowel
 * projecten als bureaus heeft gezien.
 *
 * DE NUMMERS ZIJN TERUG. Zolang dit drie losse claims waren beloofde
 * 01-02-03 een volgorde die er niet was. Nu is die er wel: ontdekken,
 * de makers vinden, ze benaderen is één route, en stap 3 kan niet voor
 * stap 1. Het nummer zegt hier dus iets waars.
 *
 * Stap 1 en 2 dragen een tekstlink in de primaire kleur, stap 3 niet. Dat volgt het
 * werkwoordsysteem: ontdekken hoort bij /projects, vinden bij
 * /professionals, en benaderen heeft geen eigen pagina — dat gebeurt op
 * een bedrijfsprofiel. Een derde link zou dus naar /professionals moeten
 * wijzen en dezelfde bestemming twee keer in één rij zetten. Het gat valt
 * nu aan het eind van de reeks in plaats van in het midden, wat leest als
 * een rij die ophoudt in plaats van als een vergeten regel.
 *
 * Linkse sectiekop in .section-header, zoals Uitgelichte projecten en
 * Populaire architecten. De gecentreerde 36px-kop is van de pay-off;
 * dit is een gewone sectie en moet er ook zo uitzien.
 */
export function HowArcoWorks() {
  const t = useTranslations("home")

  const steps: Array<{
    number: string
    title: string
    description: string
    href?: string
    linkLabel?: string
  }> = [
    { number: "01", title: t("feature_1_title"), description: t("feature_1_body"), href: "/projects", linkLabel: t("link_projects") },
    { number: "02", title: t("feature_2_title"), description: t("feature_2_body"), href: "/professionals", linkLabel: t("link_professionals") },
    { number: "03", title: t("feature_3_title"), description: t("feature_3_body") },
  ]

  return (
    <div className="py-16 max-md:py-10">
      <div className="wrap">
        <div className="section-header">
          <h2 className="arco-section-title">{t("how_arco_works")}</h2>
        </div>
        <div className="how-grid">
          {steps.map((step) => (
            <div key={step.number} className="how-card">
              <div className="how-number">{step.number}</div>
              <h3 className="how-title">{step.title}</h3>
              <p className="how-body">{step.description}</p>
              {step.href ? (
                /* De pijl staat in de markup en niet in de vertaling: met
                   .arco-text-link-label om de woorden valt de onderstreping
                   op de tekst en niet onder de glyph door. */
                <Link href={step.href} className="arco-text-link arco-text-link--primary mt-3">
                  <span className="arco-text-link-label">{step.linkLabel}</span>
                  <span aria-hidden>→</span>
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
