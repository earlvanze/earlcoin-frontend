-- Harden Lofty tables to public read only.
-- Remove open-write posture caused by broad grants plus ALL policies.

revoke all on table public.lofty_analysis_log from anon, authenticated;
revoke all on table public.lofty_cashflow_picks from anon, authenticated;
revoke all on table public.lofty_deal_reports from anon, authenticated;
revoke all on table public.lofty_equity_picks from anon, authenticated;

grant select on table public.lofty_analysis_log to anon, authenticated;
grant select on table public.lofty_cashflow_picks to anon, authenticated;
grant select on table public.lofty_deal_reports to anon, authenticated;
grant select on table public.lofty_equity_picks to anon, authenticated;

drop policy if exists "Service write" on public.lofty_analysis_log;
drop policy if exists "Service write" on public.lofty_cashflow_picks;
drop policy if exists "Service write" on public.lofty_deal_reports;
drop policy if exists "Service write" on public.lofty_equity_picks;
