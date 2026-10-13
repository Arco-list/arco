-- Dag, week, maand of jaar — dezelfde keuze als op het groeidashboard.
--
-- seo_weekly_by_type kende alleen weken, en de bucketeenheid zit in
-- date_trunc, niet in de rijen: één parameter erbij en dezelfde query
-- doet alle vier. Postgres rekent een gewijzigde parameterlijst als een
-- ANDERE functie, dus dit is geen vervanging maar een nieuwe naam.
-- seo_weekly_by_type blijft achter en wordt nergens meer aangeroepen;
-- die mag met de hand weg (de migratietool weigert DROP).
--
-- bucket_unit komt als parameter binnen, niet als string in de query,
-- dus er valt niets te injecteren; de aanroepende kant houdt de lijst
-- toegestane waarden bij zodat een typefout op weken uitkomt in plaats
-- van halverwege de pagina te struikelen.

CREATE OR REPLACE FUNCTION public.seo_metrics_by_bucket(
  bucket_unit  text DEFAULT 'week',
  bucket_count int  DEFAULT 8
)
RETURNS TABLE (
  bucket_start      date,
  page_type         text,
  urls              bigint,
  impressions       bigint,
  clicks            bigint,
  avg_position      numeric,
  impressions_top10 bigint
)
LANGUAGE sql STABLE AS $$
  WITH bounds AS (
    SELECT (date_trunc(bucket_unit,
              COALESCE((SELECT max(metric_date) FROM public.seo_page_metrics), CURRENT_DATE))
            - ((GREATEST(bucket_count, 1) - 1) * ('1 ' || bucket_unit)::interval))::date AS first_bucket
  )
  SELECT
    date_trunc(bucket_unit, m.metric_date)::date,
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
  WHERE m.metric_date >= b.first_bucket
  GROUP BY 1, 2
$$;

COMMENT ON FUNCTION public.seo_metrics_by_bucket IS
  'Reeks per paginatype voor /admin/seo, gebucket op day/week/month/year. Loopt tot de laatste dag waarvoor Search Console data gaf.';
