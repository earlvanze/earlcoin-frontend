-- Drop existing RLS policies BEFORE any column changes (they reference is_active).
drop policy if exists "Users can view their own delegations" on public.delegations;
drop policy if exists "Users can insert their own delegations" on public.delegations;
drop policy if exists "Users can update their own delegations" on public.delegations;
drop policy if exists "Active delegations are publicly readable" on public.delegations;

-- Drop indexes that reference old columns.
drop index if exists idx_delegations_active_user;
drop index if exists idx_delegations_delegate_wallet;

-- Rename table to match frontend convention.
alter table public.delegations rename to vote_delegations;

-- Rename columns to match frontend expectations.
alter table public.vote_delegations rename column delegator_wallet to delegator_address;
alter table public.vote_delegations rename column delegate_wallet to delegate_address;

-- Replace boolean is_active with text status ('active'/'revoked').
alter table public.vote_delegations add column status text default 'active';
update public.vote_delegations set status = case when is_active then 'active' else 'revoked' end;
alter table public.vote_delegations drop column is_active;
alter table public.vote_delegations drop column if exists revoked_at;
alter table public.vote_delegations add column revoked_at timestamptz;

-- Add tx tracking columns the frontend expects.
alter table public.vote_delegations add column if not exists tx_id text;
alter table public.vote_delegations add column if not exists revoke_tx_id text;

-- Recreate indexes.
create unique index idx_vote_delegations_active_user
  on public.vote_delegations (user_id) where status = 'active';

create index idx_vote_delegations_delegate_address
  on public.vote_delegations (delegate_address) where status = 'active';

-- Recreate RLS policies.
create policy "Users can view their own delegations"
  on public.vote_delegations for select using (auth.uid() = user_id);

create policy "Users can insert their own delegations"
  on public.vote_delegations for insert with check (auth.uid() = user_id);

create policy "Users can update their own delegations"
  on public.vote_delegations for update using (auth.uid() = user_id);

create policy "Active delegations are publicly readable"
  on public.vote_delegations for select using (status = 'active');
