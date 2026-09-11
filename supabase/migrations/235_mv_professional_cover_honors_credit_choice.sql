-- ═══════════════════════════════════════════════════════════════════════
-- 235: Discover cover honors the photo chosen on a credit
-- ═══════════════════════════════════════════════════════════════════════
-- Contributors (and admins on their behalf) pick which photo of the
-- credited project represents them — project_professionals.
-- cover_photo_id, set by the "Omslag bijwerken" flow. The discover
-- card's cover chain in mv_professional_summary never read that
-- column: it fell straight through to "any photo of any credited
-- project", so every company credited on the same project showed the
-- identical image and the chosen one was ignored (Urban Creative /
-- PHNX Group, Sep 2026).
--
-- New cover priority:
--   1. companies.hero_photo_url            (explicit company-level)
--   2. company_photos with is_cover        (own gallery cover)
--   3. any company_photo                   (own gallery)
--   4. photo chosen on a credit            ← NEW (newest credit wins)
--   5. any photo from a credited project   (generic fallback)
--
-- Everything else is identical to the previous definition. The view is
-- recreated (matviews can't ALTER a column expression) and populated;
-- the three indexes are restored.

DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary;

CREATE MATERIALIZED VIEW public.mv_professional_summary AS
 SELECT c.id,
    c.id AS company_id,
    c.id AS company_id_full,
    pe.auth_user_id AS user_id,
    pe.first_name,
    pe.last_name,
    c.name AS company_name,
    c.slug AS company_slug,
    c.logo_url AS company_logo,
    c.city AS company_city,
    c.state_region AS company_state_region,
    c.country AS company_country,
    c.domain AS company_domain,
    c.status AS company_status,
    c.is_featured AS company_is_featured,
    c.latitude AS company_latitude,
    c.longitude AS company_longitude,
    c.audience AS company_audience,
    c.is_verified,
    c.created_at,
    c.updated_at,
    primary_cat.name AS primary_service_name,
    primary_cat.name_nl AS primary_service_name_nl,
    ( SELECT array_agg(DISTINCT cat.name ORDER BY cat.name) AS array_agg
           FROM (( SELECT unnest(c.services_offered) AS service_id
                UNION
                 SELECT (c.primary_service_id)::text AS primary_service_id
                  WHERE (c.primary_service_id IS NOT NULL)) all_services
             JOIN categories cat ON (((cat.id)::text = all_services.service_id)))
          WHERE (cat.name IS NOT NULL)) AS services_offered,
    lower(TRIM(BOTH ' '::text FROM COALESCE(c.country, ''::text))) AS searchable_country,
    lower(TRIM(BOTH ' '::text FROM COALESCE(c.state_region, ''::text))) AS searchable_state_region,
    lower(TRIM(BOTH ' '::text FROM COALESCE(c.city, ''::text))) AS searchable_city,
    COALESCE(primary_cat.name, ( SELECT cat_s.name
           FROM (unnest(c.services_offered) WITH ORDINALITY t(service_id, idx)
             JOIN categories cat_s ON (((cat_s.id)::text = t.service_id)))
          WHERE (cat_s.parent_id IS NOT NULL)
          ORDER BY t.idx
         LIMIT 1)) AS primary_specialty,
    COALESCE(primary_cat.slug, ( SELECT cat_s.slug
           FROM (unnest(c.services_offered) WITH ORDINALITY t(service_id, idx)
             JOIN categories cat_s ON (((cat_s.id)::text = t.service_id)))
          WHERE (cat_s.parent_id IS NOT NULL)
          ORDER BY t.idx
         LIMIT 1)) AS primary_specialty_slug,
    ( SELECT array_agg(DISTINCT all_ids.service_uuid) AS array_agg
           FROM ( SELECT cat_s.id AS service_uuid
                   FROM (unnest(c.services_offered) t(service_id)
                     JOIN categories cat_s ON (((cat_s.id)::text = t.service_id)))
                UNION
                 SELECT c.primary_service_id
                  WHERE (c.primary_service_id IS NOT NULL)) all_ids) AS specialty_ids,
    ( SELECT array_agg(DISTINCT sub.parent_uuid) AS array_agg
           FROM ( SELECT cat_s.parent_id AS parent_uuid
                   FROM (unnest(c.services_offered) t(service_id)
                     JOIN categories cat_s ON (((cat_s.id)::text = t.service_id)))
                  WHERE (cat_s.parent_id IS NOT NULL)
                UNION
                 SELECT cat_s.id
                   FROM (unnest(c.services_offered) t(service_id)
                     JOIN categories cat_s ON (((cat_s.id)::text = t.service_id)))
                  WHERE (cat_s.parent_id IS NULL)
                UNION
                 SELECT cat_p.parent_id
                   FROM categories cat_p
                  WHERE ((cat_p.id = c.primary_service_id) AND (cat_p.parent_id IS NOT NULL))
                UNION
                 SELECT cat_p.id
                   FROM categories cat_p
                  WHERE ((cat_p.id = c.primary_service_id) AND (cat_p.parent_id IS NULL))) sub) AS specialty_parent_ids,
    COALESCE(c.hero_photo_url, ( SELECT cp.url
           FROM company_photos cp
          WHERE ((cp.company_id = c.id) AND (cp.is_cover = true))
          ORDER BY cp.order_index
         LIMIT 1), ( SELECT cp.url
           FROM company_photos cp
          WHERE (cp.company_id = c.id)
          ORDER BY cp.order_index
         LIMIT 1), ( SELECT ph.url
           FROM (project_photos ph
             JOIN project_professionals prp2 ON ((prp2.cover_photo_id = ph.id)))
          WHERE (prp2.company_id = c.id)
          ORDER BY prp2.updated_at DESC
         LIMIT 1), ( SELECT pp.url
           FROM (project_photos pp
             JOIN project_professionals prp ON ((pp.project_id = prp.project_id)))
          WHERE (prp.company_id = c.id)
          ORDER BY pp.is_primary DESC NULLS LAST, pp.order_index
         LIMIT 1)) AS cover_photo_url
   FROM (((companies c
     LEFT JOIN company_contacts cc ON (((cc.company_id = c.id) AND (cc.role = 'owner'::company_contact_role))))
     LEFT JOIN persons pe ON ((pe.id = cc.person_id)))
     LEFT JOIN categories primary_cat ON ((primary_cat.id = c.primary_service_id)))
  WHERE ((c.status = ANY (ARRAY['listed'::company_status, 'unlisted'::company_status, 'prospected'::company_status])) AND (c.audience = 'homeowner'::text));

CREATE UNIQUE INDEX idx_mv_professional_summary_id ON public.mv_professional_summary USING btree (id);
CREATE INDEX idx_mv_professional_summary_company_status ON public.mv_professional_summary USING btree (company_status);
CREATE INDEX idx_mv_professional_summary_searchable_city ON public.mv_professional_summary USING btree (searchable_city);
