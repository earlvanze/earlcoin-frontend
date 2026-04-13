-- Add Strike Lightning invoice tracking columns to treasury_orders.
alter table public.treasury_orders
  add column if not exists strike_invoice_id text,
  add column if not exists strike_correlation_id text;

-- Index for fast webhook lookups by Strike invoice ID.
create index if not exists idx_treasury_orders_strike_invoice
  on public.treasury_orders (strike_invoice_id)
  where strike_invoice_id is not null;
