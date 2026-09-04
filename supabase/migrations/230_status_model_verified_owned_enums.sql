-- Status remodel step 1/2: the claim funnel splits the old ambiguous
-- 'created'/'company'/'signup' into two crisp facts shared by both
-- funnels: VERIFIED (identity proven + company step confirmed, step 1)
-- and OWNED (account attached at the commit, step 2). Signup becomes
-- an event (signed_up_at), not a stage.
alter type company_status add value if not exists 'verified';
alter type company_status add value if not exists 'owned';
alter type prospect_status add value if not exists 'verified';
alter type prospect_status add value if not exists 'owned';
