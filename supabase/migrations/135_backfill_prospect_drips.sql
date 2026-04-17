-- ═══════════════════════════════════════════════════════════════════════
-- 135: Backfill prospect drips for intros sent before migration 134
-- ═══════════════════════════════════════════════════════════════════════
-- For every prospect intro (company_outreach.template = 'prospect_intro')
-- that has no corresponding email_drip_queue rows, enqueue the follow-up
-- (3 business days out) and the final (7 business days out). Staggered
-- by 10 minutes per row so we don't blast in a single cron tick.
--
-- Idempotent: the ON CONFLICT DO NOTHING hits the partial unique index
-- added in migration 120 — re-running this migration against a database
-- that already has pending rows for a given (company, template) is a
-- no-op for those rows.
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  amsterdam_tz CONSTANT text := 'Europe/Amsterdam';
  followup_base timestamptz;
  final_base timestamptz;
  row_data RECORD;
  idx int := 0;
  dow int;
  followup_send timestamptz;
  final_send timestamptz;
  variables jsonb;
  site_url CONSTANT text := 'https://www.arcolist.com';
BEGIN
  -- Next weekday +3 days at 09:00 Europe/Amsterdam, returned as UTC.
  -- `today AT TIME ZONE tz` interprets today() as Amsterdam-local, then
  -- we add days + 9 hours and convert back out with the same tz to get
  -- the corresponding UTC instant.
  followup_base := ((now() AT TIME ZONE amsterdam_tz)::date + 3 + time '09:00') AT TIME ZONE amsterdam_tz;
  dow := extract(dow from followup_base AT TIME ZONE amsterdam_tz);
  IF dow = 6 THEN followup_base := followup_base + interval '2 days'; END IF;   -- Sat → Mon
  IF dow = 0 THEN followup_base := followup_base + interval '1 day'; END IF;    -- Sun → Mon

  final_base := ((now() AT TIME ZONE amsterdam_tz)::date + 7 + time '09:00') AT TIME ZONE amsterdam_tz;
  dow := extract(dow from final_base AT TIME ZONE amsterdam_tz);
  IF dow = 6 THEN final_base := final_base + interval '2 days'; END IF;
  IF dow = 0 THEN final_base := final_base + interval '1 day'; END IF;

  -- Walk the intros that still need drip rows, in send order so the
  -- earliest-contacted prospects get the earliest follow-ups.
  FOR row_data IN
    SELECT
      co.company_id,
      co.email_to AS email,
      c.name AS company_name,
      c.slug AS company_slug,
      c.logo_url,
      c.hero_photo_url,
      c.city,
      cat.name AS primary_service_name
    FROM public.company_outreach co
    JOIN public.companies c ON c.id = co.company_id
    LEFT JOIN public.categories cat ON cat.id = c.primary_service_id
    WHERE co.template = 'prospect_intro'
      AND NOT EXISTS (
        SELECT 1 FROM public.email_drip_queue q
        WHERE q.company_id = co.company_id
          AND q.template IN ('prospect-followup', 'prospect-final')
      )
    ORDER BY co.sent_at NULLS LAST
  LOOP
    followup_send := followup_base + (idx * interval '10 minutes');
    final_send    := final_base    + (idx * interval '10 minutes');

    variables := jsonb_build_object(
      'company_name', row_data.company_name,
      'company_page_url', site_url || '/professionals/' || row_data.company_slug,
      'claim_url', site_url || '/businesses/architects?inviteEmail='
                   || replace(row_data.email, '@', '%40')
                   || '&companyId=' || row_data.company_id,
      'logo_url', row_data.logo_url,
      'hero_image_url', row_data.hero_photo_url,
      'company_subtitle',
        NULLIF(CONCAT_WS(' · ', row_data.primary_service_name, row_data.city), '')
    );

    INSERT INTO public.email_drip_queue
      (company_id, email, template, sequence, step, variables, send_at)
    VALUES
      (row_data.company_id, row_data.email, 'prospect-followup', 'prospect-outreach', 1, variables, followup_send)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.email_drip_queue
      (company_id, email, template, sequence, step, variables, send_at)
    VALUES
      (row_data.company_id, row_data.email, 'prospect-final', 'prospect-outreach', 2, variables, final_send)
    ON CONFLICT DO NOTHING;

    idx := idx + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled prospect drip rows for % intros (2 rows each)', idx;
END $$;
