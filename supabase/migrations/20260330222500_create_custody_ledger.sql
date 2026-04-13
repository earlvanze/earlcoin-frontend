create table if not exists public.custody_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'active',
  default_algorand_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custody_balances (
  id uuid primary key default gen_random_uuid(),
  custody_account_id uuid not null references public.custody_accounts(id) on delete cascade,
  asset_id bigint not null,
  available_base_units bigint not null default 0,
  locked_base_units bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (custody_account_id, asset_id)
);

create table if not exists public.custody_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  custody_account_id uuid not null references public.custody_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id bigint not null,
  amount_base_units bigint not null,
  entry_type text not null,
  reference_type text,
  reference_id uuid,
  tx_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  custody_account_id uuid not null references public.custody_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id bigint not null,
  amount_base_units bigint not null,
  destination_wallet text,
  status text not null default 'requested',
  tx_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.treasury_orders
  add column if not exists fulfillment_mode text,
  add column if not exists custody_account_id uuid references public.custody_accounts(id),
  add column if not exists reserve_wallet_role text,
  add column if not exists reserve_wallet_address text,
  add column if not exists reserve_tx_id text;

create index if not exists custody_balances_asset_idx on public.custody_balances(asset_id);
create index if not exists custody_ledger_entries_user_idx on public.custody_ledger_entries(user_id, created_at desc);
create index if not exists withdrawal_requests_user_idx on public.withdrawal_requests(user_id, created_at desc);
create index if not exists treasury_orders_custody_account_idx on public.treasury_orders(custody_account_id);

alter table public.custody_accounts enable row level security;
alter table public.custody_balances enable row level security;
alter table public.custody_ledger_entries enable row level security;
alter table public.withdrawal_requests enable row level security;

create policy "Custody accounts are viewable by owner" on public.custody_accounts
  for select using (auth.uid() = user_id);

create policy "Custody balances are viewable by owner" on public.custody_balances
  for select using (
    exists (
      select 1 from public.custody_accounts ca
      where ca.id = custody_balances.custody_account_id
        and ca.user_id = auth.uid()
    )
  );

create policy "Custody ledger entries are viewable by owner" on public.custody_ledger_entries
  for select using (auth.uid() = user_id);

create policy "Withdrawal requests are viewable by owner" on public.withdrawal_requests
  for select using (auth.uid() = user_id);

create policy "Withdrawal requests are insertable by owner" on public.withdrawal_requests
  for insert with check (auth.uid() = user_id);
