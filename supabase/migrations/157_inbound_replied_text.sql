-- Persist the actually-sent reply body so future AI draft generations
-- can use real Niek-edited replies as few-shot examples ("this is how
-- Niek actually responds"). ai_draft_text already caches the model's
-- last suggestion; replied_text captures the final, human-edited
-- version that went out.
--
-- Two distinct columns let us A/B compare or tune the prompt against
-- both the original draft and the post-edit final, and track edit-
-- distance over time as a quality signal.
ALTER TABLE public.inbound_emails
  ADD COLUMN IF NOT EXISTS replied_text text;
