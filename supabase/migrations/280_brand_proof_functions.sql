-- De cijfers waar de merkclaim op rust, uit de database in plaats van uit
-- een document.
--
-- CLAUDE.md noemt `reviews` en `company_ratings` als kerntabellen. Geen van
-- beide bestaat. Zo verouderen vastgelegde cijfers: iemand schrijft ze één
-- keer op, en niemand merkt wanneer ze niet meer kloppen. Een propositie
-- die op zo'n getal steunt is erger dan geen propositie, want ze klinkt
-- precies even stellig.
--
-- Het getal dat telt is firms_with_built_work tegen firms. "Alleen gebouwd
-- werk" is pas op 153 hubpagina's te stempelen als het op élk zichtbaar
-- bureau waar is; zakt die verhouding, dan moet de claim mee. Op 5 oktober
-- 2026 stond het op 100 van de 101.

CREATE OR REPLACE FUNCTION public.brand_proof_counts()
RETURNS TABLE (
  firms                 bigint,
  firms_with_built_work bigint,
  projects              bigint,
  photos                bigint,
  rooms                 bigint,
  cities                bigint
)
LANGUAGE sql STABLE AS $$
  WITH zichtbaar AS (
    SELECT id FROM public.companies WHERE status IN ('listed', 'prospected')
  ),
  met_werk AS (
    SELECT DISTINCT pp.company_id
    FROM public.project_professionals pp
    JOIN public.projects p ON p.id = pp.project_id AND p.status = 'published'
    WHERE pp.company_id IS NOT NULL
  )
  SELECT
    (SELECT count(*) FROM zichtbaar),
    (SELECT count(*) FROM zichtbaar z JOIN met_werk w ON w.company_id = z.id),
    (SELECT count(*) FROM public.projects WHERE status = 'published'),
    (SELECT count(*) FROM public.project_photos ph
       JOIN public.projects p ON p.id = ph.project_id AND p.status = 'published'),
    (SELECT count(*) FROM public.project_features pf
       JOIN public.projects p ON p.id = pf.project_id AND p.status = 'published'),
    (SELECT count(DISTINCT lower(trim(address_city))) FROM public.projects
       WHERE status = 'published' AND address_city IS NOT NULL AND length(trim(address_city)) > 1)
$$;

COMMENT ON FUNCTION public.brand_proof_counts IS
  'Bewijscijfers voor /admin/proposition. firms_with_built_work tegen firms is de test die bepaalt of de claim op elke pagina gestempeld mag worden.';

-- Hoe elk paginatype het doet in de zoekresultaten — het argument waarom
-- de titels één vorm moeten krijgen. Leest dezelfde tabel als /admin/seo.
CREATE OR REPLACE FUNCTION public.brand_page_type_performance(day_count int DEFAULT 42)
RETURNS TABLE (
  page_type    text,
  impressions  bigint,
  clicks       bigint,
  ctr          numeric,
  avg_position numeric
)
LANGUAGE sql STABLE AS $$
  SELECT
    m.page_type,
    sum(m.impressions),
    sum(m.clicks),
    CASE WHEN sum(m.impressions) > 0
         THEN round(100.0 * sum(m.clicks) / sum(m.impressions), 2) END,
    CASE WHEN sum(m.impressions) > 0
         THEN round(sum(m.position * m.impressions) / sum(m.impressions), 1) END
  FROM public.seo_page_metrics m
  WHERE m.metric_date >= CURRENT_DATE - day_count
  GROUP BY m.page_type
$$;

COMMENT ON FUNCTION public.brand_page_type_performance IS
  'CTR en positie per paginatype voor /admin/proposition — waarom de titelvormen gelijkgetrokken moeten worden.';
