-- Enable pg_cron and pg_net extensions (Supabase provides both).
-- pg_cron: schedule recurring SQL jobs inside Postgres.
-- pg_net: make HTTP requests from SQL (used to invoke the edge function).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Schedule monitor-btc-deposits to run every 5 minutes, but only when
-- there are actually pending BTC deposit orders.  pg_net.http_post
-- invokes the Supabase Edge Function directly.
select cron.schedule(
  'monitor-btc-deposits',          -- job name
  '*/5 * * * *',                   -- every 5 minutes
  $$
  select pg_net.http_post(
    url     := 'https://aeaufjjeimtkiixdmrtq.supabase.co/functions/v1/monitor-btc-deposits',
    headers := '{"Content-Type":"application/json","x-cron-secret":"eae65db342b31d39363d5579cdecb6d71d0e5b08062a933b"}'::jsonb,
    body    := '{}'::jsonb
  )
  where exists (
    select 1 from public.treasury_orders
    where fulfillment_mode = 'btc_bridge'
      and status in ('awaiting_btc_deposit', 'btc_deposit_confirmed')
  );
  $$
);
