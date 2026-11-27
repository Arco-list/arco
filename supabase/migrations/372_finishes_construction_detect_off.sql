-- Afwerking en Bouw & techniek: geen stippen (stand Uit, migratie 363),
-- ook als ze ooit weer actief worden. Geparkeerd waren ze al niet in de
-- lijst voor Claude; alle bestaande stippen zijn verborgen of afgekeurd.
update public.product_categories set detect_mode = 'off'
where parent_id is null and slug in ('finishes', 'construction');
