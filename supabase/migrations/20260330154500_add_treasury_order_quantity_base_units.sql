alter table if exists public.treasury_orders
  add column if not exists quantity_base_units bigint;

update public.treasury_orders
set quantity_base_units = quantity::bigint * 1000000
where quantity_base_units is null
  and quantity is not null;
