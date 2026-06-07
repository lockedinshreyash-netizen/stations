-- ============================================================
-- STATIONS — Web Push notifications
-- Run once in the Supabase SQL editor.
--
-- IMPORTANT design note: live notifications (DMs, reactions, session starts,
-- mentions) are fired from the APP, AFTER the write commits, via the
-- session-authed /api/push/notify route. They are NOT database triggers — a
-- notification must never run inside a user's transaction, because a failing
-- trigger rolls the write back (this previously broke reactions).
--
-- The ONLY database-driven push is the timed session reminder, which is a
-- background pg_cron job (see session_reminders.sql) and therefore can never
-- affect a user action. pg_net is needed only for that job.
-- ============================================================

-- Remove the old write-path triggers if a previous version installed them.
-- These are what broke reactions/DMs; they must not exist.
drop trigger if exists push_reaction       on public.win_reactions;
drop trigger if exists push_dm             on public.direct_messages;
drop trigger if exists push_session_active on public.work_sessions;
drop function if exists public.push_on_reaction();
drop function if exists public.push_on_dm();
drop function if exists public.push_on_session_active();

-- pg_net ships with Supabase; needed by the reminder cron job for outbound HTTP.
create extension if not exists pg_net with schema extensions;

-- ------------------------------------------------------------
-- SUBSCRIPTIONS — one row per browser/device endpoint.
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Each user manages only their own subscriptions. The service role (used by the
-- API to read every recipient's endpoints and prune dead ones) bypasses RLS.
drop policy if exists "manage own push subscriptions" on public.push_subscriptions;
create policy "manage own push subscriptions" on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- CONFIG — base URL + shared secret for the reminder webhook, kept out of the
-- app schema. Fill after deploying (must match the app's env):
--   update private.push_config set
--     webhook_url = 'https://stations-delta.vercel.app/api/push/event',
--     webhook_secret = '<same as PUSH_WEBHOOK_SECRET env>';
-- ------------------------------------------------------------
create schema if not exists private;

create table if not exists private.push_config (
  id             boolean primary key default true check (id),  -- single row
  webhook_url    text not null default '',
  webhook_secret text not null default ''
);
insert into private.push_config (id) values (true) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- notify_push(payload) — fire-and-forget POST to the reminder webhook. Used
-- ONLY by the session-reminder cron. Wrapped so it can never raise.
-- ------------------------------------------------------------
create or replace function private.notify_push(payload jsonb)
returns void
language plpgsql
security definer
set search_path = private, extensions, public
as $$
declare
  cfg private.push_config%rowtype;
begin
  select * into cfg from private.push_config where id;
  if cfg.webhook_url is null or cfg.webhook_url = '' then
    return; -- not configured yet
  end if;

  perform net.http_post(
    url     := cfg.webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', cfg.webhook_secret
    ),
    body    := payload
  );
exception
  when others then
    raise warning 'notify_push failed: %', sqlerrm;
end $$;
