-- ============================================================
-- STATIONS — Web Push notifications
-- Run once in the Supabase SQL editor.
--
-- Architecture: client mutations go straight to Postgres under RLS, so pushes
-- are fired by DATABASE TRIGGERS, not the app server. Each trigger POSTs a tiny
-- {type, ...ids} event to the Next.js webhook (/api/push/event) via pg_net; the
-- route resolves recipients with the service role and sends the Web Push.
-- ============================================================

-- pg_net ships with Supabase; enable it for outbound HTTP from triggers.
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
-- webhook to read every recipient's endpoints and prune dead ones) bypasses RLS.
drop policy if exists "manage own push subscriptions" on public.push_subscriptions;
create policy "manage own push subscriptions" on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- CONFIG — base URL + shared secret for the webhook, kept out of the app schema.
-- Fill BOTH rows after deploying (values must match the app's env):
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
-- notify_push(payload) — fire-and-forget POST to the webhook.
-- SECURITY DEFINER so it can read private.push_config and reach pg_net.
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
    return; -- not configured yet; do nothing rather than error a user's write
  end if;

  perform net.http_post(
    url     := cfg.webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', cfg.webhook_secret
    ),
    body    := payload
  );
end $$;

-- ------------------------------------------------------------
-- TRIGGER: new direct message → notify the recipient.
-- ------------------------------------------------------------
create or replace function public.push_on_dm()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.notify_push(jsonb_build_object(
    'type', 'dm',
    'conversation_id', new.conversation_id,
    'sender_id', new.sender_id,
    'content', new.content
  ));
  return new;
end $$;

drop trigger if exists push_dm on public.direct_messages;
create trigger push_dm
  after insert on public.direct_messages
  for each row execute function public.push_on_dm();

-- ------------------------------------------------------------
-- TRIGGER: new win reaction → notify the win's author.
-- ------------------------------------------------------------
create or replace function public.push_on_reaction()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.notify_push(jsonb_build_object(
    'type', 'reaction',
    'win_id', new.win_id,
    'actor_id', new.user_id,
    'emoji', new.emoji
  ));
  return new;
end $$;

drop trigger if exists push_reaction on public.win_reactions;
create trigger push_reaction
  after insert on public.win_reactions
  for each row execute function public.push_on_reaction();

-- ------------------------------------------------------------
-- TRIGGER: a work session goes live (status → 'active') → notify the whole
-- category cohort + anyone who joined. Fires only on the transition, so the
-- host flipping the status once produces exactly one broadcast.
-- ------------------------------------------------------------
create or replace function public.push_on_session_active()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    perform private.notify_push(jsonb_build_object(
      'type', 'session_start',
      'session_id', new.id
    ));
  end if;
  return new;
end $$;

drop trigger if exists push_session_active on public.work_sessions;
create trigger push_session_active
  after update on public.work_sessions
  for each row execute function public.push_on_session_active();
