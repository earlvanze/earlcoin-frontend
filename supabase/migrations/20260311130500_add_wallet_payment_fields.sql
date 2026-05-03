alter table if exists public.treasury_orders
  add column if not exists payment_tx_id text,
  add column if not exists payment_asset_id bigint,
  add column if not exists payment_amount bigint;

create unique index if not exists treasury_orders_payment_tx_id_idx
  on public.treasury_orders (payment_tx_id)
  where payment_tx_id is not null;
