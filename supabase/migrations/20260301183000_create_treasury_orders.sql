create table if not exists public.treasury_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  wallet_address text,
  purchase_type text not null,
  price_id text,
  quantity integer,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  status text default 'created',
  tx_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.treasury_orders enable row level security;

create policy "Treasury orders are viewable by owner" on public.treasury_orders
  for select using (auth.uid() = user_id);

create policy "Treasury orders are insertable by owner" on public.treasury_orders
  for insert with check (auth.uid() = user_id);

create policy "Treasury orders are updatable by owner" on public.treasury_orders
  for update using (auth.uid() = user_id);
