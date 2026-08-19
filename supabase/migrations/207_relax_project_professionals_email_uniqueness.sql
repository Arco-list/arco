-- The (project_id, invited_email) uniqueness exists to dedupe INVITES.
-- Email-less credit rows (imported owner credits and photographer
-- credits both use invited_email = '') collided with each other,
-- blocking photographer credits on every imported project. Scope the
-- uniqueness to real emails only.
ALTER TABLE project_professionals DROP CONSTRAINT project_professionals_unique_per_project;
CREATE UNIQUE INDEX project_professionals_unique_per_project
  ON project_professionals (project_id, invited_email)
  WHERE invited_email <> '';
