-- Featured tier groundwork. An earlier revision added a 1-10 AI
-- quality_score here, but absolute scores didn't discriminate (76 of 79
-- published projects scored 8). The tier is now a direct AI
-- featured/not decision written to the existing is_featured flag
-- (comparative selection in the backfill, strict boolean at import),
-- which admins can overrule — no schema change needed after all.
-- This migration intentionally left as a no-op placeholder to keep
-- numbering aligned with the applied remote history.
SELECT 1;
