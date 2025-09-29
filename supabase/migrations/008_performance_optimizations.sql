-- Migration: Performance optimizations and indexes
-- Description: Additional indexes, views, and performance enhancements

-- =============================================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- =============================================================================

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_professionals_location_verified
  ON public.professionals(is_verified, is_available)
  WHERE is_verified = TRUE AND is_available = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status_location
  ON public.projects(status, location)
  WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_budget_featured
  ON public.projects(budget_level, is_featured, created_at DESC)
  WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_professional_rating
  ON public.reviews(professional_id, overall_rating DESC, created_at DESC)
  WHERE is_published = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_unread_recipient
  ON public.messages(recipient_id, created_at DESC)
  WHERE is_read = FALSE AND is_archived = FALSE;

-- GIN indexes for array columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_style_preferences_gin
  ON public.projects USING gin(style_preferences);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_features_gin
  ON public.projects USING gin(features);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_professionals_services_gin
  ON public.professionals USING gin(services_offered);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_professionals_languages_gin
  ON public.professionals USING gin(languages_spoken);

-- =============================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =============================================================================

-- Professional summary view with aggregated data
CREATE MATERIALIZED VIEW public.mv_professional_summary AS
SELECT
  p.id,
  p.user_id,
  prof.first_name,
  prof.last_name,
  prof.avatar_url,
  prof.location as user_location,
  p.title,
  p.bio,
  p.years_experience,
  p.hourly_rate_min,
  p.hourly_rate_max,
  p.is_verified,
  p.is_available,
  p.services_offered,
  p.languages_spoken,
  p.portfolio_url,

  -- Company information
  c.name as company_name,
  c.logo_url as company_logo,

  -- Rating information
  pr.overall_rating,
  pr.quality_rating,
  pr.reliability_rating,
  pr.communication_rating,
  pr.total_reviews,
  pr.last_review_at,

  -- Specialty information (primary specialty)
  cat.name as primary_specialty,
  cat.slug as primary_specialty_slug,
  cat.icon as primary_specialty_icon,
  cat.color as primary_specialty_color,

  -- Calculated fields
  CASE
    WHEN pr.total_reviews = 0 THEN 0
    ELSE pr.overall_rating
  END as display_rating,

  CASE
    WHEN p.hourly_rate_min IS NOT NULL AND p.hourly_rate_max IS NOT NULL
    THEN p.hourly_rate_min || ' - ' || p.hourly_rate_max || ' EUR/hour'
    ELSE NULL
  END as hourly_rate_display,

  p.created_at,
  p.updated_at

FROM public.professionals p
JOIN public.profiles prof ON p.user_id = prof.id
LEFT JOIN public.companies c ON p.company_id = c.id
LEFT JOIN public.professional_ratings pr ON p.id = pr.professional_id
LEFT JOIN public.professional_specialties ps ON p.id = ps.professional_id AND ps.is_primary = TRUE
LEFT JOIN public.categories cat ON ps.category_id = cat.id

WHERE prof.is_active = TRUE;

-- Create indexes on materialized view
CREATE UNIQUE INDEX idx_mv_professional_summary_id ON public.mv_professional_summary(id);
CREATE INDEX idx_mv_professional_summary_location ON public.mv_professional_summary(user_location);
CREATE INDEX idx_mv_professional_summary_verified ON public.mv_professional_summary(is_verified) WHERE is_verified = TRUE;
CREATE INDEX idx_mv_professional_summary_available ON public.mv_professional_summary(is_available) WHERE is_available = TRUE;
CREATE INDEX idx_mv_professional_summary_rating ON public.mv_professional_summary(display_rating DESC);
CREATE INDEX idx_mv_professional_summary_specialty ON public.mv_professional_summary(primary_specialty);

-- Project summary view with aggregated data
CREATE MATERIALIZED VIEW public.mv_project_summary AS
SELECT
  p.id,
  p.title,
  p.description,
  p.location,
  p.project_type,
  p.building_type,
  p.project_size,
  p.style_preferences,
  p.features,
  p.budget_level,
  p.budget_min,
  p.budget_max,
  p.is_featured,
  p.likes_count,
  p.views_count,
  p.status,
  p.slug,
  p.project_year,
  p.building_year,

  -- Client information
  prof.first_name as client_first_name,
  prof.last_name as client_last_name,
  prof.avatar_url as client_avatar,

  -- Primary photo
  pp.url as primary_photo_url,
  pp.alt_text as primary_photo_alt,

  -- Category information (primary category)
  cat.name as primary_category,
  cat.slug as primary_category_slug,
  cat.icon as primary_category_icon,
  cat.color as primary_category_color,

  -- Application statistics
  COALESCE(app_stats.total_applications, 0) as total_applications,
  COALESCE(app_stats.pending_applications, 0) as pending_applications,

  -- Photo count
  COALESCE(photo_stats.photo_count, 0) as photo_count,

  -- Display fields
  CASE
    WHEN p.budget_min IS NOT NULL AND p.budget_max IS NOT NULL
    THEN p.budget_min || ' - ' || p.budget_max || ' EUR'
    WHEN p.budget_level IS NOT NULL
    THEN INITCAP(REPLACE(p.budget_level::text, '_', ' '))
    ELSE 'Budget not specified'
  END as budget_display,

  p.created_at,
  p.updated_at

FROM public.projects p
JOIN public.profiles prof ON p.client_id = prof.id
LEFT JOIN public.project_photos pp ON p.id = pp.project_id AND pp.is_primary = TRUE
LEFT JOIN public.project_categories pc ON p.id = pc.project_id AND pc.is_primary = TRUE
LEFT JOIN public.categories cat ON pc.category_id = cat.id
LEFT JOIN (
  SELECT
    project_id,
    COUNT(*) as total_applications,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_applications
  FROM public.project_applications
  GROUP BY project_id
) app_stats ON p.id = app_stats.project_id
LEFT JOIN (
  SELECT
    project_id,
    COUNT(*) as photo_count
  FROM public.project_photos
  GROUP BY project_id
) photo_stats ON p.id = photo_stats.project_id

WHERE p.status = 'published' AND prof.is_active = TRUE;

-- Create indexes on project summary materialized view
CREATE UNIQUE INDEX idx_mv_project_summary_id ON public.mv_project_summary(id);
CREATE INDEX idx_mv_project_summary_location ON public.mv_project_summary(location);
CREATE INDEX idx_mv_project_summary_featured ON public.mv_project_summary(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_mv_project_summary_budget ON public.mv_project_summary(budget_level);
CREATE INDEX idx_mv_project_summary_type ON public.mv_project_summary(project_type);
CREATE INDEX idx_mv_project_summary_category ON public.mv_project_summary(primary_category);
CREATE INDEX idx_mv_project_summary_created ON public.mv_project_summary(created_at DESC);
CREATE INDEX idx_mv_project_summary_likes ON public.mv_project_summary(likes_count DESC);

-- Full-text search index on project summary
CREATE INDEX idx_mv_project_summary_search ON public.mv_project_summary
  USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- =============================================================================
-- USEFUL VIEWS FOR API
-- =============================================================================

-- View for professional cards (used in listings)
CREATE VIEW public.v_professional_cards AS
SELECT
  id,
  user_id,
  first_name,
  last_name,
  avatar_url,
  user_location,
  title,
  company_name,
  company_logo,
  primary_specialty,
  primary_specialty_icon,
  display_rating,
  total_reviews,
  hourly_rate_display,
  is_verified,
  is_available
FROM public.mv_professional_summary
WHERE is_available = TRUE
ORDER BY is_verified DESC, display_rating DESC, total_reviews DESC;

-- View for project cards (used in listings)
CREATE VIEW public.v_project_cards AS
SELECT
  id,
  title,
  location,
  project_type,
  primary_photo_url,
  primary_photo_alt,
  primary_category,
  primary_category_icon,
  budget_display,
  likes_count,
  is_featured,
  slug,
  created_at
FROM public.mv_project_summary
ORDER BY is_featured DESC, created_at DESC;

-- =============================================================================
-- FUNCTIONS FOR SEARCH AND FILTERING
-- =============================================================================

-- Function for professional search with filters
CREATE OR REPLACE FUNCTION public.search_professionals(
  search_query TEXT DEFAULT NULL,
  location_filter TEXT DEFAULT NULL,
  specialty_filter UUID DEFAULT NULL,
  min_rating DECIMAL DEFAULT NULL,
  max_hourly_rate DECIMAL DEFAULT NULL,
  verified_only BOOLEAN DEFAULT FALSE,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  user_location TEXT,
  title TEXT,
  company_name TEXT,
  primary_specialty TEXT,
  display_rating DECIMAL,
  total_reviews INTEGER,
  hourly_rate_display TEXT,
  is_verified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.user_location,
    p.title,
    p.company_name,
    p.primary_specialty,
    p.display_rating,
    p.total_reviews,
    p.hourly_rate_display,
    p.is_verified
  FROM public.mv_professional_summary p
  WHERE
    p.is_available = TRUE
    AND (NOT verified_only OR p.is_verified = TRUE)
    AND (location_filter IS NULL OR p.user_location ILIKE '%' || location_filter || '%')
    AND (min_rating IS NULL OR p.display_rating >= min_rating)
    AND (max_hourly_rate IS NULL OR p.hourly_rate_max <= max_hourly_rate)
    AND (specialty_filter IS NULL OR p.id IN (
      SELECT ps.professional_id
      FROM public.professional_specialties ps
      WHERE ps.category_id = specialty_filter
    ))
    AND (search_query IS NULL OR (
      p.title ILIKE '%' || search_query || '%'
      OR p.first_name ILIKE '%' || search_query || '%'
      OR p.last_name ILIKE '%' || search_query || '%'
      OR p.primary_specialty ILIKE '%' || search_query || '%'
      OR p.company_name ILIKE '%' || search_query || '%'
    ))
  ORDER BY
    p.is_verified DESC,
    p.display_rating DESC,
    p.total_reviews DESC,
    p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function for project search with filters
CREATE OR REPLACE FUNCTION public.search_projects(
  search_query TEXT DEFAULT NULL,
  location_filter TEXT DEFAULT NULL,
  category_filter UUID DEFAULT NULL,
  budget_filter project_budget_level DEFAULT NULL,
  project_type_filter TEXT DEFAULT NULL,
  style_filters TEXT[] DEFAULT NULL,
  feature_filters TEXT[] DEFAULT NULL,
  featured_only BOOLEAN DEFAULT FALSE,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  location TEXT,
  project_type TEXT,
  primary_photo_url TEXT,
  primary_category TEXT,
  budget_display TEXT,
  likes_count INTEGER,
  is_featured BOOLEAN,
  slug TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.location,
    p.project_type,
    p.primary_photo_url,
    p.primary_category,
    p.budget_display,
    p.likes_count,
    p.is_featured,
    p.slug,
    p.created_at
  FROM public.mv_project_summary p
  WHERE
    (NOT featured_only OR p.is_featured = TRUE)
    AND (location_filter IS NULL OR p.location ILIKE '%' || location_filter || '%')
    AND (budget_filter IS NULL OR p.budget_level = budget_filter)
    AND (project_type_filter IS NULL OR p.project_type ILIKE '%' || project_type_filter || '%')
    AND (category_filter IS NULL OR p.id IN (
      SELECT pc.project_id
      FROM public.project_categories pc
      WHERE pc.category_id = category_filter
    ))
    AND (style_filters IS NULL OR p.style_preferences && style_filters)
    AND (feature_filters IS NULL OR p.features && feature_filters)
    AND (search_query IS NULL OR (
      p.title ILIKE '%' || search_query || '%'
      OR p.description ILIKE '%' || search_query || '%'
      OR p.location ILIKE '%' || search_query || '%'
    ))
  ORDER BY
    p.is_featured DESC,
    p.likes_count DESC,
    p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- =============================================================================

-- Function to refresh professional summary view
CREATE OR REPLACE FUNCTION public.refresh_professional_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_professional_summary;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh project summary view
CREATE OR REPLACE FUNCTION public.refresh_project_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_project_summary;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  PERFORM public.refresh_professional_summary();
  PERFORM public.refresh_project_summary();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS TO AUTO-REFRESH MATERIALIZED VIEWS
-- =============================================================================

-- Function to trigger materialized view refresh
CREATE OR REPLACE FUNCTION public.trigger_mv_refresh()
RETURNS trigger AS $$
BEGIN
  -- Use pg_notify to signal that views need refreshing
  -- This can be picked up by a background job
  PERFORM pg_notify('refresh_materialized_views', '');
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for key tables that affect materialized views
CREATE TRIGGER refresh_mv_on_professional_change
  AFTER INSERT OR UPDATE OR DELETE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.trigger_mv_refresh();

CREATE TRIGGER refresh_mv_on_profile_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_mv_refresh();

CREATE TRIGGER refresh_mv_on_project_change
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trigger_mv_refresh();

CREATE TRIGGER refresh_mv_on_rating_change
  AFTER INSERT OR UPDATE OR DELETE ON public.professional_ratings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_mv_refresh();

-- =============================================================================
-- ANALYTICS FUNCTIONS
-- =============================================================================

-- Function to get platform statistics
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE (
  total_professionals INTEGER,
  verified_professionals INTEGER,
  total_projects INTEGER,
  published_projects INTEGER,
  total_reviews INTEGER,
  average_rating DECIMAL,
  total_users INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM public.professionals) as total_professionals,
    (SELECT COUNT(*)::INTEGER FROM public.professionals WHERE is_verified = TRUE) as verified_professionals,
    (SELECT COUNT(*)::INTEGER FROM public.projects) as total_projects,
    (SELECT COUNT(*)::INTEGER FROM public.projects WHERE status = 'published') as published_projects,
    (SELECT COUNT(*)::INTEGER FROM public.reviews WHERE is_published = TRUE) as total_reviews,
    (SELECT ROUND(AVG(overall_rating), 2) FROM public.reviews WHERE is_published = TRUE) as average_rating,
    (SELECT COUNT(*)::INTEGER FROM public.profiles WHERE is_active = TRUE) as total_users;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comments
COMMENT ON MATERIALIZED VIEW public.mv_professional_summary IS 'Optimized professional data for listings and search';
COMMENT ON MATERIALIZED VIEW public.mv_project_summary IS 'Optimized project data for listings and search';
COMMENT ON VIEW public.v_professional_cards IS 'Professional card data for UI components';
COMMENT ON VIEW public.v_project_cards IS 'Project card data for UI components';

COMMENT ON FUNCTION public.search_professionals IS 'Search professionals with filters and pagination';
COMMENT ON FUNCTION public.search_projects IS 'Search projects with filters and pagination';
COMMENT ON FUNCTION public.refresh_all_materialized_views IS 'Refresh all materialized views for updated data';
COMMENT ON FUNCTION public.get_platform_stats IS 'Get platform-wide statistics';
