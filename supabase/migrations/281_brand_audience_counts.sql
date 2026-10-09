-- Hoe groot elke doelgroep en elk product vandaag is, voor /admin/brand.
--
-- Apart van brand_proof_counts omdat Postgres een gewijzigde
-- RETURNS TABLE als een andere functie rekent, en de migratietool DROP
-- weigert. Liever een tweede functie met een eigen vraag dan één die
-- over alles tegelijk gaat.
--
-- Deze cijfers staan naast secties waarvan de helft "later" is. Dat is
-- het punt: een doelgroep die bestaat heeft een getal, een doelgroep die
-- gepland is heeft dat niet, en het verschil moet zichtbaar zijn zonder
-- dat iemand het erbij moet onthouden.

CREATE OR REPLACE FUNCTION public.brand_audience_counts()
RETURNS TABLE (
  homeowners            bigint,
  professional_users    bigint,
  companies_listed      bigint,
  companies_prospected  bigint,
  projects_published    bigint,
  paying_subscriptions  bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    (SELECT count(*) FROM public.profiles WHERE 'client' = ANY(user_types)),
    (SELECT count(*) FROM public.profiles WHERE 'professional' = ANY(user_types)),
    (SELECT count(*) FROM public.companies WHERE status = 'listed'),
    (SELECT count(*) FROM public.companies WHERE status = 'prospected'),
    (SELECT count(*) FROM public.projects WHERE status = 'published'),
    (SELECT count(*) FROM public.subscriptions
      WHERE status IN ('active', 'trialing') AND livemode IS TRUE)
$$;

COMMENT ON FUNCTION public.brand_audience_counts IS
  'Omvang per doelgroep en product voor /admin/brand. Secties zonder getal zijn gepland, niet leeg.';
