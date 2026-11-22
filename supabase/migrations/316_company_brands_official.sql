-- 316: een merk op een bedrijf is voortaan altijd een officieel
-- dealerschap. De bedrijfseditor vraagt bedrijven alleen merken toe te
-- voegen waarvan ze officieel dealer zijn, en de aparte selector is weg;
-- nieuwe koppelingen krijgen is_official_dealer = true. De bestaande vier
-- (allemaal false) volgen dezelfde regel.
UPDATE public.company_brands SET is_official_dealer = true WHERE is_official_dealer = false;
