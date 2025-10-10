-- Create an index to speed up moderation status filtering in admin review tooling
create index if not exists reviews_moderation_status_created_at_idx
  on public.reviews (moderation_status, created_at desc);
