alter table if exists public.proposals
  add column if not exists file_path text,
  add column if not exists file_hash text,
  add column if not exists onchain_proposal_id bigint,
  add column if not exists onchain_tx_id text,
  add column if not exists vote_start_ts bigint,
  add column if not exists vote_end_ts bigint,
  add column if not exists snapshot_hash text;
