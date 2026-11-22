-- De Arco-categorie van een product (het laatste niveau, de soort).
alter table public.products
  add column if not exists category_id uuid references public.product_categories(id) on delete set null;
create index if not exists products_category_id_idx on public.products(category_id);
comment on column public.products.category_id is 'De Arco-productcategorie van dit product, het meest specifieke niveau (soort): een loungestoel, een eettafel.';
