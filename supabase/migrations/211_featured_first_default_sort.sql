-- Featured tier: default sort work. An earlier revision made
-- 'most_relevant' featured-first inside search_professionals; that was
-- superseded the same day by making "Featured" the FIRST and DEFAULT
-- sort option in the app (lib/projects/sort.ts, lib/professionals/sort.ts),
-- so the RPC was restored to its 175_remove_plan_tier semantics:
-- is_featured leads only when sort_by = 'featured', 'most_relevant' is
-- the pure credits signal. Net schema change: none — no-op placeholder
-- to keep numbering aligned with the applied remote history.
SELECT 1;
