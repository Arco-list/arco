-- Carry the tour-seen flags over to the per-user keys.
--
-- The keys embedded the entity id — `project-edit:<project uuid>`,
-- `company-edit:<company uuid>` — which made the flag per THING rather
-- than per person. Every new project was therefore a project the reader
-- had never been shown around, and the tour ran again. 172 flags across
-- 23 users: the average person sat through the project tour more than
-- seven times. The tour teaches the editor, and the editor is the same
-- editor.
--
-- The keys are now bare, so without this backfill the new key matches
-- nothing and all fifty users would be shown their tour once more —
-- the exact thing being fixed. This hands the bare flag to anyone who
-- already has any flag of that kind.
--
-- The reset fragment survives on the company side
-- (`company-edit:<setup_reset_at>`), so an admin rollback still re-arms
-- the tour. No row carries one today, which is why nothing here has to
-- translate it.
--
-- seen_at takes the EARLIEST of a user's old flags: it records when
-- they first saw the tour, and that is the honest answer.

INSERT INTO public.ui_tour_seen (user_id, tour_key, seen_at)
SELECT user_id, 'project-edit', min(seen_at)
  FROM public.ui_tour_seen
 WHERE tour_key LIKE 'project-edit:%'
 GROUP BY user_id
ON CONFLICT DO NOTHING;

INSERT INTO public.ui_tour_seen (user_id, tour_key, seen_at)
SELECT user_id, 'company-edit', min(seen_at)
  FROM public.ui_tour_seen
 WHERE tour_key LIKE 'company-edit:%'
   AND tour_key !~ '^company-edit:[0-9a-f-]{36}:'
 GROUP BY user_id
ON CONFLICT DO NOTHING;

-- The old rows stay. They cost nothing, they are the record of which
-- project or company each tour actually ran on, and deleting them would
-- throw that away to save a few hundred bytes.
