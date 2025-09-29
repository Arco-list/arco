-- Migration: Implement Row Level Security policies
-- Description: Comprehensive RLS policies for all tables

-- =============================================================================
-- PROFILES TABLE POLICIES
-- =============================================================================

-- Users can read all active profiles (for directory browsing)
CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT USING (is_active = TRUE);

-- Users can update their own profile
CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can delete their own profile (soft delete via is_active)
CREATE POLICY "profiles_own_delete" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================================================
-- COMPANIES TABLE POLICIES
-- =============================================================================

-- Anyone can read active companies
CREATE POLICY "companies_public_read" ON public.companies
  FOR SELECT USING (TRUE);

-- Company owners can insert their own companies
CREATE POLICY "companies_owner_insert" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Company owners can update their own companies
CREATE POLICY "companies_owner_update" ON public.companies
  FOR UPDATE USING (auth.uid() = owner_id);

-- Company owners can delete their own companies
CREATE POLICY "companies_owner_delete" ON public.companies
  FOR DELETE USING (auth.uid() = owner_id);

-- =============================================================================
-- PROFESSIONALS TABLE POLICIES
-- =============================================================================

-- Anyone can read verified and available professionals
CREATE POLICY "professionals_public_read" ON public.professionals
  FOR SELECT USING (TRUE);

-- Users can create their own professional profile
CREATE POLICY "professionals_own_insert" ON public.professionals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own professional profile
CREATE POLICY "professionals_own_update" ON public.professionals
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own professional profile
CREATE POLICY "professionals_own_delete" ON public.professionals
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- PROFESSIONAL RATINGS TABLE POLICIES
-- =============================================================================

-- Anyone can read professional ratings
CREATE POLICY "professional_ratings_public_read" ON public.professional_ratings
  FOR SELECT USING (TRUE);

-- Only system can insert/update ratings (via triggers)
CREATE POLICY "professional_ratings_system_write" ON public.professional_ratings
  FOR ALL USING (FALSE);

-- =============================================================================
-- CATEGORIES TABLE POLICIES
-- =============================================================================

-- Anyone can read active categories
CREATE POLICY "categories_public_read" ON public.categories
  FOR SELECT USING (is_active = TRUE);

-- Only authenticated users can suggest categories (for admin review)
CREATE POLICY "categories_authenticated_suggest" ON public.categories
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND is_active = FALSE);

-- =============================================================================
-- PROFESSIONAL SPECIALTIES TABLE POLICIES
-- =============================================================================

-- Anyone can read professional specialties
CREATE POLICY "professional_specialties_public_read" ON public.professional_specialties
  FOR SELECT USING (TRUE);

-- Professionals can manage their own specialties
CREATE POLICY "professional_specialties_own_write" ON public.professional_specialties
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM public.professionals WHERE id = professional_id
    )
  );

-- =============================================================================
-- PROJECTS TABLE POLICIES
-- =============================================================================

-- Anyone can read published projects
CREATE POLICY "projects_public_read" ON public.projects
  FOR SELECT USING (status = 'published' OR auth.uid() = client_id);

-- Clients can create their own projects
CREATE POLICY "projects_client_insert" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = client_id);

-- Clients can update their own projects
CREATE POLICY "projects_client_update" ON public.projects
  FOR UPDATE USING (auth.uid() = client_id);

-- Clients can delete their own projects
CREATE POLICY "projects_client_delete" ON public.projects
  FOR DELETE USING (auth.uid() = client_id);

-- =============================================================================
-- PROJECT PHOTOS TABLE POLICIES
-- =============================================================================

-- Anyone can read photos for published projects
CREATE POLICY "project_photos_public_read" ON public.project_photos
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE status = 'published' OR auth.uid() = client_id
    )
  );

-- Project owners can manage their project photos
CREATE POLICY "project_photos_owner_write" ON public.project_photos
  FOR ALL USING (
    project_id IN (
      SELECT id FROM public.projects WHERE auth.uid() = client_id
    )
  );

-- =============================================================================
-- PROJECT CATEGORIES TABLE POLICIES
-- =============================================================================

-- Anyone can read project categories
CREATE POLICY "project_categories_public_read" ON public.project_categories
  FOR SELECT USING (TRUE);

-- Project owners can manage their project categories
CREATE POLICY "project_categories_owner_write" ON public.project_categories
  FOR ALL USING (
    project_id IN (
      SELECT id FROM public.projects WHERE auth.uid() = client_id
    )
  );

-- =============================================================================
-- PROJECT APPLICATIONS TABLE POLICIES
-- =============================================================================

-- Project owners and applicant professionals can read applications
CREATE POLICY "project_applications_stakeholder_read" ON public.project_applications
  FOR SELECT USING (
    -- Project owner can see all applications
    project_id IN (SELECT id FROM public.projects WHERE auth.uid() = client_id)
    OR
    -- Professional can see their own applications
    professional_id IN (SELECT id FROM public.professionals WHERE auth.uid() = user_id)
  );

-- Professionals can create applications to projects
CREATE POLICY "project_applications_professional_insert" ON public.project_applications
  FOR INSERT WITH CHECK (
    professional_id IN (SELECT id FROM public.professionals WHERE auth.uid() = user_id)
    AND
    project_id IN (SELECT id FROM public.projects WHERE status = 'published')
  );

-- Professionals can update their own applications (before acceptance)
CREATE POLICY "project_applications_professional_update" ON public.project_applications
  FOR UPDATE USING (
    professional_id IN (SELECT id FROM public.professionals WHERE auth.uid() = user_id)
    AND status = 'pending'
  );

-- Project owners can update application status
CREATE POLICY "project_applications_owner_update" ON public.project_applications
  FOR UPDATE USING (
    project_id IN (SELECT id FROM public.projects WHERE auth.uid() = client_id)
  );

-- Professionals can delete their own pending applications
CREATE POLICY "project_applications_professional_delete" ON public.project_applications
  FOR DELETE USING (
    professional_id IN (SELECT id FROM public.professionals WHERE auth.uid() = user_id)
    AND status = 'pending'
  );

-- =============================================================================
-- REVIEWS TABLE POLICIES
-- =============================================================================

-- Anyone can read published reviews
CREATE POLICY "reviews_public_read" ON public.reviews
  FOR SELECT USING (is_published = TRUE);

-- Professionals can read all reviews about them (including unpublished)
CREATE POLICY "reviews_professional_read_own" ON public.reviews
  FOR SELECT USING (
    professional_id IN (SELECT id FROM public.professionals WHERE auth.uid() = user_id)
  );

-- Reviewers can read their own reviews
CREATE POLICY "reviews_reviewer_read_own" ON public.reviews
  FOR SELECT USING (auth.uid() = reviewer_id);

-- Users can create reviews for professionals they've worked with
CREATE POLICY "reviews_client_insert" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
    AND
    -- Ensure there was an accepted application between reviewer and professional
    EXISTS (
      SELECT 1 FROM public.project_applications pa
      JOIN public.projects p ON pa.project_id = p.id
      WHERE p.client_id = auth.uid()
      AND pa.professional_id = NEW.professional_id
      AND pa.status = 'accepted'
    )
  );

-- Reviewers can update their own reviews (within time limit)
CREATE POLICY "reviews_reviewer_update" ON public.reviews
  FOR UPDATE USING (
    auth.uid() = reviewer_id
    AND created_at > NOW() - INTERVAL '30 days'
  );

-- Professionals can add responses to reviews about them
CREATE POLICY "reviews_professional_respond" ON public.reviews
  FOR UPDATE USING (
    professional_id IN (SELECT id FROM public.professionals WHERE auth.uid() = user_id)
    AND response_text IS NULL -- Only if no response exists yet
  )
  WITH CHECK (
    professional_id IN (SELECT id FROM public.professionals WHERE auth.uid() = user_id)
  );

-- =============================================================================
-- MESSAGES TABLE POLICIES
-- =============================================================================

-- Users can read messages where they are sender or recipient
CREATE POLICY "messages_participant_read" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

-- Users can send messages in projects they're involved in
CREATE POLICY "messages_stakeholder_insert" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND
    (
      -- Sender is project owner
      project_id IN (SELECT id FROM public.projects WHERE auth.uid() = client_id)
      OR
      -- Sender has applied to the project
      project_id IN (
        SELECT DISTINCT pa.project_id FROM public.project_applications pa
        JOIN public.professionals p ON pa.professional_id = p.id
        WHERE p.user_id = auth.uid()
      )
    )
    AND
    (
      -- Recipient is project owner
      recipient_id IN (SELECT client_id FROM public.projects WHERE id = project_id)
      OR
      -- Recipient has applied to the project
      recipient_id IN (
        SELECT DISTINCT p.user_id FROM public.project_applications pa
        JOIN public.professionals p ON pa.professional_id = p.id
        WHERE pa.project_id = project_id
      )
    )
  );

-- Users can update their own messages (mark as read, archive)
CREATE POLICY "messages_recipient_update" ON public.messages
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- =============================================================================
-- SAVED PROJECTS TABLE POLICIES
-- =============================================================================

-- Users can read their own saved projects
CREATE POLICY "saved_projects_own_read" ON public.saved_projects
  FOR SELECT USING (auth.uid() = user_id);

-- Users can save/unsave projects
CREATE POLICY "saved_projects_own_write" ON public.saved_projects
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- SAVED PROFESSIONALS TABLE POLICIES
-- =============================================================================

-- Users can read their own saved professionals
CREATE POLICY "saved_professionals_own_read" ON public.saved_professionals
  FOR SELECT USING (auth.uid() = user_id);

-- Users can save/unsave professionals
CREATE POLICY "saved_professionals_own_write" ON public.saved_professionals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- =============================================================================

-- Users can read their own notifications
CREATE POLICY "notifications_own_read" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_own_update" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "notifications_own_delete" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- System can insert notifications for users
CREATE POLICY "notifications_system_insert" ON public.notifications
  FOR INSERT WITH CHECK (TRUE); -- Will be restricted by application logic

-- =============================================================================
-- HELPER FUNCTIONS FOR COMPLEX POLICIES
-- =============================================================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is professional
CREATE OR REPLACE FUNCTION public.is_professional()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.professionals
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has worked with professional
CREATE OR REPLACE FUNCTION public.has_worked_with_professional(prof_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_applications pa
    JOIN public.projects p ON pa.project_id = p.id
    WHERE p.client_id = auth.uid()
    AND pa.professional_id = prof_id
    AND pa.status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant read-only access to anonymous users for public data
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.companies TO anon;
GRANT SELECT ON public.professionals TO anon;
GRANT SELECT ON public.professional_ratings TO anon;
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.professional_specialties TO anon;
GRANT SELECT ON public.projects TO anon;
GRANT SELECT ON public.project_photos TO anon;
GRANT SELECT ON public.project_categories TO anon;
GRANT SELECT ON public.reviews TO anon;

-- Add comments
COMMENT ON FUNCTION public.is_admin() IS 'Check if current user is admin';
COMMENT ON FUNCTION public.is_professional() IS 'Check if current user has professional profile';
COMMENT ON FUNCTION public.has_worked_with_professional(UUID) IS 'Check if current user has worked with specified professional';
