-- Aggregeren gebeurt in de database, niet in de pagina.
--
-- PostgREST kapt een antwoord af op 1.000 rijen. seo_page_metrics loopt
-- bij een backfill van 16 maanden in de tienduizenden, dus "alles
-- ophalen en in TypeScript optellen" levert stilletjes een getal over
-- het oudste deel van de data. Precies die fout zat eerder dit jaar in
-- recomputeProspectLastEmailSentAt, maandenlang, zonder dat iets faalde.
--
-- De paginatypen worden als array MEEGEGEVEN in plaats van hier
-- gedefinieerd: lib/seo/page-types.ts is de enige plek die weet welke
-- typen bij welke marktzijde horen, en die kennis hoort niet in twee
-- talen te bestaan.

CREATE OR REPLACE FUNCTION public.seo_weekly_by_type(week_count int DEFAULT 8)
RETURNS TABLE (
  week_start        date,
  page_type         text,
  urls              bigint,
  impressions       bigint,
  clicks            bigint,
  avg_position      numeric,
  impressions_top10 bigint
)
LANGUAGE sql STABLE AS $$
  WITH bounds AS (
    SELECT (date_trunc('week', COALESCE((SELECT max(metric_date) FROM public.seo_page_metrics), CURRENT_DATE))::date
            - ((GREATEST(week_count, 1) - 1) * 7)) AS first_week
  )
  SELECT
    date_trunc('week', m.metric_date)::date,
    m.page_type,
    count(DISTINCT m.page_url),
    sum(m.impressions),
    sum(m.clicks),
    -- Gewogen op vertoningen: een pagina die één keer verscheen mag
    -- niet even zwaar wegen als een die er 8.000 haalde.
    CASE WHEN sum(m.impressions) > 0
         THEN round(sum(m.position * m.impressions) / sum(m.impressions), 1) END,
    -- Benadering: Google geeft geen positieverdeling per vertoning,
    -- alleen een daggemiddelde per URL.
    COALESCE(sum(m.impressions) FILTER (WHERE m.position <= 10), 0)
  FROM public.seo_page_metrics m, bounds b
  WHERE m.metric_date >= b.first_week
  GROUP BY 1, 2
$$;

COMMENT ON FUNCTION public.seo_weekly_by_type IS
  'Weekreeks per paginatype voor /admin/seo. Weken beginnen maandag en lopen tot de laatste dag waarvoor Search Console data gaf.';

CREATE OR REPLACE FUNCTION public.seo_top_queries(
  day_count int DEFAULT 28,
  types     text[] DEFAULT NULL,
  row_limit int DEFAULT 10
)
RETURNS TABLE (query text, impressions bigint, clicks bigint, avg_position numeric)
LANGUAGE sql STABLE AS $$
  SELECT q.query, sum(q.impressions), sum(q.clicks),
         CASE WHEN sum(q.impressions) > 0
              THEN round(sum(q.position * q.impressions) / sum(q.impressions), 1) END
  FROM public.seo_query_metrics q
  WHERE q.metric_date >= CURRENT_DATE - day_count
    AND (types IS NULL OR q.page_type = ANY(types))
  GROUP BY q.query
  ORDER BY sum(q.impressions) DESC
  LIMIT row_limit
$$;

COMMENT ON FUNCTION public.seo_top_queries IS
  'Top zoekopdrachten op vertoningen. Telt hoger dan seo_page_metrics omdat Google per dimensieset anders ontdubbelt — dat is verwacht, geen fout.';

CREATE OR REPLACE FUNCTION public.seo_top_pages(
  day_count int DEFAULT 28,
  types     text[] DEFAULT NULL,
  row_limit int DEFAULT 10
)
RETURNS TABLE (page_url text, page_type text, impressions bigint, clicks bigint, avg_position numeric)
LANGUAGE sql STABLE AS $$
  SELECT m.page_url, min(m.page_type), sum(m.impressions), sum(m.clicks),
         CASE WHEN sum(m.impressions) > 0
              THEN round(sum(m.position * m.impressions) / sum(m.impressions), 1) END
  FROM public.seo_page_metrics m
  WHERE m.metric_date >= CURRENT_DATE - day_count
    AND (types IS NULL OR m.page_type = ANY(types))
  GROUP BY m.page_url
  ORDER BY sum(m.impressions) DESC
  LIMIT row_limit
$$;

COMMENT ON FUNCTION public.seo_top_pages IS
  'Top pagina''s op vertoningen voor /admin/seo.';
