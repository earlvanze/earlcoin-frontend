alter table if exists public.profiles
  add column if not exists vnft_asset_id bigint,
  add column if not exists vnft_wallet text;

create index if not exists profiles_vnft_wallet_idx on public.profiles (vnft_wallet);
