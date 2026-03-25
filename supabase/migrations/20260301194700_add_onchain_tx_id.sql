alter table if exists public.proposals
  add column if not exists onchain_tx_id text;
