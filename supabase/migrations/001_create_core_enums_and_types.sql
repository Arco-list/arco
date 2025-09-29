-- Migration: Create core enums and types
-- Description: Foundation enums and types for the Arco platform

-- Create core enums for the Arco platform
CREATE TYPE user_type AS ENUM ('client', 'professional', 'admin');
CREATE TYPE project_status AS ENUM ('draft', 'published', 'in_progress', 'completed', 'archived');
CREATE TYPE application_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE project_budget_level AS ENUM ('budget', 'mid_range', 'premium', 'luxury');

-- Add comments for documentation
COMMENT ON TYPE user_type IS 'Types of users in the platform';
COMMENT ON TYPE project_status IS 'Status of projects in their lifecycle';
COMMENT ON TYPE application_status IS 'Status of professional applications to projects';
COMMENT ON TYPE project_budget_level IS 'Budget categories for projects';
