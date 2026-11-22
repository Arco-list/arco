-- 305: eerste schatting TAM NL per dienst, uit CompanyData (KvK-handelsregister,
-- "bijgewerkt 20 oktober 2026"; SBI 2025-codes). Alleen waar de code duidelijk
-- bij de dienst past. Het zijn ingeschreven bedrijven, geen actieve bureaus:
-- een bovengrens, geen marktomvang. SAM NL is bewust leeg: dat is een
-- eigen criterium van Arco.
--   architect          71111 architectenbureaus                 8.519
--   interior-designer  74130 interieurontwerpers               11.470
--   kitchens           47554 keukenwinkels en keukenstudio's    1.295
--   lighting           47552 verlichtingswinkels                  533
--   furniture          47551 meubelwinkels                      3.196
--   flooring           4333  vloer- en wandafwerkingsbedrijven 12.076
--   painter            4334  schilders en glaszetters          16.494
--   roofing            4391  dakbouwers en dakdekkers           5.960
--   electrical-systems 4321  elektrotechnische installatie     22.452
--   photographer       7420  fotografen en fotolaboratoria     28.149
UPDATE public.categories c SET tam_nl = v.n FROM (VALUES
  ('architect', 8519), ('interior-designer', 11470), ('kitchens', 1295), ('lighting', 533), ('furniture', 3196),
  ('flooring', 12076), ('painter', 16494), ('roofing', 5960), ('electrical-systems', 22452), ('photographer', 28149)
) AS v(slug, n) WHERE c.category_type = 'Professional' AND c.slug = v.slug;
