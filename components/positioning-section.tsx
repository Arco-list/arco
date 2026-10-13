"use client"

import { useTranslations } from "next-intl"

/**
 * De pay-off en het merkverhaal, tussen de rail en de uitgelichte
 * projecten.
 *
 * De kop pakt de hero terug: "Uitzonderlijke architectuur." staat daar,
 * "Het netwerk achter uitzonderlijke architectuur." staat hier. Dat
 * scharnier werkt het scherpst als de twee naast elkaar staan, en deze
 * sectie heeft dan ook even direct onder de hero gestaan. Bewust
 * teruggezet: eerst laten bladeren, dan pas vertellen wie erachter zit.
 * Verplaats je hem, houd dan in de gaten dat de echo op de hero
 * verzwakt naarmate er meer tussen staat.
 *
 * Geen band: de homepagina draagt ná de hero één doorlopend wit vlak,
 * en de sectiekoppen doen de scheiding. Deze sectie stond eerst in
 * .how-section grijs; dat zette de uitspraak apart, maar het maakte van
 * de pagina ook een afwisseling van banden in plaats van een doorlopend
 * blad. Ritme en kopformaat zijn nu gelijk aan Hoe Arco werkt.
 */
export function PositioningSection() {
  const t = useTranslations("home")

  return (
    <div className="py-16 max-md:py-10">
      <div className="wrap">
        <h2 className="arco-section-title text-center" style={{ marginBottom: 18 }}>
          {t("positioning_title")}
        </h2>
        {/* 68 tekens op 15px: de zin is ruim 300 tekens lang en blijft zo
            binnen de leesbare bandbreedte, vier a vijf regels breed. */}
        <p className="how-body max-w-[68ch] mx-auto text-center">
          {t("positioning_body")}
        </p>
      </div>
    </div>
  )
}
