-- ============================================================
-- STATIONS — Archive Station (03): JOURNEYS
-- A discovery feed of "what I'm trying to become / build / achieve".
-- Members publish a Journey; everyone browses them inside Archive.
--
-- This migration is PURELY ADDITIVE and idempotent — it creates new
-- enums + a new table, adds ONE nullable column to `wins`, and never
-- alters or drops anything that already exists. Posting wins, courses,
-- and every other surface keep working whether or not this is applied.
--
-- Run this in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- ENUMS (idempotent: swallow duplicate_object on re-run)
-- ------------------------------------------------------------
do $$ begin
  create type journey_category as enum
    ('startup','career','fitness','education','creator','project','business','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type journey_stage as enum
    ('researching','learning','building','applying','growing');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- TABLE
-- ------------------------------------------------------------
create table if not exists journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  emoji text not null default '🚀',
  title text not null check (char_length(title) between 1 and 80),
  category journey_category not null default 'other',
  why text check (char_length(why) <= 600),               -- "why this matters to me"
  stage journey_stage not null default 'building',
  challenges text check (char_length(challenges) <= 400), -- optional
  is_open_to_connect boolean not null default true,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  follower_count integer not null default 0,              -- reserved for V2 follows
  last_activity_at timestamptz not null default now(),    -- drives "Currently building" sort
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional link from a Win to a Journey. Nullable + ON DELETE SET NULL,
-- so deleting a journey never deletes wins, and existing wins are untouched.
alter table wins add column if not exists journey_id uuid
  references journeys(id) on delete set null;

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
create index if not exists idx_journeys_feed on journeys (status, last_activity_at desc);
create index if not exists idx_journeys_user on journeys (user_id);
create index if not exists idx_journeys_category on journeys (category) where status = 'active';
create index if not exists idx_wins_journey on wins (journey_id, created_at desc);

-- ------------------------------------------------------------
-- RLS — journeys
-- Read: any ACTIVE member browses active/paused journeys; owner & admin
-- see all (incl. their own archived). Mirrors the wins read model.
-- ------------------------------------------------------------
alter table journeys enable row level security;

drop policy if exists "journeys read" on journeys;
create policy "journeys read" on journeys
  for select using (
    (status in ('active', 'paused')
      and exists (select 1 from users u where u.id = auth.uid() and u.status = 'active'))
    or auth.uid() = user_id
    or exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true)
  );

-- Create: ANY active member (free included). Creating a journey is open to
-- everyone — only posting Wins stays paid.
drop policy if exists "journeys insert own" on journeys;
create policy "journeys insert own" on journeys
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from users u where u.id = auth.uid() and u.status = 'active')
  );

drop policy if exists "journeys update own" on journeys;
create policy "journeys update own" on journeys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "journeys delete own" on journeys;
create policy "journeys delete own" on journeys
  for delete using (auth.uid() = user_id);

drop policy if exists "journeys admin all" on journeys;
create policy "journeys admin all" on journeys
  for all
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true))
  with check (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true));
