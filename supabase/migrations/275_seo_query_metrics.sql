-- WAAR worden we voor getoond?
--
-- Search Console is al drie maanden gesynct, maar alleen langs twee
-- assen: per dag (seo_daily_metrics) en per pagina (companies.seo_*,
-- projects.seo_*). De derde — de zoekopdracht — werd nooit opgehaald,
-- en daarmee is elke verklaring voor een piek giswerk.
--
-- Dat werd concreet op 2 oktober. Vertoningen op /professionals/ gingen
-- van 10–100 per week naar 1.721, 8.504, 4.219 en zakten terug naar
-- 500–900. De projectpagina's deden exact hetzelfde in exact dezelfde
-- weken, dus het was iets op siteniveau — maar WAT, daar is geen rij
-- voor. Gemiddelde positie 50,9 bij 23,9k vertoningen en 208 klikken
-- zegt dat we breed verschijnen op iets waar we niet voor meedoen, en
-- zonder de queries is niet te zeggen waarop.
--
-- GEEN PAGINADIMENSIE HIERIN, bewust. Google laat (date, query, page)
-- toe, maar dat vermenigvuldigt de rijen en elke extra dimensie kost
-- dekking: zeldzame combinaties vallen onder de anonimiseringsdrempel
-- weg. Pagina-prestaties staan al per rij op companies en projects;
-- wat hier ontbrak is de zoekkant. De scope-kolom houdt de twee
-- kanten van de site uit elkaar, zoals in seo_daily_metrics.

CREATE TABLE IF NOT EXISTS public.seo_query_metrics (
  metric_date   date        NOT NULL,
  scope         text        NOT NULL,
  query         text        NOT NULL,
  impressions   integer     NOT NULL DEFAULT 0,
  clicks        integer     NOT NULL DEFAULT 0,
  -- Gemiddelde positie over die dag voor die query. Numeric omdat
  -- Google decimalen levert en een afgeronde 50 iets anders betekent
  -- dan 50,4 — het verschil tussen onderaan pagina 5 en bovenaan.
  position      numeric(6,2),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_date, scope, query)
);

COMMENT ON TABLE public.seo_query_metrics IS
  'Dagelijkse Search Console-cijfers per zoekopdracht, per sitekant (scope). Gevuld door syncGscQueries in lib/gsc-sync.ts. Google anonimiseert zeldzame queries, dus de som hiervan ligt STRUCTUREEL onder seo_daily_metrics — dat is geen synchronisatiefout maar Googles privacydrempel, en het is de reden dat de dagtotalen apart blijven bestaan.';

COMMENT ON COLUMN public.seo_query_metrics.scope IS
  'companies = URLs met /professionals/, projects = URLs met /projects/. Dezelfde indeling als seo_daily_metrics, zodat de twee naast elkaar te lezen zijn.';

-- Lezen gebeurt bijna altijd "recentste eerst, binnen één scope".
CREATE INDEX IF NOT EXISTS seo_query_metrics_scope_date_idx
  ON public.seo_query_metrics (scope, metric_date DESC);

-- En "welke query doet het goed/slecht", over een periode.
CREATE INDEX IF NOT EXISTS seo_query_metrics_query_idx
  ON public.seo_query_metrics (query);

ALTER TABLE public.seo_query_metrics ENABLE ROW LEVEL SECURITY;

-- Server-only, zoals de andere seo-tabellen: de service role schrijft,
-- de admin-pagina's lezen via server actions. Geen policy betekent
-- geen toegang voor anon/authenticated, wat hier de bedoeling is.
