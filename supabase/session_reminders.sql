-- ============================================================
-- STATIONS — Timed session reminders
-- Run once in the Supabase SQL editor, AFTER push_notifications.sql.
--
-- Sends a "starting in N min" push to a session's host + joined members shortly
-- before its scheduled start. Driven by pg_cron (runs every minute); a sent
-- marker prevents duplicate reminders.
-- ============================================================

create extension if not exists pg_cron with schema extensions;

-- One-shot marker so each session is reminded at most once.
alter table public.work_sessions
  add column if not exists reminder_sent_at timestamptz;

-- How many minutes before scheduled_start_time to send the reminder.
alter table private.push_config
  add column if not exists reminder_lead_minutes integer not null default 10;

-- ------------------------------------------------------------
-- send_session_reminders() — find imminent scheduled sessions that haven't been
-- reminded yet, fire one push each, and stamp them so they aren't repeated.
-- ------------------------------------------------------------
create or replace function private.send_session_reminders()
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  lead integer;
  s    record;
begin
  select reminder_lead_minutes into lead from private.push_config where id;
  lead := coalesce(lead, 10);

  for s in
    select id
    from public.work_sessions
    where status = 'scheduled'
      and reminder_sent_at is null
      and scheduled_start_time > now()
      and scheduled_start_time <= now() + make_interval(mins => lead)
  loop
    perform private.notify_push(jsonb_build_object(
      'type', 'session_reminder',
      'session_id', s.id
    ));
    update public.work_sessions
       set reminder_sent_at = now()
     where id = s.id;
  end loop;
end $$;

-- ------------------------------------------------------------
-- Schedule it every minute. Re-running this file is safe: unschedule first.
-- ------------------------------------------------------------
do $$
begin
  perform cron.unschedule('stations-session-reminders');
exception when others then null;
end $$;

select cron.schedule(
  'stations-session-reminders',
  '* * * * *',
  $$ select private.send_session_reminders(); $$
);
