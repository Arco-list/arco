-- DE RUWE REGEL BEWAREN, DE INDELING ERUIT AFLEIDEN.
--
-- Tot nu werd Search Console op twee manieren bevraagd, allebei met een
-- filter: seo_daily_metrics vraagt om URL's die "/projects/" bevatten,
-- de per-rij seo_*-kolommen vragen per bedrijf en per project om één
-- adres. Wat buiten die filters valt, bestaat niet — en dat bleek op 4
-- oktober 83% van alle vertoningen te zijn.
--
-- De hubpagina's (/professionals/amsterdam, /projects/renovatie) wonen
-- op exact dezelfde URL-vorm als een bedrijfsprofiel of een project,
-- dus een filter op URL-patroon kan ze niet scheiden. Alleen een
-- vergelijking met onze eigen sluglijsten doet dat. In de piekweek van
-- 24 augustus stonden daar 8.234 vertoningen op gemiddeld positie 67,
-- tegen 270 op de echte bedrijfsprofielen — twee compleet verschillende
-- populaties, die in elk gemiddelde over "/professionals/" samenvielen.
--
-- Vandaar: één aanroep op date × page, elke regel bewaard, en de
-- indeling als AFGELEIDE kolom. page_type is herberekenbaar; page_url
-- is het feit. Verandert de indeling (een blog op /journal, een nieuwe
-- hubsoort), dan is dat een UPDATE over bestaande rijen in plaats van
-- een ophaalslag die opnieuw moet. En wat de regels niet kennen krijgt
-- type 'overig' in plaats van weg te vallen: die rij is het alarm dat
-- /reset-password en de geïndexeerde filter-URL's aan het licht bracht.

CREATE TABLE IF NOT EXISTS public.seo_page_metrics (
  metric_date date        NOT NULL,
  page_url    text        NOT NULL,
  -- Afgeleid uit page_url door classifyPageType in lib/seo/page-types.ts.
  -- Opgeslagen omdat er per type gegroepeerd wordt, niet omdat het een
  -- feit is: bij een regelwijziging wordt deze kolom herschreven.
  page_type   text        NOT NULL,
  impressions integer     NOT NULL DEFAULT 0,
  clicks      integer     NOT NULL DEFAULT 0,
  -- Daggemiddelde positie voor die URL. Google levert geen verdeling
  -- per vertoning, dus "% op positie 1-10" is per definitie een
  -- benadering op dit gemiddelde.
  position    numeric(6,2),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_date, page_url)
);

COMMENT ON TABLE public.seo_page_metrics IS
  'Search Console per pagina per dag. Gevuld door syncSeoPageMetrics in lib/seo/sync-pages.ts. page_url is het feit, page_type de afgeleide — hergroeperen kost een UPDATE, geen nieuwe ophaalslag.';

CREATE INDEX IF NOT EXISTS seo_page_metrics_type_date_idx
  ON public.seo_page_metrics (page_type, metric_date DESC);
CREATE INDEX IF NOT EXISTS seo_page_metrics_date_idx
  ON public.seo_page_metrics (metric_date DESC);

ALTER TABLE public.seo_page_metrics ENABLE ROW LEVEL SECURITY;


-- DE NOEMER VAN % RANKED.
--
-- "Ranked" = echt in een zoekresultaat verschenen, en dat afzetten
-- tegen wat we aanbieden vraagt om een telling van wat we aanbieden.
-- Die stond nergens: de sitemap is altijd de stand van NU, dus een
-- percentage over augustus werd tegen de pagina's van vandaag gerekend
-- en kwam structureel te laag uit. Eén telling per nacht repareert dat
-- voorgoed, en kost één rij per type per dag.
--
-- Let op de verdubbeling bij het vullen: de sitemap zet /nl als <loc>
-- met /en als alternate, terwijl Search Console de twee als aparte
-- URL's rapporteert. Teller en noemer moeten hetzelfde tellen.

CREATE TABLE IF NOT EXISTS public.seo_sitemap_counts (
  snapshot_date date    NOT NULL,
  page_type     text    NOT NULL,
  url_count     integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, page_type)
);

COMMENT ON TABLE public.seo_sitemap_counts IS
  'Hoeveel URL''s we per paginatype aanbieden, per dag. Noemer van % Ranked op /admin/seo.';

ALTER TABLE public.seo_sitemap_counts ENABLE ROW LEVEL SECURITY;


-- ZOEKOPDRACHTEN KRIJGEN EEN PAGINATYPE.
--
-- seo_query_metrics (migratie 275) hield bewust geen paginadimensie
-- bij, uit vrees dat een tweede dimensie dekking zou kosten aan Googles
-- anonimiseringsdrempel. Gemeten op 4 oktober klopt dat niet: page x
-- query levert 13,7% MEER vertoningen dan query alleen, omdat Google
-- per dimensieset anders ontdubbelt — een zoekresultaat waarin twee van
-- onze pagina's staan telt daar twee keer, hier één keer.
--
-- De angst was dus ongegrond en de winst groot: zonder paginatype is
-- niet te zien dat "interieur architect" op de hubs landt en niet op de
-- bedrijfsprofielen. scope heette al bijna wat het nu wordt; de kolom
-- wordt hernoemd in plaats van verdubbeld. De tabel is leeg, dus er
-- valt niets te migreren.
--
-- GEVOLG: de som over deze tabel ligt structureel HOGER dan die over
-- seo_page_metrics. Dat is geen synchronisatiefout maar het ontdubbelen
-- hierboven, en het is de reden dat beide tabellen blijven bestaan.

ALTER TABLE public.seo_query_metrics RENAME COLUMN scope TO page_type;

COMMENT ON COLUMN public.seo_query_metrics.page_type IS
  'Hetzelfde type als seo_page_metrics.page_type, toegekend aan de pagina waarop de zoekopdracht landde. Telt dubbel wanneer één zoekresultaat meerdere van onze pagina''s bevat.';

COMMENT ON TABLE public.seo_query_metrics IS
  'Search Console per zoekopdracht per paginatype per dag. Gevuld door syncSeoQueryMetrics in lib/seo/sync-pages.ts. Google anonimiseert zeldzame zoekopdrachten, dus dit dekt nooit alles.';
