Follow-up Tasks
===============

- [ ] Refactor project save flow into a single transactional Supabase RPC that updates the project row and synchronises `project_categories` and `project_taxonomy_selections` in one call.
- [ ] Within that RPC, enforce ownership by asserting `auth.uid()` matches the project’s `client_id` before performing any writes so cross-tenant updates remain impossible even if RLS policies change.
