-- Geen stippen meer voor Gordijnen, Jaloezieën en Werkbladen (stand Uit,
-- migratie 363): alle beoordeelde stippen waren verwijderd (8/8, 8/8, 16/16).
update public.product_categories set detect_mode = 'off'
where slug in ('curtains', 'venetian-blinds', 'countertops');
