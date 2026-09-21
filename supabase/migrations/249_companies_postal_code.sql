-- The postcode, kept but not shown.
--
-- A Dutch invoice carries the buyer's postcode, and `companies` had
-- nowhere to put one: address (street and number), city and country,
-- and that was all. So every invoice went out naming a street and a
-- town with the postcode missing.
--
-- Not rendered on the company page, in the editor or on the public
-- profile — a visiting address does not need one and nobody asked to
-- see it. It is written when an address is picked from the lookup,
-- which already knows it, and read only when an invoice is made.
alter table public.companies
  add column if not exists postal_code text;

comment on column public.companies.postal_code is
  'Postcode from the Places lookup. Invoice use only; not shown on the company page.';
