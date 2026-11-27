-- Twee merkstatussen erbij (los van 354: een nieuwe enumwaarde is pas na de
-- commit te gebruiken).
--
--   catalogued  Added → Catalogued → Showcased: er staat minstens één collectie.
--   passed      afrit onder Catalogued: niet premium genoeg voor Arco. Vervangt
--               de ster van migratie 338 (is_curated = false).
alter type public.brand_status add value if not exists 'catalogued' after 'unclaimed';
alter type public.brand_status add value if not exists 'passed' after 'catalogued';
