"use client"

import { useTranslations } from "next-intl"

/**
 * Het merkverhaal en de drie claims waarop het rust.
 *
 * De kern staat in de subsectie-typografie en niet in lopende tekst:
 * dit is geen alinea maar de openingsclaim van de sectie, en in
 * body-opmaak las hij als een zwevend stuk tekst boven een kop.
 *
 * GEEN KOP MEER. Hier stond "Hoe Arco werkt" tussen de claim en de drie
 * blokken. Met een openingszin op 28px eronder zou die kop op 36px
 * komen — de kleine boven de grote, dus een omgekeerde hiërarchie. En
 * hij was overbodig: drie niveaus voor één idee, waarvan het middelste
 * alleen aankondigde wat de zin erboven al had gezegd.
 *
 * GEEN NUMMERS MEER. 01-02-03 beloofde een volgorde die er niet is; dit
 * zijn drie onafhankelijke claims die je in elke volgorde kunt lezen.
 */
export function FeaturesSection() {
  const t = useTranslations("home")

  const features = [
    { title: t("feature_1_title"), description: t("feature_1_body") },
    { title: t("feature_2_title"), description: t("feature_2_body") },
    { title: t("feature_3_title"), description: t("feature_3_body") },
  ]

  return (
    <div className="how-section">
      <div className="wrap">
        {/* 58 tekens: de zin is ruim 300 tekens lang, dus op 46 werd het
            een smalle kolom van zeven regels. Rond de 58 blijft hij
            binnen de leesbare bandbreedte en wordt het blok vijf regels
            breed in plaats van hoog. */}
        <p className="arco-subsection-title max-w-[58ch] mx-auto text-center" style={{ marginBottom: 52 }}>
          {t("positioning_body")}
        </p>
        <div className="how-grid">
          {features.map((feature) => (
            <div key={feature.title} className="how-card">
              <h3 className="how-title">{feature.title}</h3>
              <p className="how-body">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
