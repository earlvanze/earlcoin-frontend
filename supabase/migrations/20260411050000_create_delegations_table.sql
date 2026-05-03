-- Vote delegation: a user delegates their voting power to another Algorand wallet.
-- Only one active delegation per user at a time.
create table if not exists public.delegations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delegator_wallet text not null,
  delegate_wallet text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

-- Only one active delegation per user.
create unique index if not exists idx_delegations_active_user
  on public.delegations (user_id) where is_active = true;

-- Fast lookup of who delegated to a given wallet.
create index if not exists idx_delegations_delegate_wallet
  on public.delegations (delegate_wallet) where is_active = true;

alter table public.delegations enable row level security;

create policy "Users can view their own delegations"
  on public.delegations for select using (auth.uid() = user_id);

create policy "Users can insert their own delegations"
  on public.delegations for insert with check (auth.uid() = user_id);

create policy "Users can update their own delegations"
  on public.delegations for update using (auth.uid() = user_id);

-- Allow anyone to read active delegations (needed for vote tallying).
create policy "Active delegations are publicly readable"
  on public.delegations for select using (is_active = true);
