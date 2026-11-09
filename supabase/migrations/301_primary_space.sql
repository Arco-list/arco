-- 301: primaire ruimte van een deelproject.
--
-- Een deelproject (projects.kind = 'partial') heeft geen scope en geen
-- verplicht gebouwtype; de ruimte beantwoordt de vraag "wat is dit":
-- Tuin, Keuken, Zwembad. Expliciet opgeslagen, niet afgeleid uit
-- fotoaantallen die veranderen. Het scopevak in de editor schrijft óf
-- project_type (scope, kind = 'project') óf primary_space_id (kind =
-- 'partial'). Welke opties het vak biedt volgt uit de publiceerstanden
-- van de diensten van het bedrijf dat eigenaar is (297).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS primary_space_id uuid REFERENCES public.spaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_primary_space ON public.projects(primary_space_id) WHERE primary_space_id IS NOT NULL;

-- De zoekdocumenten dragen de primaire ruimte mee (kaart, detailpagina).
CREATE OR REPLACE VIEW public.project_search_documents AS
 SELECT doc.id,
    doc.title,
    doc.description,
    doc.translations,
    doc.location,
    doc.project_type,
    doc.building_type,
    doc.style_preferences,
    doc.features,
    doc.is_featured,
    doc.likes_count,
    doc.views_count,
    doc.status,
    doc.slug,
    doc.project_year,
    doc.client_first_name,
    doc.client_last_name,
    doc.client_avatar,
    doc.primary_photo_url,
    doc.primary_photo_alt,
    doc.primary_category,
    doc.primary_category_slug,
    doc.primary_category_icon,
    doc.primary_category_color,
    doc.photo_count,
    doc.created_at,
    doc.updated_at,
    doc.search_vector,
    doc.credited_count,
    row_number() OVER (
      PARTITION BY doc.is_featured, (COALESCE(doc.project_type, 'other'::text))
      ORDER BY doc.credited_count DESC, (COALESCE(doc.views_count, 0)) DESC, doc.created_at DESC
    )::integer AS scope_rotation,
    pr.address_city,
    pr.address_region,
    pr.kind,
    pr.parent_project_id,
    pr.primary_space_id,
    sp.slug AS primary_space_slug
   FROM ( SELECT p.*,
            ( SELECT count(*)::integer
                FROM project_professionals pp
               WHERE pp.project_id = p.id
                 AND (pp.status = ANY (ARRAY['live_on_page'::professional_project_status,
                                             'listed'::professional_project_status]))) AS credited_count
           FROM ( SELECT mv.*,
                    to_tsvector('simple'::regconfig,
                      TRIM(BOTH ' ' FROM concat_ws(' ',
                        mv.title,
                        mv.slug,
                        mv.description,
                        mv.location,
                        mv.primary_category,
                        mv.primary_category_slug,
                        mv.project_type,
                        mv.building_type,
                        array_to_string(COALESCE(mv.style_preferences, ARRAY[]::text[]), ' '),
                        array_to_string(COALESCE(mv.features, ARRAY[]::text[]), ' ')
                      ))) AS search_vector
                   FROM mv_project_summary mv) p) doc
     LEFT JOIN projects pr ON pr.id = doc.id
     LEFT JOIN spaces sp ON sp.id = pr.primary_space_id;

-- Omzetting van bestaande projecten van bedrijven die alleen
-- deelprojecten mogen publiceren: één project vandaag, de boerderijtuin
-- van een tuinontwerper. Ruimte = de ruimte met de meeste foto's; type
-- blijft staan als context.
WITH owner_scope AS (
  SELECT pp.project_id,
    bool_or(s.publish_scope = 'project') AS has_project,
    bool_or(s.publish_scope = 'partial') AS has_partial
  FROM project_professionals pp
  JOIN companies c ON c.id = pp.company_id
  LEFT JOIN categories s ON s.category_type = 'Professional'
    AND (s.id = c.primary_service_id OR s.id = ANY (COALESCE(c.services_offered, '{}')::uuid[]))
  WHERE pp.is_project_owner
  GROUP BY pp.project_id
),
best_space AS (
  SELECT f.project_id, f.space_id, count(ph.id) AS photos,
    row_number() OVER (PARTITION BY f.project_id ORDER BY count(ph.id) DESC) AS rn
  FROM project_features f
  JOIN spaces sp ON sp.id = f.space_id AND sp.slug NOT IN ('exterior', 'other')
  LEFT JOIN project_photos ph ON ph.feature_id = f.id
  GROUP BY f.project_id, f.space_id
)
UPDATE projects p
SET kind = 'partial', project_type = NULL, primary_space_id = b.space_id
FROM owner_scope o
JOIN best_space b ON b.project_id = o.project_id AND b.rn = 1
WHERE p.id = o.project_id AND o.has_partial AND NOT COALESCE(o.has_project, false) AND p.kind = 'project';
