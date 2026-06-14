-- ============================================================
-- STATIONS — Daily habit push nudges
-- Run once in the Supabase SQL editor, AFTER push_notifications.sql (this uses
-- private.notify_push + private.push_config) and todos.sql (the recipient logic
-- in the webhook reads todos / daily_plan_completions).
--
-- Two pg_cron jobs fire the webhook once a day each; the /api/push/event route
-- resolves recipients and sends. Both are background jobs, off any user write.
-- Times are UTC (IST = UTC+5:30) — per-user timezones are a V2 item:
--   • 02:30 UTC ≈ 08:00 IST — "what are your 3 things today?" (start the ritual)
--   • 15:30 UTC ≈ 21:00 IST — "your streak is on the line" (loss-aversion)
-- ============================================================

create extension if not exists pg_cron with schema extensions;

-- ------------------------------------------------------------
-- send_daily_nudge(variant) — fire one webhook call for the given nudge kind.
-- The route + resolver pick the recipients ('plan' = no plan set today;
-- 'streak' = on a streak but today not done), so this stays a thin trigger.
-- ------------------------------------------------------------
create or replace function private.send_daily_nudge(p_variant text)
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $$
begin
  perform private.notify_push(jsonb_build_object(
    'type', 'daily_nudge',
    'variant', p_variant
  ));
end $$;

-- ------------------------------------------------------------
-- Schedule both. Re-running this file is safe: unschedule first.
-- ------------------------------------------------------------
do $$ begin perform cron.unschedule('stations-daily-plan-prompt'); exception when others then null; end $$;
select cron.schedule(
  'stations-daily-plan-prompt',
  '30 2 * * *',
  $$ select private.send_daily_nudge('plan'); $$
);

do $$ begin perform cron.unschedule('stations-daily-streak-risk'); exception when others then null; end $$;
select cron.schedule(
  'stations-daily-streak-risk',
  '30 15 * * *',
  $$ select private.send_daily_nudge('streak'); $$
);
