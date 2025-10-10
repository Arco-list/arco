-- Migration: expose company gallery photos for public professional detail pages
-- Description: Security definer function returning ordered company photos when company is publicly listed on Plus plan.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_company_photos(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  url text,
  alt_text text,
  is_cover boolean,
  order_index integer,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.url,
    cp.alt_text,
    cp.is_cover,
    cp.order_index,
    cp.created_at
  FROM public.company_photos AS cp
  JOIN public.companies AS c
    ON c.id = cp.company_id
  WHERE
    cp.company_id = p_company_id
    AND c.plan_tier = 'plus'::company_plan_tier
    AND c.status = 'listed'::company_status
  ORDER BY
    cp.is_cover DESC,
    cp.order_index ASC,
    cp.created_at ASC
  LIMIT 30;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.get_public_company_photos(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_company_photos(uuid) TO authenticated;

COMMIT;
