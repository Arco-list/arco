-- 320: status voor productcategorieën, zoals bij diensten (is_active).
-- Een inactieve categorie (en alles eronder) verdwijnt uit het menu en de
-- filters op /products en /brands; merken en collecties houden hun koppeling
-- en de admin toont haar gewoon. Standaard actief.

alter table product_categories add column if not exists is_active boolean not null default true;
