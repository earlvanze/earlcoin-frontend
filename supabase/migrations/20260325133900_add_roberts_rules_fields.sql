-- Add Robert's Rules seconding fields to proposals
alter table if exists public.proposals
  add column if not exists seconded_by uuid references auth.users(id),
  add column if not exists seconded_at timestamptz,
  add column if not exists property_id text,
  add column if not exists deal_type text;

-- Status values: draft, seconded, voting, passed, failed
-- 'active' kept for backwards compatibility (treated as 'voting')

comment on column public.proposals.seconded_by is 'User who seconded this proposal (Robert''s Rules)';
comment on column public.proposals.seconded_at is 'Timestamp when proposal was seconded';
comment on column public.proposals.property_id is 'Lofty property ID if this proposal is about a property acquisition';
comment on column public.proposals.deal_type is 'Type of deal: equity, cashflow, treasury, governance';
