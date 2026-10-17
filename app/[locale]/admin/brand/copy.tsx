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
    line1: "Uitzonderlijke architectuur.",
    line2: "Met eer aan de makers.",
    eyebrow: "GEREALISEERDE PROJECTEN · VERMELD DOOR DE ARCHITECT · REDACTIONEEL SAMENGESTELD",
  },

  story: {
    more: "Lees meer",
    less: "Minder",
    payoff: "Het netwerk achter uitzonderlijke architectuur.",
    lead: "Arco is waar toonaangevende architecten hun gerealiseerde werk publiceren en de vakmensen vermelden waarmee ze hebben samengewerkt. Wij helpen opdrachtgevers aan een netwerk van professionals — van interieurarchitect tot aannemer — die hun reputatie hebben verdiend door vakmanschap, niet door reclame.",
    p1: "Een bureau kiezen voor je huis is een dure beslissing op dun bewijs. Wat je online vindt is meestal een render, een moodboard of een profiel dat iemand over zichzelf heeft geschreven. Afgerond werk, gefotografeerd zoals het is opgeleverd, kom je zelden tegen — en dat is juist het enige dat voorspelt wat je krijgt.",
    p2: "Aan de andere kant staan bureaus met tien jaar gebouwd werk en geen neutrale plek om het te laten zien. Hun eigen site is een bewering over zichzelf; een gidsvermelding is een regel in een lijst. Hier staat dat werk op één plek, en iedereen die eraan meewerkte staat erbij — vermeld door de architect, niet door zichzelf.",
    p3: "Herken je je eigen ambitie in een gerealiseerd project, dan is de match gevonden. Je neemt rechtstreeks contact op, zonder tussenpersoon en zonder bemiddelingskosten.",
  },
  benefits: () => [
    {
      title: "Ontdek afgerond werk",
      body: "Filter op ruimte, stijl en plaats. Alles wat je vindt is gebouwd en professioneel gefotografeerd — je kijkt naar een echt project, niet naar een render of AI-beeld.",
      rests: ["Geen beeld zonder herkomst"],
    },
    {
      title: "Vind het hele team",
      body: "Bij elk project staan de betrokken vakmensen, van interieurarchitect tot aannemer, vermeld door de architect die met ze samenwerkte.",
      rests: ["Vermeldingen boven reviews"],
    },
    {
      title: "Benader ze rechtstreeks",
      body: "Stel je eigen team samen uit de vakmensen die bij de projecten vermeld staan. Je benadert ze zelf, zonder tussenpersoon.",
      rests: ["De besten moeten hier wíllen staan"],
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
        how: "De architect noemt een aannemer, de aannemer een interieurarchitect.",
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
    sections: {
      formulas: "Paginatypen",
      pages: "Arco-pagina's",
    },
    pages: {
      headers: ["Pagina", "Voorgestelde titel", "Omschrijving voor zoekresultaten", "Nu"],
      rows: [
        ["/about", "Over Arco — waarom alleen gerealiseerd werk", "Arco is waar toonaangevende architecten hun gerealiseerde werk publiceren en de vakmensen vermelden waarmee ze hebben samengewerkt. Geen renders, geen reviews.", "erft de homepage"],
        ["/businesses/architects", "Voor architecten — publiceer je werk en vermeld je team", "De neutrale plek voor je gerealiseerde werk: al je projecten op je eigen pagina, met iedereen die eraan meewerkte, door jou vermeld. Gratis, voor altijd.", "erft de homepage"],
        ["/businesses/professionals", "Voor vakmensen — word herkend door het werk dat je leverde", "De neutrale plek voor het werk dat je hebt geleverd: al je projecten op je eigen pagina, vermeld door de architect waarmee je samenwerkte. Niet door promotie.", "erft de homepage"],
        ["/businesses/photography", "Fotografie — Arco", "—", "404 buiten admin"],
        ["/homeowner", "Mijn Arco", "—", "alleen na inloggen"],
        ["/pricing", "Prijzen — wat een plek op Arco kost", "Projecten publiceren is gratis, voor altijd. Pro geeft je een volledige bedrijfspagina en Arco Approved-verificatie voor € 39 per maand.", "Engels"],
        ["/privacy", "Privacyverklaring — welke gegevens Arco bewaart", "Welke gegevens Arco van je verzamelt, waarvoor ze worden gebruikt, hoe lang ze bewaard blijven en hoe je ze laat verwijderen.", "Engels"],
        ["/terms", "Voorwaarden — de regels voor gebruik van Arco", "De voorwaarden voor het gebruik van Arco: wat je mag publiceren, bij wie het werk en de rechten blijven, en wanneer een pagina offline gaat.", "Engels"],
        ["/help-center", "Helpcentrum — antwoorden op de meestgestelde vragen", "Hoe je je bedrijfspagina claimt, een project publiceert, je team vermeldt en contact opneemt met een bureau. De meestgestelde vragen, kort beantwoord.", "Engels"],
      ],
      note: "Deze pagina's hebben geen formule — ze worden met de hand geschreven, volgens {Onderwerp} — {belofte van die pagina}. De omschrijving staat erbij omdat de titel zonder zijn tweede regel niet te beoordelen is: de titel krijgt de zoekvraag, de omschrijving de belofte, en wat de titel niet kwijt kan hoort daar te landen. Bij /businesses/architects is dat letterlijk zichtbaar — de hero heeft drie beats (“Publiceer je werk. Vermeld je team. Zet de standaard.”), twee passen in de titel, de derde staat in de omschrijving. Vijf pagina's hebben geen eigen titel en erven daarom stilzwijgend de title.default uit app/layout.tsx. Tot vandaag was dat letterlijk dezelfde titel als de homepage; nu de homepage zijn eigen titel heeft, voeren deze vijf een Engelse standaardregel die geen enkele pagina meer bewust draagt — van concurreren met de homepage naar helemaal niemands titel. /businesses/architects is daarbij de pijnlijkste: dat is de pagina waar elke knop op de site naartoe wijst. Twee van die vijf zijn geen zoekresultaat en hoeven er ook geen te worden: /businesses/photography geeft buiten admin een 404 tot de fotografenlijst vol genoeg is, en /homeowner is het ingelogde account. Die twee krijgen een gewone titel en robots noindex — een omschrijving zou alleen maar suggereren dat ze te vinden zijn. De vier Engelse titels staan op Nederlandse pagina's, en de omschrijving van /help-center noemt daarbij nog “post projects, hire professionals”: dat is de marktplaats die met /new-project is verdwenen. Dat dit kon gebeuren is het eigenlijke probleem, niet de titels zelf: er was geen controle. `pnpm check:titles` loopt nu alle publieke pagina's af en meldt wie er geen eigen titel heeft — redirects en de homepage uitgezonderd, want die voert de default terecht. Vandaag meldt hij er twaalf. Vijf daarvan staan hier; de andere zeven — vijf foutpagina's en twee /products-pagina's — vallen onder dezelfde uitzondering als photography en homeowner. De vier rijen hier die hij niet meldt zijn juist de vier met een Engelse titel: een eigen titel heeft hij, alleen de verkeerde."
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
      pattern: "formule",
      proposed: "voorstel",
      items: [
        {
          done: true,
          type: "Arco home",
          url: "arcolist.com › nl",
          titlePattern: "Arco — het netwerk achter uitzonderlijke architectuur",
          descPattern: "Ontdek {projecten} gerealiseerde projecten, professioneel gefotografeerd. Vind het hele team erachter, van interieurarchitect tot aannemer. Benader ze rechtstreeks.",
          titleNew: "Arco — het netwerk achter uitzonderlijke architectuur",
          descNew: "Ontdek 176 gerealiseerde projecten, professioneel gefotografeerd. Vind het hele team erachter, van interieurarchitect tot aannemer. Benader ze rechtstreeks.",
          note: "Titel en omschrijving staan live, in lib/seo/copy.ts. Het aantal telt mee en kan dus niet verouderen: de pagina revalideert elke vijf minuten. Met 156 tekens zit dit voorstel net binnen de ~155-160 die Google op desktop toont; op mobiel valt de laatste zin hoe dan ook weg, dus de belangrijkste belofte hoort niet achteraan. De drie benefits staan er in de volgorde van de eyebrow. De titel was tot nu toe de Engelse standaard uit app/layout.tsx; dit is de enige pagina waar het merk vooraan mag staan, want hier is Arco het onderwerp en is het verkeer merkverkeer.",
        },
        {
          done: false,
          type: "Arco pages",
          url: "arcolist.com › nl › about",
          titlePattern: "{Onderwerp} — {belofte van die pagina}",
          descPattern: "{Eén zin over wat hier staat}. Geen renders, geen reviews — alleen opgeleverd werk, vermeld door de architect.",
          titleNew: "Over Arco — waarom alleen gerealiseerd werk",
          descNew: "Arco is waar toonaangevende architecten hun gerealiseerde werk publiceren en de vakmensen vermelden waarmee ze hebben samengewerkt. Geen renders, geen reviews.",
          note: "HET ENIGE PAGINATYPE DAT NOG EEN VOORSTEL IS — de andere zeven staan live. Het merk staat hier NIET vooraan, anders dan op de homepage. Daar is Arco het onderwerp; hier is dat de pagina zelf, en de eerste woorden horen het sterkste signaal te dragen. Google plakt de sitenaam er bovendien zelf al bij. De formule stond op “{Paginanaam} Arco”, wat toevallig werkte voor “Over Arco” en nergens anders: “Prijzen Arco” is geen Nederlands. Over ons heeft net zomin eigen metadata en deelt zijn zoekresultaat dus letterlijk met de homepagina. Twee pagina's met dezelfde titel concurreren om dezelfde vraag.",
        },
        {
          done: true,
          type: "Pro discover",
          url: "arcolist.com › nl › professionals",
          titlePattern: "Architecten en vakmensen in Nederland met opgeleverd werk",
          descPattern: "Vind {aantal} professionals, van interieurarchitect tot aannemer. Ontdek hun projecten in {stad}, {stad} en {n} andere plaatsen. Benader ze rechtstreeks.",
          titleNew: "Architecten en vakmensen in Nederland met opgeleverd werk",
          descNew: "Vind 101 professionals, van interieurarchitect tot aannemer. Ontdek hun projecten in Amsterdam, Rotterdam en 88 andere plaatsen. Benader ze rechtstreeks.",
          note: "Staat live. Deze twee pagina's leveren 18 kliks, meer dan de 62 hubs eronder samen. De oude titel was niet slecht; hij noemde alleen geen enkel cijfer van de pagina zelf. “Erkende” is eruit — dat is een keurmerk dat Arco niet uitgeeft. Het aantal bedrijven en de plaatsen komen uit mv_professional_summary, met dezelfde statusfilter als het overzicht zelf gebruikt, zodat het getal klopt met wat de bezoeker ziet.",
        },
        {
          done: true,
          type: "Pro hub",
          url: "arcolist.com › nl › professionals › architect",
          titlePattern: "{Dienst} in {plaats} met opgeleverd werk",
          descPattern: "Vind {aantal} {dienst} in {stad}, {stad} en {n} andere plaatsen. Ontdek hun werk, van {projecttype} tot {projecttype}. Benader ze rechtstreeks.",
          titleNew: "Architecten in Nederland met opgeleverd werk",
          descNew: "Vind 100 architecten in Amsterdam, Rotterdam en 88 andere plaatsen. Ontdek hun werk, van grachtenpandrenovatie tot nieuwbouwvilla. Benader ze rechtstreeks.",
          note: "Staat live, met één gat: de stedenlijst (“{stad}, {stad} en {n} andere plaatsen”) wordt NIET gevuld. getProfessionalHubs levert per hub wel een telling maar geen steden op aantal, en daar een alfabetische greep voor doorgeven zou de twee grootste plaatsen suggereren zonder ze te weten. Zonder lijst noemt de omschrijving de plaats één keer. “Portfolio's” is wel weg — een woord dat renders toelaat en dus de claim ondergraaft. De titel was hetzelfde als die van het overzicht erboven, zodat de twee om dezelfde zoekvraag concurreerden; “met opgeleverd werk” onderscheidt hem. Bij een lange dienstnaam valt die claim weg in plaats van halverwege af te breken.",
        },
        {
          done: true,
          type: "Pro detail",
          url: "arcolist.com › nl › professionals › wolterinck-com",
          titlePattern: "{bedrijf} — {hoofddienst} in {plaats}",
          descPattern: "Ontdek het werk van {bedrijf}, professioneel gefotografeerd: {type}, {type} en {type} in {stad} en {stad}. Benader {bedrijf} rechtstreeks.",
          titleNew: "Wolterinck — interieurarchitect in Laren",
          descNew: "Ontdek het werk van Wolterinck, professioneel gefotografeerd: villa's, verbouwingen en interieurs in Laren en Blaricum. Benader Wolterinck rechtstreeks.",
          note: "De TITEL staat in de code: {naam} — {hoofddienst} in {plaats}, uit velden die de query al ophaalde. Daarbij bleek dat de locale niet werd doorgegeven, zodat de dienstnaam op de Nederlandse pagina Engels was. De OMSCHRIJVING staat nu ook live. Projecttypen en -plaatsen zaten niet in de metadata-query; ze komen uit één extra bevraging over project_professionals, want mv_project_summary draagt geen bedrijf-id. Gepubliceerd werk alleen. Heeft een bedrijf nog geen gepubliceerd werk, dan valt hij terug op de zelfgeschreven bedrijfstekst — dan is er niets te noemen en is die tekst het beste wat er is.",
        },
        {
          done: true,
          type: "Project discover",
          url: "arcolist.com › nl › projects",
          titlePattern: "Gerealiseerde architectuurprojecten in Nederland",
          descPattern: "Ontdek {aantal} gerealiseerde projecten, per ruimte gefotografeerd. Vind iedereen die eraan werkte, van interieurarchitect tot aannemer. Benader ze rechtstreeks.",
          titleNew: "Gerealiseerde architectuurprojecten in Nederland",
          descNew: "Ontdek 176 gerealiseerde projecten, per ruimte gefotografeerd. Vind iedereen die eraan werkte, van interieurarchitect tot aannemer. Benader ze rechtstreeks.",
          note: "Staat live. “Bijzondere” was een bijvoeglijk naamwoord zonder dekking; het aantal is wel te controleren en telt live mee. Dit is de ingang die het merkverhaal letterlijk beschrijft.",
        },
        {
          done: true,
          type: "Project hub",
          url: "arcolist.com › nl › projects › amsterdam",
          titlePattern: "Gerealiseerde {projecttype} in {plaats}",
          descPattern: "Ontdek {aantal} gerealiseerde projecten in {plaats}: {type}, {type} en {type}. Vind iedereen die eraan werkte. Benader ze rechtstreeks.",
          titleNew: "Gerealiseerde architectuurprojecten in Amsterdam",
          descNew: "Ontdek 24 gerealiseerde projecten in Amsterdam: grachtenpanden, appartementen en stadsvilla's. Vind iedereen die eraan werkte. Benader ze rechtstreeks.",
          note: "Staat live, met hetzelfde gat als de pro hub: de typenlijst (“{type}, {type} en {type}”) wordt NIET gevuld, want getHubs houdt geen telling per type per hub bij. Zonder lijst draagt de tweede zin de belofte. 76 pagina's, zes kliks. De titel had bijna dezelfde vorm als het overzicht erboven, dus de twee concurreerden om dezelfde zoekvraag; “Gerealiseerde” vooraan maakt het verschil zichtbaar en draagt de claim meteen. De drie landelijke scope-hubs (/projects/renovatie, /nieuwbouw, /interieur) houden hun met de hand geschreven tekst — om dezelfde reden als de Arco-pagina's: met de hand geschreven verslaat een formule.",
        },
        {
          done: true,
          type: "Project detail",
          url: "arcolist.com › nl › projects › villa-mel",
          titlePattern: "{projectnaam} — {bouwtype} in {plaats}",
          descPattern: "Gerealiseerd door {bureau}, professioneel gefotografeerd. Vind het hele team erachter, van interieurarchitect tot aannemer. Benader ze rechtstreeks.",
          titleNew: "Villa Mel — nieuwbouwvilla in Bloemendaal",
          descNew: "Gerealiseerd door Studio Piet Boon, professioneel gefotografeerd. Vind het hele team erachter, van interieurarchitect tot aannemer. Benader ze rechtstreeks.",
          note: "Staat live. Converteerde op 2,00% met een kale naam, het hoogst van alle detailpagina's: het plafond ligt dus hoger dan het eruitziet. De vermelding van het bureau verhuist van de titel naar de omschrijving, zodat de titel het bouwtype en de plaats kan dragen — de twee dingen waarop gezocht wordt. Twee wachters: wat al in de projectnaam staat wordt niet nog eens aangeplakt (“Villa Amsterdam” blijft “Villa Amsterdam”, niet “villa in Amsterdam”), en address_city bevat bij geïmporteerde rijen “Netherlands” of een provincienaam, die dezelfde denylist als de hubs eruit haalt. seo_title en seo_description blijven winnen: dat is een bewuste ingreep van een redacteur.",
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
    line1: "Exceptional architecture.",
    line2: "With credit to the creators.",
    eyebrow: "BUILT PROJECTS · CREDITED BY THE ARCHITECT · EDITORIALLY CURATED",
  },

  story: {
    more: "Read more",
    less: "Less",
    payoff: "The network behind exceptional architecture.",
    lead: "Arco is where leading architects publish their built work and credit the creators they worked with. We give clients a network of professionals — from interior designer to contractor — who earned their reputation through craft, not advertising.",
    p1: "Choosing a firm for your house is an expensive decision made on thin evidence. What you find online is usually a render, a mood board or a profile someone wrote about themselves. Finished work, photographed as it was handed over, is rare — and it is the only thing that predicts what you will get.",
    p2: "On the other side are firms with ten years of built work and nowhere neutral to show it. Their own site is a claim about themselves; a directory listing is one line in a list. Here that work sits in one place, and everyone who worked on it is named — by the architect, not by themselves.",
    p3: "Recognise your own ambition in a finished project and the match is made. You get in touch directly, with no intermediary and no brokerage fee.",
  },
  benefits: () => [
    {
      title: "Explore finished work",
      body: "Filter by room, style and place. Everything you find has been built and professionally photographed — you are looking at a real project, not a render or an AI image.",
      rests: ["No image without provenance"],
    },
    {
      title: "Find the whole team",
      body: "Every project lists the creators involved, from interior designer to contractor, credited by the architect who worked with them.",
      rests: ["Credits over reviews"],
    },
    {
      title: "Connect with them directly",
      body: "Assemble your own team from the professionals credited on the projects. You approach them yourself, with no intermediary.",
      rests: ["The best have to want to be here"],
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
    sections: {
      formulas: "Page types",
      pages: "Arco pages",
    },
    pages: {
      headers: ["Page", "Proposed title", "Search description", "Today"],
      rows: [
        ["/about", "About Arco — why only built work", "Arco is where leading architects publish their built work and credit the specialists they worked with. No renders, no reviews.", "inherits the homepage"],
        ["/businesses/architects", "For architects — publish your work, credit your team", "The neutral place for your built work: every project on your own page, with everyone who contributed, credited by you. Free, forever.", "inherits the homepage"],
        ["/businesses/professionals", "For specialists — recognised for the work you delivered", "The neutral place for the work you delivered: every project on your own page, credited by the architect you worked with. Not through promotion.", "inherits the homepage"],
        ["/businesses/photography", "Photography — Arco", "—", "404 outside admin"],
        ["/homeowner", "My Arco", "—", "signed-in only"],
        ["/pricing", "Pricing — what a place on Arco costs", "Publishing projects is free, forever. Pro gives you a full company page and Arco Approved verification for €39 a month.", "English only"],
        ["/privacy", "Privacy policy — what data Arco keeps", "Which data Arco collects about you, what it is used for, how long it is kept, and how to have it removed from the platform.", "English only"],
        ["/terms", "Terms — the rules for using Arco", "The terms for using Arco: what you may publish, who keeps the work and the rights to it, and when a page is taken offline.", "English only"],
        ["/help-center", "Help centre — answers to the most asked questions", "How to claim your company page, publish a project, credit your team and contact a firm. The most asked questions, answered briefly.", "English only"],
      ],
      note: "These pages have no formula — they are written by hand, following {Subject} — {what the page promises}. The description sits beside the title because a title cannot be judged without its second line: the title takes the query, the description takes the promise, and whatever the title cannot carry belongs there. /businesses/architects shows it literally — the hero has three beats (“Publish your work. Credit your team. Set the standard.”), two fit the title, the third goes in the description. Five pages have no title of their own and so silently inherit the title.default from app/layout.tsx. Until today that was literally the same title as the homepage; now that the homepage has its own, these five carry an English default line no page deliberately holds any more — from competing with the homepage to being nobody's title at all. /businesses/architects is the worst of those: it is the page every button on the site points to. Two of those five are not search results and need not become any: /businesses/photography 404s outside admin until the photographer roster is full enough, and /homeowner is the signed-in account. Those two get a plain title and robots noindex — a description would only suggest they can be found. The four English titles sit on Dutch pages, and /help-center's description still says “post projects, hire professionals”: that is the marketplace that left with /new-project. That this could happen is the real problem, not the titles themselves: there was no check. `pnpm check:titles` now walks every public page and reports which ones have no title of their own — redirects and the homepage excepted, since the homepage carries the default rightly. Today it reports twelve. Five of those are here; the other seven — five error pages and two /products pages — fall under the same exception as photography and homeowner. The four rows here it does NOT report are precisely the four with an English title: a title of their own they have, just the wrong one."
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
      pattern: "formula",
      proposed: "proposed",
      items: [
        {
          done: true,
          type: "Arco home",
          url: "arcolist.com › en",
          titlePattern: "Arco — the network behind exceptional architecture",
          descPattern: "Explore {projects} built architecture projects, professionally photographed. Find the whole team behind them, from interior designer to contractor. Connect directly.",
          titleNew: "Arco — the network behind exceptional architecture",
          descNew: "Explore 176 built architecture projects, professionally photographed. Find the whole team behind them, from interior designer to contractor. Connect directly.",
          note: "Title and description are live, in lib/seo/copy.ts. The figure counts live and so cannot go stale: the page revalidates every five minutes. At 158 characters this proposal sits just inside the ~155-160 Google renders on desktop; on mobile the last sentence is cut either way, so the most important promise does not belong at the end. The three benefits appear in the order of the eyebrow. The title was the English default from app/layout.tsx until now; this is the only page where the brand may lead, because here Arco is the subject and the traffic is brand traffic.",
        },
        {
          done: false,
          type: "Arco pages",
          url: "arcolist.com › en › about",
          titlePattern: "{Subject} — {what the page promises}",
          descPattern: "{One sentence on what this page does}. No renders, no reviews — only delivered work, credited by the architect.",
          titleNew: "About Arco — why only built work",
          descNew: "Arco is where leading architects publish their built work and credit the specialists they worked with. No renders, no reviews.",
          note: "THE ONLY PAGE TYPE STILL A PROPOSAL — the other seven are live. The brand does NOT lead here, unlike on the homepage. There Arco is the subject; here the page is, and the first words should carry the strongest signal. Google appends the site name by itself anyway. The formula read “{Page name} Arco”, which happened to work for “About Arco” and nowhere else: “Pricing Arco” is not English. About has no metadata of its own either, so it shares its search result verbatim with the homepage. Two pages with the same title compete for the same query.",
        },
        {
          done: true,
          type: "Pro discover",
          url: "arcolist.com › en › professionals",
          titlePattern: "Dutch architects and specialists with delivered work",
          descPattern: "Find {count} professionals, from interior designer to contractor. Explore their projects in {city}, {city} and {n} other places. Connect with them directly.",
          titleNew: "Dutch architects and specialists with delivered work",
          descNew: "Find 101 professionals, from interior designer to contractor. Explore their projects in Amsterdam, Rotterdam and 88 other places. Connect with them directly.",
          note: "Live. These two pages produce 18 clicks, more than the 62 hubs beneath them combined. The old title was not bad; it simply named no figure from the page itself. “Verified” is gone — that is a certification Arco does not issue. The company count and the places come from mv_professional_summary, with the same status filter the index itself uses, so the figure matches what the visitor sees.",
        },
        {
          done: true,
          type: "Pro hub",
          url: "arcolist.com › en › professionals › architect",
          titlePattern: "{Service} in {place} with delivered work",
          descPattern: "Find {count} {service} in {city}, {city} and {n} other places. Explore their work, from {project type} to {project type}. Connect directly.",
          titleNew: "Architects in the Netherlands with delivered work",
          descNew: "Find 100 architects in Amsterdam, Rotterdam and 88 other places. Explore their work, from canal-house renovation to new-build villa. Connect directly.",
          note: "Live, with one gap: the city list (“{city}, {city} and {n} other places”) is NOT filled. getProfessionalHubs gives a count per hub but no cities by count, and passing an alphabetical grab would present two cities as the largest without knowing that. Without the list the description names the place once. “Portfolios” is gone — a word that admits renders and so undercuts the claim. The title was the same as the index above it, so the two competed for the same query; “with delivered work” sets it apart. On a long service name that claim drops rather than breaking off halfway.",
        },
        {
          done: true,
          type: "Pro detail",
          url: "arcolist.com › en › professionals › wolterinck-com",
          titlePattern: "{company} — {primary service} in {city}",
          descPattern: "Explore the work of {company}, professionally photographed: {type}, {type} and {type} in {city} and {city}. Connect with {company} directly.",
          titleNew: "Wolterinck — Interior designer in Laren",
          descNew: "Explore the work of Wolterinck, professionally photographed: villas, renovations and interiors in Laren and Blaricum. Connect with Wolterinck directly.",
          note: "The TITLE is in the code: {name} — {primary service} in {city}, from fields the query already fetched. In doing so it turned out the locale was not being passed, so the service name was English on the Dutch page too. The DESCRIPTION is now live too. Project types and cities were not in the metadata query; they come from one extra lookup over project_professionals, because mv_project_summary carries no company id. Published work only. Where a company has no published work it falls back to their own company text — there is nothing to name then, and that text is the best there is.",
        },
        {
          done: true,
          type: "Project discover",
          url: "arcolist.com › en › projects",
          titlePattern: "Built architecture projects in the Netherlands",
          descPattern: "Explore {count} built projects, photographed room by room. Find everyone who worked on them, from interior designer to contractor. Connect with them directly.",
          titleNew: "Built architecture projects in the Netherlands",
          descNew: "Explore 176 built projects, photographed room by room. Find everyone who worked on them, from interior designer to contractor. Connect with them directly.",
          note: "Live. “Curated” was an adjective with nothing behind it; the figure can be checked and counts live. This is the entry point the brand story literally describes.",
        },
        {
          done: true,
          type: "Project hub",
          url: "arcolist.com › en › projects › amsterdam",
          titlePattern: "Built {project type} in {place}",
          descPattern: "Explore {count} built projects in {place}: {type}, {type} and {type}. Find everyone who worked on them. Connect with them directly.",
          titleNew: "Built architecture projects in Amsterdam",
          descNew: "Explore 24 built projects in Amsterdam: canal houses, apartments and city villas. Find everyone who worked on them. Connect with them directly.",
          note: "Live, with the same gap as the pro hub: the type list (“{type}, {type} and {type}”) is NOT filled, because getHubs keeps no per-type count per hub. Without the list the second sentence carries the promise. 76 pages, six clicks. The title had almost the same shape as the index above it, so the two competed for the same query; “Built” in front makes the difference visible and carries the claim at once. The three national scope hubs (/projects/renovatie, /nieuwbouw, /interieur) keep their hand-written copy — for the same reason as the Arco pages: hand-written beats a formula.",
        },
        {
          done: true,
          type: "Project detail",
          url: "arcolist.com › en › projects › villa-mel",
          titlePattern: "{project name} — {building type} in {place}",
          descPattern: "Built by {firm}, professionally photographed. Find the whole team behind it, from interior designer to contractor. Connect with them directly.",
          titleNew: "Villa Mel — new-build villa in Bloemendaal",
          descNew: "Built by Studio Piet Boon, professionally photographed. Find the whole team behind it, from interior designer to contractor. Connect with them directly.",
          note: "Live. Converted at 2.00% on a bare name, the best of all detail pages: the ceiling is higher than it looks. The firm credit moves from the title to the description, so the title can carry the building type and the place — the two things people search for. Two guards: whatever is already in the project name is not appended again (“Villa Amsterdam” stays “Villa Amsterdam”, not “villa in Amsterdam”), and address_city holds “Netherlands” or a province name on imported rows, which the same denylist as the hubs filters out. seo_title and seo_description still win: that is a deliberate editorial override.",
        },
      ],
    },
  },
}

export const COPY: Record<Lang, Copy> = { nl, en }
