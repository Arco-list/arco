import type { ReactNode } from "react"

/**
 * Alle tekst van /admin/brand, in twee talen.
 *
 * HET DOCUMENT IS NEDERLANDS. De Engelse boom staat ernaast omdat het
 * merk tweetalig naar buiten treedt en een claim die alleen in het
 * Nederlands klopt geen claim is — je merkt pas dat "bewezen door hun
 * werk" in het Engels een andere belofte doet als je hem opschrijft.
 *
 * `en` is getypeerd als `typeof nl`, dus een sleutel die hier bijkomt
 * en daar niet, is een bouwfout en geen gat dat je pas op de pagina
 * ziet. Dat is de hele reden dat de tekst uit het component is gehaald.
 *
 * De getallen staan er NIET in: die komen live uit de database en zijn
 * taalonafhankelijk. Waar een zin een getal nodig heeft is de waarde een
 * functie, zodat de volgorde van de zin per taal kan verschillen zonder
 * dat de cijfers meeverhuizen.
 */

export type Lang = "nl" | "en"

export type Products = { payingSubscriptions: number }
/** Expliciet getypeerd zodat een product zonder prijsrijen (rows: []) de
 *  vorm niet vernauwt tot never[] en beide talen dezelfde velden houden. */
export type ProductItem = { t: string; later: boolean; b: string; rows: string[][]; m: string; tam: string }
export type Audiences = {
  homeowners: number; professionalUsers: number
  companiesListed: number; companiesProspected: number
}

const nl = {
  label: "NL",
  other: "EN",

  status: { set: "vastgesteld", open: "te beslissen", later: "later" },

  sections: {
    hero: "Hero",
    story: "Merkverhaal",
    problem: "Probleem",
    positioning: "Positionering",
    brands: "Brands",
    audiences: "Doelgroepen",
    products: "Products",
  },

  hero: {
    line1: "Het netwerk van professionals,",
    line2: "bewezen door hun werk",
    eyebrow: "GEREALISEERDE ARCHITECTUUR · MET EER AAN DE MAKERS · REDACTIONEEL SAMENGESTELD",
  },

  story: {
    more: "Lees meer",
    less: "Minder",
    lead: "Arco is waar toonaangevende architecten hun gerealiseerde werk publiceren en de vakmensen vermelden waarmee ze hebben samengewerkt. Wij helpen opdrachtgevers aan een netwerk van professionals — van interieurontwerper tot aannemer — die hun reputatie hebben verdiend door vakmanschap, niet door reclame.",
    p1: "Een bureau kiezen voor je huis is een dure beslissing op dun bewijs. Wat je online vindt is meestal een render, een moodboard of een profiel dat iemand over zichzelf heeft geschreven. Afgerond werk, gefotografeerd zoals het is opgeleverd, kom je zelden tegen — en dat is juist het enige dat voorspelt wat je krijgt.",
    p2: "Aan de andere kant staan bureaus met tien jaar gebouwd werk en geen neutrale plek om het te laten zien. Hun eigen site is een bewering over zichzelf; een gidsvermelding is een regel in een lijst. Hier staat dat werk op één plek, en iedereen die eraan meewerkte staat erbij — vermeld door de architect, niet door zichzelf.",
    p3: "Herken je je eigen ambitie in een gerealiseerd project, dan is de match gevonden. Je neemt rechtstreeks contact op, zonder tussenpersoon en zonder bemiddelingskosten.",
  },
  benefits: () => [
    {
      title: "Gerealiseerde architectuur",
      body: "Op Arco staan alleen gerealiseerde projecten, professioneel gefotografeerd. Zoek op ruimte, stijl en plaats, en gebruik wat anderen hebben gebouwd als inspiratie voor je eigen project.",
      rests: ["Geen beeld zonder herkomst"],
    },
    {
      title: "Met eer aan de makers",
      body: "Elke professional op een project — aannemer, interieurontwerper, landschapsarchitect — wordt vermeld door de architect waarmee ze hebben samengewerkt. Die vermelding betekent iets.",
      rests: ["Vermeldingen boven reviews"],
    },
    {
      title: "Redactioneel samengesteld",
      body: "Toonaangevende architecten dienen hun afgeronde projecten in en wij beoordelen ze voordat ze online komen. Niet alles haalt het, en een plek is niet te koop.",
      rests: ["Niet iedereen hoort hier", "Geld koopt bereik, nooit geloofwaardigheid"],
    },
  ],
  benefitsRests: "Steunt op",

  problem: {
    statement: "Een professional kiezen voor een project is een dure beslissing op dun bewijs.",
    statementNote: "Een verbouwing of nieuwbouw is een van de grootste uitgaven van een huishouden, en je koopt hem voordat hij bestaat. Je beoordeelt op een portfolio, een gesprek en een gevoel; of je goed hebt gekozen weet je pas twee jaar later. Proberen kan niet, omruilen ook niet, en wat de andere keuze had opgeleverd zie je nooit.",
    heading: "Wat mensen nu gebruiken",
    channels: [
      {
        key: "search",
        t: "Zoeken",
        how: "SEO, advertenties en marketingbudget bepalen wie je bovenaan ziet.",
        ex: "Google",
        limits: [
          "Beloont wie zich het beste verkoopt, niet wie het beste bouwt",
          "Geen zicht op wat iemand werkelijk heeft gerealiseerd",
          "Een advertentie en een vakman zien er hetzelfde uit",
        ],
      },
      {
        key: "social",
        t: "Social media",
        how: "Beeld, geordend door een algoritme dat op populariteit stuurt.",
        ex: "Pinterest · Instagram",
        limits: [
          "Mooi beeld zonder context: welk huis, welke stad, welk budget",
          "De maker staat er vaak niet bij",
          "Geen pad van een opgeslagen foto naar een uitvoerbaar project",
        ],
      },
      {
        key: "word-of-mouth",
        t: "Mond-tot-mond",
        how: "Een persoonlijke aanbeveling van iemand die je kent en vertrouwt.",
        ex: "De eigen kring",
        limits: [
          "Het sterkste signaal dat er is — maar het reikt tot één of twee namen",
          "Je hoort niet over de bureaus die ook hadden gepast",
          "Niets om mee te vergelijken",
        ],
      },
      {
        key: "referral",
        t: "Via een professional",
        how: "De architect noemt een aannemer, de aannemer een interieurontwerper.",
        ex: "De architect · de aannemer · de makelaar",
        limits: [
          "Werkt pas nadat je je eerste keuze al hebt gemaakt",
          "Eén naam per rol, zonder alternatief ernaast",
          "Het netwerk achter een bureau zie je pas als je er al in zit",
        ],
      },
      {
        key: "editorial",
        t: "Redactionele platforms",
        how: "Gecureerde publicaties en portfolio's, gekozen door een redactie.",
        ex: "Archello · Hoog",
        limits: [
          "Gemaakt om te publiceren, niet om te zoeken",
          "Geen filters op ruimte, stijl of plaats",
          "Geen weg van het project naar de mensen erachter",
        ],
      },
      {
        key: "directories",
        t: "Gidsen en marktplaatsen",
        how: "Profielen en reviews, met leads die per stuk worden verkocht.",
        ex: "Werkspot · Houzz",
        limits: [
          "Gestuurd op aantal, niet op niveau",
          "Reputatie wordt een score, en een score valt te bespelen",
          "De bureaus die het niet nodig hebben doen niet mee — precies degenen die je zoekt",
        ],
      },
    ],
  },
  positioning: {
    core1: "Het vertrouwen van een doorverwijzing,",
    core2: "met het overzicht dat een doorverwijzing niet kan geven.",
    coreNote: "Een aanbeveling uit je eigen kring of van je architect is het betrouwbaarste signaal dat er is, en geeft je één naam per vakgebied. Een gids geeft je alle namen en geen enkele reden om er een te geloven. Arco claimt allebei: elke professional die in aanmerking komt, vermeld door een vakgenoot.",
    axisX: "Overzicht",
    axisY: "Vertrouwen",
    low: "weinig",
    high: "veel",
    lowY: "laag",
    highY: "hoog",
  },
  principles: {
    heading: "Principes",
    items: [
      ["Geen beeld zonder herkomst", "Arco toont projecten, professionals en producten in beeld, en elke foto is terug te voeren op zijn bron: een project noemt zijn makers, een product hangt aan het project waarin het staat. In een feed is een foto een plaatje; hier is het een ingang. Geen sfeerbeeld, geen stockfoto, geen productshot die nergens aan hangt."],
      ["Niet iedereen hoort hier", "Arco is high-end. Niet elk project, elke professional of elk product hoort erop. Toegang loopt via een uitnodiging van de architect: 313 van de 313 koppelingen is zo ontstaan. Die grens is de waarde voor de huiseigenaar — wie hier kijkt hoeft niet te filteren — en de verleiding om hem op te rekken is permanent, want elke stap is klein."],
      ["Vermeldingen boven reviews", "Geloofwaardigheid komt uit bevestigde betrokkenheid bij een project — niet uit cijfers, likes of aanbevelingen. Daarom staan er geen sterren in de zoekresultaten, ook al kost dat zichtbaarheid."],
      ["Redactioneel, niet promotioneel", "Projectpagina's lezen als een gepubliceerd artikel, niet als een advertentie. Geen urgentie, geen spelelementen, geen verkooptaal; het gezag komt uit de terughoudendheid."],
      ["Geld koopt bereik, nooit geloofwaardigheid", "Een abonnement kan zichtbaarheid vergroten, tot en met een hogere positie in de zoekresultaten. Het koopt nooit een vermelding, een plek door de selectie, of toegang tot het platform. Je betaalt dat méér mensen je werk zien — niet dat je werk er beter uitziet."],
      ["De besten moeten hier wíllen staan", "Iedereen die aan de selectie voldoet hoort hier te kunnen zijn. Afrekenen per lead, commissie of betaalde toegang verjaagt precies de bureaus en merken die het platform geloofwaardig maken — zij hebben ons niet nodig. Vandaar een abonnement: betalen voor aanwezigheid, niet per klant."],
    ],
  },

  brands: {
    arco: {
      name: "Arco",
      body: (projects: string) =>
        `Woonhuizen, villa's, verbouwingen en interieurs. Alle ${projects} gepubliceerde projecten vallen hieronder.`,
    },
    public: {
      name: "Arco Public",
      body: "Publieke en commerciële projecten. Zolang dit gepland is hoeft de tagline alleen over wonen te gaan — maar hij mag die deur niet dichttimmeren.",
    },
  },

  audiences: {
    nl: "Nederland",
    world: "Wereldwijd",
    items: (a: Audiences, f: (v: number) => string) => [
      {
        t: "Huiseigenaren",
        b: "Accounts met een cliëntrol. De vraagkant: mensen die een bureau zoeken voor hun eigen huis. Hier komt de generieke zoekvraag vandaan — en hier worden we nu niet gevonden.",
        n: f(a.homeowners),
        later: false,
        nl: "",
        world: "",
      },
      {
        t: "Professionals",
        b: `De aanbodkant: ${f(a.companiesListed)} listed en ${f(a.companiesProspected)} prospected bureaus. Hier spreekt het merk nu toe, en hier komt vrijwel al het verkeer vandaan — want het is outbound.`,
        n: f(a.professionalUsers),
        later: false,
        nl: "20.000",
        world: "1.000.000",
      },
      {
        t: "Merken",
        b: "Fabrikanten van meubels, verlichting en materialen. Ze komen hier niet via een selectie maar via de projecten: wat een gecureerde architect voorschreef, hoort erbij. Nog geen eigen rol in het merkverhaal.",
        n: "—",
        later: true,
        nl: "1.000",
        world: "10.000",
      },
      {
        t: "Retailers",
        b: "Verkopers van die merken. Volgt op Merken en heeft daar alleen betekenis naast — los ervan is het een andere markt.",
        n: "—",
        later: true,
        nl: "150",
        world: "10.000",
      },
    ],
    notice: (): ReactNode => (
      <>
        <strong className="font-semibold">De marktcijfers zijn schattingen, het grote getal niet.</strong>{" "}
        Boven elke naam staat wat wij hebben, geteld in onze eigen database. Daaronder staat hoe groot
        de markt is, en dat is van een andere orde van zekerheid. <em>Professionals</em> telt ontwerpers
        én hoofdaannemers: 6.860 architecten- en interieurarchitectenbureaus (CBS, SBI 7111) plus de
        bouwbedrijven met meer dan één werkzame persoon — 87% van de 103.260 bedrijven in de burgerlijke
        en utiliteitsbouw is eenpersoons, dus blijft er ±13.400 over. Wereldwijd is dat IBISWorld&rsquo;s
        326.231 architectenbureaus maal dezelfde verhouding ontwerp-op-uitvoering. <em>Merken</em>{" "}
        wereldwijd is het universum van design- en bouwproductmerken; 3.500 daarvan is wat Archiproducts
        daadwerkelijk bedient, en dat is de bruikbare bovengrens. Nederland telt hier niet de Nederlandse
        merken maar de merken met Nederlandse distributie — een Nederlands interieur is internationaal
        ingekocht. Dat getal is afgeleid uit de dealernetwerken en daarmee het zwakste op deze pagina,
        net als beide <em>Retailers</em>. Arco Public is hier nog niet apart geteld: zolang dat merk
        gepland is, zou die splitsing twee universums suggereren die er niet zijn.
      </>
    ),
  },

  products: {
    items: (n: Products, f: (v: number) => string): ProductItem[] => [
      {
        t: "Projects", later: false,
        b: "Gerealiseerde projecten publiceren, ruimte voor ruimte, zodat ze vindbaar en beoordeelbaar zijn. Dit is het bewijs waar het hele merk op rust — zonder gepubliceerd werk is er geen reden om iets van ons aan te nemen. Een huiseigenaar heeft het één keer per project nodig.",
        rows: [], m: "Publiceren is altijd gratis.", tam: "",
      },
      {
        t: "Professionals", later: false,
        b: "De mensen achter die projecten, vindbaar per vakgebied en vermeld door de architect waarmee ze werkten. Hier landt de beslissing van de huiseigenaar, en hier zit het enige dat een concurrent niet kan namaken zonder hetzelfde mechanisme te bouwen.",
        rows: [["Gratis", "€ 0"], ["Pro", "€ 49 / maand"], ["Growth", "€ 99 / maand · voorstel"]],
        m: "",
        tam: "TAM op Pro: € 11,8 mln in Nederland, € 588 mln wereldwijd.",
      },
      {
        t: "Products", later: true,
        b: "Wat er in de projecten staat: meubels, verlichting en materialen, gekoppeld aan het project waarin ze zijn geplaatst. Dit lost het frequentieprobleem op. Een architect kies je één keer per project; tijdens dat project zoek je tientallen keren iets. Het is daarmee het enige product dat een reden geeft om terug te komen.",
        rows: [["Basis", "€ 0"], ["Merk", "€ 149 / maand"], ["Inzicht", "vanaf € 500 / maand"]],
        m: "",
        tam: "TAM wereldwijd € 22 mln: 3.500 bedienbare merken × € 6.300, het bedrag dat Archiproducts per merk per jaar omzet. Dat is dus ook precies wat de marktleider haalt — lees het als plafond voor één speler, niet als marktomvang.",
      },
      {
        t: "Journal", later: true,
        b: "Redactie: de plek waar de claim uitgelegd kan worden in plaats van geclaimd. Het is ook de enige ingang die niet aan een project hangt, en dus de enige die de generieke zoekvraag kan opvangen — nu goed voor tien kliks uit ruim twintigduizend vertoningen.",
        rows: [], m: "Geen verdienmodel.", tam: "",
      },
      {
        t: "Awards", later: true,
        b: "Zou de selectie door vakgenoten tot een eigen claim maken. Nu draagt dat mechanisme alleen de toelating en blijft het onzichtbaar; een prijs maakt het zichtbaar en geeft architecten een reden om werk in te sturen. Eén keer per jaar.",
        rows: [], m: "Alleen sponsoring.", tam: "",
      },
      {
        t: "Books", later: true,
        b: "Het verst weg en het meest afhankelijk van de rest: een boek kan pas als er genoeg gepubliceerd werk en genoeg redactie is. Een boek dat break-even draait is gratis bekendheid die jaren meegaat, op precies de salontafels waar Arco gezien wil worden.",
        rows: [], m: "€ 65 bij een oplage van 2.000 — break-even bij 700 verkochte exemplaren.", tam: "",
      },
    ],
  },
  seo: {
    intro: "Hoe het merk doorwerkt in zoekresultaten. Deze tab bepaalt; /admin/seo meet.",
    sections: {
      slots: "Welke tekst waar",
      formulas: "Paginatypen",
    },
    slots: {
      headers: ["Slot", "Wat er komt te staan", "Regel"],
      rows: [
        ["Homepagina-hero", "Het netwerk van professionals, bewezen door hun werk", "Op twee regels, alleen. Staat live."],
        ["Eyebrow onder de hero", "GEREALISEERDE ARCHITECTUUR · MET EER AAN DE MAKERS · REDACTIONEEL SAMENGESTELD", "De volgorde ligt vast: elk item slaat op het woord ervóór. Live staat home.hero_eyebrow nog in de oude samenstelling."],
        ["Footer", "Het netwerk van professionals, bewezen door hun werk", "Staat live, onder het logo."],
        ["Zoekresultaattitel", "— gerealiseerd werk, als achtervoegsel", "Zoekvraag eerst, claim tweede. De formules hieronder vullen het eerste deel."],
        ["Meta-omschrijving", "Feiten van de pagina zelf", "Gegenereerd uit aantallen, plaatsen en typen. De claim alleen als er tekens over zijn."],
        ["H1", "Niets", "De H1 noemt de pagina. De claim staat in de intro eronder."],
        ["Hub-intro", "De eerste zin van het merkverhaal", "Met de cijfers van die hub erachter: aantal bureaus, plaatsen, projecttypen."],
        ["Over ons", "Het merkverhaal, kern eerst", "Live staat about.hero_subtitle nog op de oude woorden."],
        ["Koude e-mail", "De eerste zin van het merkverhaal", "Eerste regel van de mail, vóór de vraag."],
        ["AI Overview", "Niets te zetten", "Geen slot dat je bestuurt — het citeert wat het vaakst voorkomt. Daarom staat dezelfde zin op elke hub."],
      ],
      note: "Deze sectie is een uitrollijst en kan weg zodra hij is afgewerkt. Vijf live strings dragen nog het oude merk: home.hero_line1, home.hero_line2, home.hero_eyebrow, home.hero_title (“Het gecureerde architectuurplatform”) en footer.tagline, plus about.hero_subtitle. Zolang die er staan, zegt de site iets anders dan deze pagina.",
    },
    formulas: {
      inCode: "in code",
      headers: ["Paginatype", "Pagina", "Omschrijving", "Vertoningen", "CTR", "Positie"],
      rows: [
        ["Arco home", "De homepagina", "De enige pagina waar de claim alleen staat, zonder zoekvraag ervoor.", "1,6%", "16,10%", "7,8"],
        ["Arco pages", "Over ons, prijzen, voorwaarden", "Met de hand geschreven. Geen formule, wel dezelfde woordenschat.", "1,6%", "1,92%", "6,4"],
        ["Pro discover", "/professionals — het overzicht", "Aantal bureaus, grootste plaatsen, meest voorkomende diensten.", "17,8%", "0,61%", "53,4"],
        ["Pro hub", "/professionals/{hub} — plaats, dienst, categorie", "Aantal bureaus, twee grootste plaatsen, plaatstotaal, twee meest voorkomende projecttypen.", "63,0%", "0,07%", "65,1"],
        ["Pro detail", "/professionals/{bedrijf}", "Aantal gerealiseerde projecten, projecttypen, plaatsen, en de uitnodiging tot rechtstreeks contact.", "4,7%", "0,51%", "8,5"],
        ["Project discover", "/projects — het overzicht", "Aantal projecten, ruimtes en foto's.", "1,7%", "0,35%", "49,1"],
        ["Project hub", "/projects/{hub} — plaats, type, ruimte", "Aantal projecten, grootste plaatsen, veelvoorkomende ruimtes.", "5,7%", "0,64%", "45,6"],
        ["Project detail", "/projects/{project}", "Het bureau dat het maakte, aantal ruimtes en foto's, de voornaamste ruimtes.", "3,6%", "2,00%", "16,7"],
        ["Restbak", "Alles wat hier landt", "Hoort leeg te zijn: niet geclassificeerd, of het hoort niet geïndexeerd te worden.", "0,2%", "0,00%", "10,3"],
      ],
      note: "Search Console, zes weken tot 8 oktober 2026: 16.591 vertoningen, 96 kliks. Het verschil tussen discover en hub is het belangrijkste dat hier staat. De vijf overzichtspagina's leveren 19 kliks; de 138 programmatische hubpagina's eronder leveren er 13, op 69% van al je vertoningen. Dáár ligt het dekkingsgevecht dat je verliest van partijen met twintig keer meer vermeldingen — laat de hubs lopen, niet de overzichten. Pro detail staat op positie 8,5 met 0,51% CTR waar 2 à 3% hoort: geen rankingprobleem maar een titelprobleem, en dus precies wat een formule oplost. Arco home is 1,6% van de vertoningen en bijna de helft van alle kliks — merkverkeer, het enige dat je kunt verliezen zonder het aan iemand kwijt te raken.",
      now: "nu",
      proposed: "voorstel",
      items: [
        {
          done: true,
          type: "Arco home",
          url: "arcolist.com › nl",
          titleNow: "Arco - Connect with Architecture & Design Professionals",
          descNow: "Find and collaborate with top architecture, interior design, and construction professionals in the Netherlands. Post projects, browse portfolios, and bring your vision to life.",
          titleNew: "Arco - Connect with Architecture & Design Professionals",
          descNew: "176 gerealiseerde architectuurprojecten, professioneel gefotografeerd. Van aannemer tot hovenier, vermeld door de architect. Redactioneel samengesteld.",
          note: "De omschrijving staat in de code, met een live telling van gepubliceerde projecten: de pagina revalideert elke vijf minuten, dus dat getal kan niet verouderen. De drie benefits staan er in de volgorde van de eyebrow. De TITEL is bewust ongemoeid gelaten en is dus nog steeds de Engelse standaard uit de layout — dat besluit staat nog open.",
        },
        {
          done: false,
          type: "Arco pages",
          url: "arcolist.com › nl › about",
          titleNow: "Arco - Connect with Architecture & Design Professionals",
          descNow: "Find and collaborate with top architecture, interior design, and construction professionals in the Netherlands. Post projects, browse portfolios, and bring your vision to life.",
          titleNew: "Over Arco — waarom alleen gerealiseerd werk",
          descNew: "Arco toont architecten en interieurontwerpers aan de hand van wat ze gebouwd hebben. Geen renders, geen reviews — alleen opgeleverd werk, vermeld door de architect.",
          note: "Over ons heeft net zomin eigen metadata en deelt zijn zoekresultaat dus letterlijk met de homepagina. Twee pagina's met dezelfde titel concurreren om dezelfde vraag.",
        },
        {
          done: false,
          type: "Pro discover",
          url: "arcolist.com › nl › professionals",
          titleNow: "Architecten en interieurontwerpers in Nederland",
          descNow: "Vind erkende architecten, interieurontwerpers, aannemers en bouwbedrijven in Nederland. Bekijk hun gerealiseerde projecten en neem direct contact op.",
          titleNew: "Architecten en interieurontwerpers — gerealiseerd werk",
          descNew: "101 bureaus met opgeleverde projecten, van architect tot aannemer. Werk te zien in Amsterdam, Rotterdam en 88 andere plaatsen — per ruimte gefotografeerd.",
          note: "Deze twee pagina's leveren 18 kliks, meer dan de 62 hubs eronder samen. De huidige titel is niet slecht; hij noemt alleen geen enkel cijfer van de pagina zelf.",
        },
        {
          done: false,
          type: "Pro hub",
          url: "arcolist.com › nl › professionals › architect",
          titleNow: "Architecten in Nederland – bekijk hun projecten",
          descNow: "Vind architecten in Nederland op Arco. Bekijk portfolio's met gerealiseerde projecten — van villa's tot interieurs — vergelijk studio's en neem direct contact op.",
          titleNew: "Architecten in Nederland — gerealiseerd werk",
          descNew: "100 architectenbureaus met gerealiseerde projecten in Nederland, van grachtenpandrenovatie tot nieuwbouwvilla. Werk te zien in Amsterdam, Rotterdam en 88 andere plaatsen.",
          note: "De omschrijving zegt “portfolio's” — een woord dat renders toelaat en dus de claim ondergraaft. Google gebruikt hem bovendien niet: hij schraapt de bedrijfskaartjes van de pagina.",
        },
        {
          done: true,
          type: "Pro detail",
          url: "arcolist.com › nl › professionals › wolterinck-com",
          titleNow: "Wolterinck",
          descNow: "—",
          titleNew: "Wolterinck — interieurontwerper in Laren",
          descNew: "7 gerealiseerde projecten van Wolterinck, per ruimte gefotografeerd: villa's, verbouwingen en interieurs in Laren, Blaricum en Amsterdam. Neem rechtstreeks contact op.",
          note: "De TITEL staat in de code: {naam} — {hoofddienst} in {plaats}, uit velden die de query al ophaalde. Daarbij bleek dat de locale niet werd doorgegeven, zodat de dienstnaam op de Nederlandse pagina Engels was. De OMSCHRIJVING hieronder is nog een voorstel: projectaantallen en -plaatsen zitten niet in de metadata-query en vragen een extra bevraging.",
        },
        {
          done: false,
          type: "Project discover",
          url: "arcolist.com › nl › projects",
          titleNow: "Architectuur- en interieurprojecten in Nederland",
          descNow: "Ontdek bijzondere architectuur-, interieur- en renovatieprojecten in Nederland. Filter op locatie, stijl en type, en vind inspiratie voor jouw volgende project.",
          titleNew: "Gerealiseerde projecten — per ruimte gefotografeerd",
          descNew: "176 opgeleverde projecten, 1.365 ruimtes, 2.921 foto's. Zoek op ruimte, stijl en plaats, en zie bij elk project wie het heeft gebouwd.",
          note: "“Bijzondere” is een bijvoeglijk naamwoord zonder dekking; de cijfers eronder zijn wel te controleren. Dit is de ingang die het merkverhaal letterlijk beschrijft.",
        },
        {
          done: false,
          type: "Project hub",
          url: "arcolist.com › nl › projects › amsterdam",
          titleNow: "Architectuur- en interieurprojecten in Amsterdam",
          descNow: "Bekijk gerealiseerde architectuur- en interieurprojecten in Amsterdam op Arco — van villa's tot interieurs — met de studio's die ze maakten en hun contactgegevens.",
          titleNew: "Projecten in Amsterdam — gerealiseerd werk",
          descNew: "24 opgeleverde projecten in Amsterdam, per ruimte gefotografeerd: grachtenpandrenovaties, appartementen en stadsvilla's, met het bureau dat ze maakte.",
          note: "76 pagina's, zes kliks. De titel heeft bijna dezelfde vorm als het overzicht erboven, dus de twee concurreren om dezelfde zoekvraag.",
        },
        {
          done: false,
          type: "Project detail",
          url: "arcolist.com › nl › projects › villa-mel",
          titleNow: "Villa Mel",
          descNow: "—",
          titleNew: "Villa Mel — nieuwbouwvilla in Bloemendaal",
          descNew: "Gerealiseerd door Studio Piet Boon. 14 ruimtes, 27 foto's — woonkamer, keuken, badkamer en tuin, met de materialen zoals ze zijn opgeleverd.",
          note: "Converteert op 2,00% met een kale naam, het hoogst van alle detailpagina's. Het plafond ligt dus hoger dan het eruitziet.",
        },
      ],
    },
  },
}

export type Copy = typeof nl

const en: Copy = {
  label: "EN",
  other: "NL",

  status: { set: "set", open: "to decide", later: "later" },

  sections: {
    hero: "Hero",
    story: "Brand story",
    problem: "Problem",
    positioning: "Positioning",
    brands: "Brands",
    audiences: "Audiences",
    products: "Products",
  },

  hero: {
    line1: "The network of professionals,",
    line2: "proven by their work",
    eyebrow: "BUILT ARCHITECTURE · CREDIT TO THE MAKERS · EDITORIALLY CURATED",
  },

  story: {
    more: "Read more",
    less: "Less",
    lead: "Arco is where leading architects publish their built work and credit the makers they worked with. We give clients a network of professionals — from interior designer to contractor — who earned their reputation through craft, not advertising.",
    p1: "Choosing a firm for your house is an expensive decision made on thin evidence. What you find online is usually a render, a mood board or a profile someone wrote about themselves. Finished work, photographed as it was handed over, is rare — and it is the only thing that predicts what you will get.",
    p2: "On the other side are firms with ten years of built work and nowhere neutral to show it. Their own site is a claim about themselves; a directory listing is one line in a list. Here that work sits in one place, and everyone who worked on it is named — by the architect, not by themselves.",
    p3: "Recognise your own ambition in a finished project and the match is made. You get in touch directly, with no intermediary and no brokerage fee.",
  },
  benefits: () => [
    {
      title: "Built architecture",
      body: "Arco carries only projects that have been built, photographed professionally. Search by room, style and place, and use what others have built as inspiration for your own project.",
      rests: ["No image without provenance"],
    },
    {
      title: "Credit to the makers",
      body: "Every professional on a project — contractor, interior designer, landscape architect — is credited by the architect they worked with. That credit means something.",
      rests: ["Credits over reviews"],
    },
    {
      title: "Editorially curated",
      body: "Leading architects submit their completed projects and we review them before they go online. Not everything makes it, and a place is not for sale.",
      rests: ["Not everyone belongs here", "Money buys reach, never credibility"],
    },
  ],
  benefitsRests: "Rests on",

  problem: {
    statement: "Choosing a professional for a project is an expensive decision made on thin evidence.",
    statementNote: "A renovation or a new build is among the largest sums a household ever spends, and you buy it before it exists. You judge on a portfolio, a conversation and a feeling; whether you chose well you find out two years later. There is no trial, no return, and you never see what the other choice would have given you.",
    heading: "What people use today",
    channels: [
      {
        key: "search",
        t: "Search",
        how: "SEO, advertising and marketing spend decide who you see first.",
        ex: "Google",
        limits: [
          "Rewards whoever markets best, not whoever builds best",
          "No view of what anyone has actually built",
          "An advertisement and a craftsman look the same",
        ],
      },
      {
        key: "social",
        t: "Social media",
        how: "Imagery, ordered by an algorithm that optimises for popularity.",
        ex: "Pinterest · Instagram",
        limits: [
          "Beautiful images without context: which house, which city, which budget",
          "The maker is often uncredited",
          "No path from a saved photo to a project you can commission",
        ],
      },
      {
        key: "word-of-mouth",
        t: "Word of mouth",
        how: "A personal recommendation from someone you know and trust.",
        ex: "Your own circle",
        limits: [
          "The strongest signal there is — but it reaches one or two names",
          "You never hear about the firms that would also have fitted",
          "Nothing to compare against",
        ],
      },
      {
        key: "referral",
        t: "Through a professional",
        how: "The architect names a contractor, the contractor an interior designer.",
        ex: "Your architect · your contractor · your estate agent",
        limits: [
          "Only works once you have already made the first choice",
          "One name per role, with nothing beside it to compare",
          "You see the network behind a firm only once you are inside it",
        ],
      },
      {
        key: "editorial",
        t: "Editorial platforms",
        how: "Curated publications and portfolios, chosen by an editorial team.",
        ex: "Archello · Hoog",
        limits: [
          "Built to publish, not to search",
          "No filters on room, style or place",
          "No route from the project to the people behind it",
        ],
      },
      {
        key: "directories",
        t: "Directories and marketplaces",
        how: "Profiles and reviews, with leads sold to firms by the piece.",
        ex: "Werkspot · Houzz",
        limits: [
          "Optimised for volume, not for standard",
          "Reputation becomes a score, and a score can be played",
          "The firms that do not need it stay away — precisely the ones you want",
        ],
      },
    ],
  },
  positioning: {
    core1: "The trust of a referral,",
    core2: "with the overview a referral cannot give.",
    coreNote: "A recommendation from your own circle or from your architect is the most reliable signal there is, and it gives you one name per discipline. A directory gives you every name and no reason to believe any of them. Arco claims both: every professional who qualifies, credited by a peer.",
    axisX: "Overview",
    axisY: "Trust",
    low: "little",
    high: "much",
    lowY: "low",
    highY: "high",
  },
  principles: {
    heading: "Principles",
    items: [
      ["No image without provenance", "Arco shows projects, professionals and products as images, and every photograph traces back to its source: a project names its makers, a product hangs on the project it stands in. In a feed a photo is a picture; here it is a way in. No mood shots, no stock photography, no product image attached to nothing."],
      ["Not everyone belongs here", "Arco is high-end. Not every project, professional or product belongs on it. Access runs through an invitation from the architect: 313 of 313 links came about that way. That line is the value for the homeowner — anyone looking here does not have to filter — and the pull to stretch it is permanent, because every step is small."],
      ["Credits over reviews", "Credibility comes from verified involvement in a project — not from ratings, likes or testimonials. Which is why there are no stars in the search results, even though that costs visibility."],
      ["Editorial, not promotional", "Project pages read like a published feature, not an advertisement. No urgency, no gamification, no sales language; the authority comes from the restraint."],
      ["Money buys reach, never credibility", "A subscription can increase visibility, up to and including a higher position in the search results. It never buys a credit, a way past the selection, or access to the platform. You pay for more people to see your work — not for the work to look better."],
      ["The best have to want to be here", "Everyone who meets the selection should be able to be here. Charging per lead, taking commission or selling access drives away exactly the firms and brands that make the platform credible — they do not need us. Hence a subscription: paying for presence, not per client."],
    ],
  },

  brands: {
    arco: {
      name: "Arco",
      body: (projects: string) =>
        `Houses, villas, renovations and interiors. All ${projects} published projects fall under this brand.`,
    },
    public: {
      name: "Arco Public",
      body: "Public and commercial projects. While this is still planned the tagline only has to cover living — but it must not bar the door.",
    },
  },

  audiences: {
    nl: "Netherlands",
    world: "Worldwide",
    items: (a: Audiences, f: (v: number) => string) => [
      {
        t: "Homeowners",
        b: "Accounts with a client role. The demand side: people looking for a firm for their own house. This is where generic search demand comes from — and where we are currently not found.",
        n: f(a.homeowners),
        later: false,
        nl: "",
        world: "",
      },
      {
        t: "Professionals",
        b: `The supply side: ${f(a.companiesListed)} listed and ${f(a.companiesProspected)} prospected firms. This is who the brand addresses today, and where nearly all traffic comes from — because it is outbound.`,
        n: f(a.professionalUsers),
        later: false,
        nl: "20,000",
        world: "1,000,000",
      },
      {
        t: "Brands",
        b: "Manufacturers of furniture, lighting and materials. They arrive here not through a selection but through the projects: whatever a curated architect specified belongs. No role of their own in the brand story yet.",
        n: "—",
        later: true,
        nl: "1,000",
        world: "10,000",
      },
      {
        t: "Retailers",
        b: "Sellers of those brands. Follows on from Brands and only means anything beside it — on its own it is a different market.",
        n: "—",
        later: true,
        nl: "150",
        world: "10,000",
      },
    ],
    notice: (): ReactNode => (
      <>
        <strong className="font-semibold">The market figures are estimates. The large number is not.</strong>{" "}
        Above each name is what we have, counted in our own database. Below it is how large the market is,
        and that is a different order of certainty. <em>Professionals</em> counts designers and main
        contractors: 6,860 architecture and interior architecture firms (CBS, SBI 7111) plus the
        construction firms with more than one working person — 87% of the 103,260 companies in general
        building are one-person, which leaves roughly 13,400. Worldwide that is IBISWorld&rsquo;s 326,231
        architecture firms times the same design-to-construction ratio. <em>Brands</em> worldwide is the
        universe of design and building-product brands; 3,500 of those is what Archiproducts actually
        serves, and that is the usable ceiling. The Netherlands column does not count Dutch brands but
        brands with Dutch distribution — a Dutch interior is sourced internationally. That figure is
        derived from dealer networks and is the weakest on this page, as are both <em>Retailers</em>.
        Arco Public is not counted separately here: while that brand is planned, splitting it would
        suggest two universes that do not exist.
      </>
    ),
  },

  products: {
    items: (n: Products, f: (v: number) => string): ProductItem[] => [
      {
        t: "Projects", later: false,
        b: "Publishing built projects, room by room, so they can be found and judged. This is the evidence the whole brand rests on — without published work there is no reason to take anything we say on trust. A homeowner needs it once per project.",
        rows: [], m: "Publishing is always free.", tam: "",
      },
      {
        t: "Professionals", later: false,
        b: "The people behind those projects, findable by discipline and credited by the architect they worked with. This is where the homeowner's decision lands, and it holds the one thing a competitor cannot copy without building the same mechanism.",
        rows: [["Free", "€ 0"], ["Pro", "€ 49 / month"], ["Growth", "€ 99 / month · proposed"]],
        m: "",
        tam: "TAM on Pro: € 11.8M in the Netherlands, € 588M worldwide.",
      },
      {
        t: "Products", later: true,
        b: "What is in the projects: furniture, lighting and materials, attached to the project they stand in. This solves the frequency problem. You choose an architect once per project; during that project you look things up dozens of times. It is the only product that gives anyone a reason to come back.",
        rows: [["Base", "€ 0"], ["Brand", "€ 149 / month"], ["Insight", "from € 500 / month"]],
        m: "",
        tam: "TAM worldwide € 22M: 3,500 servable brands × € 6,300, what Archiproducts turns over per brand per year. Which is also exactly what the market leader earns — read it as a ceiling for one player, not as market size.",
      },
      {
        t: "Journal", later: true,
        b: "Editorial: the place where the claim can be explained rather than asserted. It is also the only entry point that does not hang on a project, and so the only one that can catch generic search demand — currently ten clicks from some twenty thousand impressions.",
        rows: [], m: "No revenue model.", tam: "",
      },
      {
        t: "Awards", later: true,
        b: "Would turn selection by peers into a claim of its own. Today that mechanism only carries admission and stays invisible; a prize makes it visible and gives architects a reason to submit work. Once a year.",
        rows: [], m: "Sponsorship only.", tam: "",
      },
      {
        t: "Books", later: true,
        b: "Furthest away and the most dependent on the rest: a book is only possible once there is enough published work and enough editorial. A book that breaks even is free recognition that lasts for years, on exactly the coffee tables where Arco wants to be seen.",
        rows: [], m: "€ 65 at a print run of 2,000 — break-even at 700 copies sold.", tam: "",
      },
    ],
  },
  seo: {
    intro: "How the brand works through into search results. This tab decides; /admin/seo measures.",
    sections: {
      slots: "Which text goes where",
      formulas: "Page types",
    },
    slots: {
      headers: ["Slot", "What goes there", "Rule"],
      rows: [
        ["Homepage hero", "The network of professionals, proven by their work", "On two lines, alone. Live this is still home.hero_line1/2 — “Uitzonderlijke architectuur. Vertrouwde professionals.”"],
        ["Eyebrow under the hero", "BUILT ARCHITECTURE · CREDIT TO THE MAKERS · EDITORIALLY CURATED", "The order is fixed: each item attaches to the word before it. Live, home.hero_eyebrow still carries the old composition."],
        ["Footer", "The network of professionals, proven by their work", "Live this is still footer.tagline — “Het professionele netwerk dat architecten vertrouwen.”"],
        ["Search result title", "— built work, as a suffix", "Query first, claim second. The formulas below fill the first part."],
        ["Meta description", "Facts from the page itself", "Generated from counts, cities and types. The claim only if characters remain."],
        ["H1", "Nothing", "The H1 names the page. The claim sits in the intro beneath it."],
        ["Hub intro", "The first sentence of the brand story", "With that hub's own figures behind it: firm count, cities, project types."],
        ["About", "The brand story, core first", "Live, about.hero_subtitle still carries the old wording."],
        ["Cold e-mail", "The first sentence of the brand story", "First line of the mail, before the ask."],
        ["AI Overview", "Nothing to set", "Not a slot you control — it quotes what it finds most often. Which is why the same sentence sits on every hub."],
      ],
      note: "This section is a rollout list and can go once it is worked through. Five live strings still carry the old brand: home.hero_line1, home.hero_line2, home.hero_eyebrow, home.hero_title (“Het gecureerde architectuurplatform”) and footer.tagline, plus about.hero_subtitle. While those stand, the site says something different from this page.",
    },
    formulas: {
      inCode: "in code",
      headers: ["Page type", "Page", "Description", "Impressions", "CTR", "Position"],
      rows: [
        ["Arco home", "The homepage", "The only page where the claim stands alone, with no query in front of it.", "1.6%", "16.10%", "7.8"],
        ["Arco pages", "About, pricing, terms", "Written by hand. No formula, but the same vocabulary.", "1.6%", "1.92%", "6.4"],
        ["Pro discover", "/professionals — the index", "Firm count, largest cities, most common services.", "17.8%", "0.61%", "53.4"],
        ["Pro hub", "/professionals/{hub} — city, service, category", "Firm count, two largest cities, city total, two most common project types.", "63.0%", "0.07%", "65.1"],
        ["Pro detail", "/professionals/{company}", "Number of built projects, project types, cities, and the invitation to get in touch directly.", "4.7%", "0.51%", "8.5"],
        ["Project discover", "/projects — the index", "Number of projects, rooms and photographs.", "1.7%", "0.35%", "49.1"],
        ["Project hub", "/projects/{hub} — city, type, room", "Number of projects, largest cities, common rooms.", "5.7%", "0.64%", "45.6"],
        ["Project detail", "/projects/{project}", "The firm that made it, number of rooms and photographs, the main rooms.", "3.6%", "2.00%", "16.7"],
        ["Catch-all", "Whatever lands here", "Should be empty: unclassified, or it should not be indexed.", "0.2%", "0.00%", "10.3"],
      ],
      note: "Search Console, six weeks to 8 October 2026: 16,591 impressions, 96 clicks. The difference between discover and hub is the most important thing here. The five index pages produce 19 clicks; the 138 programmatic hub pages beneath them produce 13, on 69% of all your impressions. That is where the coverage fight sits, and you lose it to parties with twenty times more listings — let the hubs go, not the indexes. Pro detail sits at position 8.5 with a 0.51% CTR where it should be 2 to 3%: not a ranking problem but a title problem, and so exactly what a formula fixes. Arco home is 1.6% of impressions and almost half of all clicks — brand traffic, the only thing you can lose without losing it to anyone.",
      now: "today",
      proposed: "proposed",
      items: [
        {
          done: true,
          type: "Arco home",
          url: "arcolist.com › en",
          titleNow: "Arco - Connect with Architecture & Design Professionals",
          descNow: "Find and collaborate with top architecture, interior design, and construction professionals in the Netherlands. Post projects, browse portfolios, and bring your vision to life.",
          titleNew: "Arco - Connect with Architecture & Design Professionals",
          descNew: "176 built architecture projects, professionally photographed. From contractor to landscape architect, credited by the architect. Editorially curated.",
          note: "The description is in the code, with a live count of published projects: the page revalidates every five minutes, so that figure cannot go stale. The three benefits appear in the order of the eyebrow. The TITLE was deliberately left alone and is still the English layout default — that decision is still open.",
        },
        {
          done: false,
          type: "Arco pages",
          url: "arcolist.com › en › about",
          titleNow: "Arco - Connect with Architecture & Design Professionals",
          descNow: "Find and collaborate with top architecture, interior design, and construction professionals in the Netherlands. Post projects, browse portfolios, and bring your vision to life.",
          titleNew: "About Arco — why only built work",
          descNew: "Arco shows architects and interior designers through what they have built. No renders, no reviews — only delivered work, credited by the architect.",
          note: "About has no metadata of its own either, so it shares its search result verbatim with the homepage. Two pages with the same title compete for the same query.",
        },
        {
          done: false,
          type: "Pro discover",
          url: "arcolist.com › en › professionals",
          titleNow: "Architects & interior designers in the Netherlands",
          descNow: "Find verified architects, interior designers, contractors and construction companies across the Netherlands. Browse their built work and get in touch directly.",
          titleNew: "Architects & interior designers — built work",
          descNew: "101 firms with delivered projects, from architect to contractor. Work to see in Amsterdam, Rotterdam and 88 other places — photographed room by room.",
          note: "These two pages produce 18 clicks, more than the 62 hubs beneath them combined. The current title is not bad; it simply names no figure from the page itself.",
        },
        {
          done: false,
          type: "Pro hub",
          url: "arcolist.com › en › professionals › architect",
          titleNow: "Architects in the Netherlands – browse their projects",
          descNow: "Find architects in the Netherlands on Arco. Browse portfolios of completed projects — from villas to interiors — compare studios and get in touch directly.",
          titleNew: "Architects in the Netherlands — built work",
          descNew: "100 architecture firms with delivered projects in the Netherlands, from canal-house renovation to new-build villa. Work to see in Amsterdam, Rotterdam and 88 other places.",
          note: "The description says “portfolios” — a word that admits renders and so undercuts the claim. Google does not use it anyway: it scrapes the company cards off the page.",
        },
        {
          done: true,
          type: "Pro detail",
          url: "arcolist.com › en › professionals › wolterinck-com",
          titleNow: "Wolterinck",
          descNow: "—",
          titleNew: "Wolterinck — Interior designer in Laren",
          descNew: "7 delivered projects by Wolterinck, photographed room by room: villas, renovations and interiors in Laren, Blaricum and Amsterdam. Get in touch directly.",
          note: "The TITLE is in the code: {name} — {primary service} in {city}, from fields the query already fetched. In doing so it turned out the locale was not being passed, so the service name was English on the Dutch page too. The DESCRIPTION below is still a proposal: project counts and cities are not in the metadata query and need an extra one.",
        },
        {
          done: false,
          type: "Project discover",
          url: "arcolist.com › en › projects",
          titleNow: "Architecture & interior projects in the Netherlands",
          descNow: "Discover curated architecture, interior design and renovation projects from across the Netherlands. Filter by location, style and type, and find inspiration for your next build.",
          titleNew: "Built projects — photographed room by room",
          descNew: "176 delivered projects, 1,365 rooms, 2,921 photographs. Search by room, style and place, and see who built each one.",
          note: "“Curated” is an adjective with nothing behind it; the figures below can be checked. This is the entry point the brand story literally describes.",
        },
        {
          done: false,
          type: "Project hub",
          url: "arcolist.com › en › projects › amsterdam",
          titleNow: "Architecture & interior projects in Amsterdam",
          descNow: "Browse completed architecture and interior projects in Amsterdam on Arco — from villas to interiors — with the studios that made them and how to reach them.",
          titleNew: "Projects in Amsterdam — built work",
          descNew: "24 delivered projects in Amsterdam, photographed room by room: canal-house renovations, apartments and city villas, with the firm that made them.",
          note: "76 pages, six clicks. The title has almost the same shape as the index above it, so the two compete for the same query.",
        },
        {
          done: false,
          type: "Project detail",
          url: "arcolist.com › en › projects › villa-mel",
          titleNow: "Villa Mel",
          descNow: "—",
          titleNew: "Villa Mel — new-build villa in Bloemendaal",
          descNew: "Built by Studio Piet Boon. 14 rooms, 27 photographs — living room, kitchen, bathroom and garden, with the materials as delivered.",
          note: "Converts at 2.00% on a bare name, the best of all detail pages. The ceiling is higher than it looks.",
        },
      ],
    },
  },
}

export const COPY: Record<Lang, Copy> = { nl, en }
