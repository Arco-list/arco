-- Align get_professional_location_facets with search_professionals (migration 133),
-- which surfaces both 'listed' and 'prospected' companies on the discover grid.
-- Without this, the location filter only shows cities that have a 'listed' company,
-- hiding locations where only prospected companies exist.

CREATE OR REPLACE FUNCTION public.get_professional_location_facets()
RETURNS TABLE (
  country TEXT,
  state_region TEXT,
  city TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.company_country,
    p.company_state_region,
    p.company_city
  FROM public.mv_professional_summary p
  WHERE
    p.company_status IN ('listed', 'prospected')
  ORDER BY
    p.company_country,
    p.company_state_region,
    p.company_city;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_professional_location_facets() TO anon;
GRANT EXECUTE ON FUNCTION public.get_professional_location_facets() TO authenticated;
