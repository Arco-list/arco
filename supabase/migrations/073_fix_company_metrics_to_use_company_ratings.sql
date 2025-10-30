-- Migration: Fix company_metrics to use company_ratings instead of professional_ratings
-- Description: Update the view to use the new company-based ratings structure

DROP VIEW IF EXISTS public.company_metrics;

CREATE VIEW public.company_metrics AS
WITH professional_counts AS (
  SELECT
    company_id,
    COUNT(*)::integer AS professional_count
  FROM public.professionals
  WHERE company_id IS NOT NULL
  GROUP BY company_id
),
project_counts AS (
  SELECT
    p.company_id,
    COUNT(DISTINCT pp.project_id)::integer AS projects_linked
  FROM public.professionals p
  JOIN public.project_professionals pp
    ON pp.professional_id = p.id
  WHERE p.company_id IS NOT NULL
  GROUP BY p.company_id
)
SELECT
  c.id AS company_id,
  COALESCE(pc.professional_count, 0) AS professional_count,
  COALESCE(prc.projects_linked, 0) AS projects_linked,
  cr.overall_rating AS average_rating,
  COALESCE(cr.total_reviews, 0) AS total_reviews
FROM public.companies c
LEFT JOIN professional_counts pc ON pc.company_id = c.id
LEFT JOIN project_counts prc ON prc.company_id = c.id
LEFT JOIN public.company_ratings cr ON cr.company_id = c.id;
