-- Seed baseline taxonomy options for project filters.
-- Populates styles, building types, size ranges, budget tiers, location and material features.

WITH input AS (
  SELECT
    name,
    slug,
    taxonomy_type,
    sort_order,
    icon,
    budget_level,
    size_min_sqm,
    size_max_sqm
  FROM (
    VALUES
      ('Modern', 'modern', 'project_style', 1, NULL, NULL, NULL, NULL),
      ('Contemporary', 'contemporary', 'project_style', 2, NULL, NULL, NULL, NULL),
      ('Traditional', 'traditional', 'project_style', 3, NULL, NULL, NULL, NULL),
      ('Minimalist', 'minimalist', 'project_style', 4, NULL, NULL, NULL, NULL),
      ('Industrial', 'industrial', 'project_style', 5, NULL, NULL, NULL, NULL),
      ('Scandinavian', 'scandinavian', 'project_style', 6, NULL, NULL, NULL, NULL),
      ('Mediterranean', 'mediterranean', 'project_style', 7, NULL, NULL, NULL, NULL),
      ('Rustic', 'rustic', 'project_style', 8, NULL, NULL, NULL, NULL),
      ('Mid-Century Modern', 'mid-century-modern', 'project_style', 9, NULL, NULL, NULL, NULL),
      ('Bohemian', 'bohemian', 'project_style', 10, NULL, NULL, NULL, NULL),
      ('Coastal', 'coastal', 'project_style', 11, NULL, NULL, NULL, NULL),
      ('Farmhouse', 'farmhouse', 'project_style', 12, NULL, NULL, NULL, NULL),
      ('Transitional', 'transitional', 'project_style', 13, NULL, NULL, NULL, NULL),
      ('Urban Modern', 'urban-modern', 'project_style', 14, NULL, NULL, NULL, NULL),
      ('Eclectic', 'eclectic', 'project_style', 15, NULL, NULL, NULL, NULL),
      ('New build', 'new-build', 'building_type', 1, 'building', NULL, NULL, NULL),
      ('Renovated', 'renovated', 'building_type', 2, 'hammer', NULL, NULL, NULL),
      ('Interior designed', 'interior-designed', 'building_type', 3, 'sofa', NULL, NULL, NULL),
      ('< 100 m2', 'under-100', 'size_range', 1, 'ruler', NULL, NULL, 100),
      ('100-200 m2', '100-200', 'size_range', 2, 'ruler', NULL, 100, 200),
      ('200-500 m2', '200-500', 'size_range', 3, 'ruler', NULL, 200, 500),
      ('> 500 m2', 'over-500', 'size_range', 4, 'ruler', NULL, 500, NULL),
      ('Budget', 'budget', 'budget_tier', 1, 'wallet', 'budget', NULL, NULL),
      ('Mid-range', 'mid-range', 'budget_tier', 2, 'wallet', 'mid_range', NULL, NULL),
      ('Premium', 'premium', 'budget_tier', 3, 'wallet', 'premium', NULL, NULL),
      ('Luxury', 'luxury', 'budget_tier', 4, 'gem', 'luxury', NULL, NULL),
      ('Urban center', 'urban-center', 'location_feature', 1, 'building', NULL, NULL, NULL),
      ('Suburban', 'suburban', 'location_feature', 2, 'home', NULL, NULL, NULL),
      ('Countryside', 'countryside', 'location_feature', 3, 'trees', NULL, NULL, NULL),
      ('Coastal', 'coastal-location', 'location_feature', 4, 'waves', NULL, NULL, NULL),
      ('Beach', 'beach', 'location_feature', 5, 'sun', NULL, NULL, NULL),
      ('Waterfront', 'waterfront', 'location_feature', 6, 'anchor', NULL, NULL, NULL),
      ('Lakefront', 'lakefront', 'location_feature', 7, 'waves', NULL, NULL, NULL),
      ('Mountain', 'mountain', 'location_feature', 8, 'mountain', NULL, NULL, NULL),
      ('Amazing views', 'amazing-views', 'location_feature', 9, 'eye', NULL, NULL, NULL),
      ('City view', 'city-view', 'location_feature', 10, 'building-2', NULL, NULL, NULL),
      ('Golfing', 'golfing', 'location_feature', 11, 'golf', NULL, NULL, NULL),
      ('Ski resort', 'ski-resort', 'location_feature', 12, 'snowflake', NULL, NULL, NULL),
      ('Forest', 'forest', 'location_feature', 13, 'tree-pine', NULL, NULL, NULL),
      ('Historic district', 'historic-district', 'location_feature', 14, 'landmark', NULL, NULL, NULL),
      ('Business district', 'business-district', 'location_feature', 15, 'building', NULL, NULL, NULL),
      ('Metal constructions', 'metal-constructions', 'material_feature', 1, 'zap', NULL, NULL, NULL),
      ('Stucco walls', 'stucco-walls', 'material_feature', 2, 'brick', NULL, NULL, NULL),
      ('Glass facades', 'glass-facades', 'material_feature', 3, 'square', NULL, NULL, NULL),
      ('Slate roof', 'slate-roof', 'material_feature', 4, 'cloud-rain', NULL, NULL, NULL),
      ('Bamboo', 'bamboo', 'material_feature', 5, 'leaf', NULL, NULL, NULL),
      ('Natural Stone', 'natural-stone', 'material_feature', 6, 'rocking-chair', NULL, NULL, NULL),
      ('Exposed brick', 'exposed-brick', 'material_feature', 7, 'brick', NULL, NULL, NULL),
      ('Reclaimed wood', 'reclaimed-wood', 'material_feature', 8, 'layers', NULL, NULL, NULL),
      ('Thatched roof', 'thatched-roof', 'material_feature', 9, 'home', NULL, NULL, NULL),
      ('Exposed concrete', 'exposed-concrete', 'material_feature', 10, 'square', NULL, NULL, NULL),
      ('Solar panels', 'solar-panels', 'material_feature', 11, 'sun', NULL, NULL, NULL),
      ('Green roof', 'green-roof', 'material_feature', 12, 'sprout', NULL, NULL, NULL),
      ('Smart home technology', 'smart-home-technology', 'material_feature', 13, 'cpu', NULL, NULL, NULL),
      ('Underfloor heating', 'underfloor-heating', 'material_feature', 14, 'waves', NULL, NULL, NULL),
      ('Heat pump', 'heat-pump', 'material_feature', 15, 'thermometer', NULL, NULL, NULL),
      ('Insulation', 'insulation', 'material_feature', 16, 'layers', NULL, NULL, NULL),
      ('Double glazing', 'double-glazing', 'material_feature', 17, 'panel-top', NULL, NULL, NULL),
      ('Ventilation system', 'ventilation-system', 'material_feature', 18, 'wind', NULL, NULL, NULL)
  ) AS v(name, slug, taxonomy_type, sort_order, icon, budget_level, size_min_sqm, size_max_sqm)
),
updated AS (
  UPDATE public.project_taxonomy_options p
  SET
    name = i.name,
    taxonomy_type = i.taxonomy_type::public.project_taxonomy_type,
    sort_order = i.sort_order,
    icon = i.icon,
    budget_level = i.budget_level::public.project_budget_level,
    size_min_sqm = i.size_min_sqm,
    size_max_sqm = i.size_max_sqm,
    is_active = TRUE,
    updated_at = now()
  FROM input i
  WHERE p.slug = i.slug
  RETURNING p.slug
)
INSERT INTO public.project_taxonomy_options (
  name,
  slug,
  taxonomy_type,
  sort_order,
  icon,
  budget_level,
  size_min_sqm,
  size_max_sqm
)
SELECT
  i.name,
  i.slug,
  i.taxonomy_type::public.project_taxonomy_type,
  i.sort_order,
  i.icon,
  i.budget_level::public.project_budget_level,
  i.size_min_sqm,
  i.size_max_sqm
FROM input i
WHERE NOT EXISTS (SELECT 1 FROM updated u WHERE u.slug = i.slug)
  AND NOT EXISTS (SELECT 1 FROM public.project_taxonomy_options p WHERE p.slug = i.slug);
