-- Segment van een merk, om te bepalen met welke merken Arco werkt:
--   luxury      de absolute top (Minotti, B&B Italia, Gaggenau, Boffi)
--   premium     hoogwaardig design, breder verkrijgbaar (Hay, Muuto, Flos)
--   mid         het segment daaronder (Kave Home, Calligaris)
-- Leeg = nog niet beoordeeld. Met de hand gezet in /admin/brands.
alter table brands
  add column if not exists market_segment text
  check (market_segment in ('luxury', 'premium', 'mid'));

create index if not exists brands_market_segment_idx on brands (market_segment);
