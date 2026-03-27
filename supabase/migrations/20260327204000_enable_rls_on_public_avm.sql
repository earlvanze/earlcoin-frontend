-- Harden legacy/internal AVM table exposed via PostgREST
-- Safe default: enable RLS with no client-facing policies
-- Result: anon/authenticated cannot read or write unless policies are added later.

alter table if exists public.avm enable row level security;
