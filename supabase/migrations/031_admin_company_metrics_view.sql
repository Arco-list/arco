-- Migration: Admin company professional metrics view
-- Description: Aggregates professional counts, project linkage, and rating stats per company for admin dashboards.

DROP VIEW IF EXISTS public.admin_company_professional_metrics;

CREATE VIEW public.admin_company_professional_metrics AS
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
),
rating_stats AS (
  SELECT
    p.company_id,
    ROUND(AVG(pr.overall_rating)::numeric, 2)::double precision AS average_rating,
    SUM(COALESCE(pr.total_reviews, 0))::integer AS total_reviews
  FROM public.professionals p
  JOIN public.professional_ratings pr
    ON pr.professional_id = p.id
  WHERE p.company_id IS NOT NULL
    AND pr.overall_rating IS NOT NULL
    AND pr.overall_rating > 0
  GROUP BY p.company_id
)
SELECT
  c.id AS company_id,
  COALESCE(pc.professional_count, 0) AS professional_count,
  COALESCE(prc.projects_linked, 0) AS projects_linked,
  rs.average_rating,
  COALESCE(rs.total_reviews, 0) AS total_reviews
FROM public.companies c
LEFT JOIN professional_counts pc ON pc.company_id = c.id
LEFT JOIN project_counts prc ON prc.company_id = c.id
LEFT JOIN rating_stats rs ON rs.company_id = c.id;
