-- companies.listed_at should mean one thing: when a CLAIMED company
-- first went Listed.
--
-- It currently means two, and the second one is a fossil. Until
-- 1 September (a4ac912) an ownerless company whose credit went live on
-- a published project was promoted straight to status 'listed', and the
-- trigger stamped listed_at. Those are SHOWCASE pages — pages Arco
-- publishes for a company that has not claimed anything — and they
-- never reached Listed in the funnel at all.
--
-- Both code paths now refuse that promotion: sync-listed-status.ts
-- sends an ownerless company to 'prospected', and the DB mirror
-- sync_company_listed_status() returns early when owner_id IS NULL. No
-- ownerless company has been stamped since 31 August. So this is
-- historical residue, not a live bug — but residue that actively does
-- harm, for the reason below.
--
-- THE STAMP IS WHAT BLOCKS THE REAL DATE. set_company_onboarded_at()
-- stamps only when the field is still NULL:
--
--   IF (OLD.status <> 'listed' AND NEW.status = 'listed'
--       AND NEW.listed_at IS NULL) THEN NEW.listed_at := now();
--
-- so a showcase page carrying an August stamp keeps it when someone
-- claims it in October. AL architecten went live as a showcase on
-- 20 August and was claimed on 1 October; its listed_at still said
-- August, dating the acquisition to the day Arco published the page
-- rather than the day the company took it over. Nine of thirty-one
-- claimed companies read that way round, and the admin companies table
-- and the growth dashboard disagreed about how many pros were won on
-- 1 October — one against three — because one read the raw field and
-- the other worked around it.

-- 1. Clear the fossils. 44 rows, every one ownerless. Clearing rather
--    than correcting is deliberate: these companies have not reached
--    this milestone, so the honest value is "not yet". And because the
--    trigger only stamps into a NULL, this is also what lets a future
--    claim record the right date by itself.
UPDATE public.companies
   SET listed_at = NULL
 WHERE owner_id IS NULL
   AND listed_at IS NOT NULL;

-- 2. Correct the nine already-claimed companies. The trigger cannot fix
--    these: they are already 'listed', so no transition will fire again.
--
--    The replacement is the company's first team-member row, because
--    that IS what claiming does — it attaches a person. onboarded_at
--    would read better here and is set on only 10 of the 31 claimed
--    companies, so it cannot carry this.
--
--    GREATEST is implicit in the WHERE: only rows whose claim came
--    AFTER the listing are touched. A company that claimed first and
--    listed later already holds the right date.
UPDATE public.companies c
   SET listed_at = m.first_member
  FROM (
    SELECT company_id, min(created_at) AS first_member
      FROM public.professionals
     WHERE company_id IS NOT NULL
     GROUP BY company_id
  ) m
 WHERE c.id = m.company_id
   AND c.owner_id IS NOT NULL
   AND c.listed_at IS NOT NULL
   AND m.first_member > c.listed_at;
