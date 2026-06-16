-- ============================================================
-- STATIONS — Global Announcements
-- Run once in the Supabase SQL editor. Idempotent.
--
-- A one-to-many broadcast channel. Every platform member can READ; only admins
-- (users.is_admin = true) can write — that is the DB-level "only I can push"
-- guarantee. Unread state is a per-user watermark (users.announcements_seen_at);
-- no per-row reads table is needed.
-- ============================================================

-- ------------------------------------------------------------
-- TABLE
-- ------------------------------------------------------------
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  url        text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists announcements_created_idx
  on public.announcements (created_at desc);

-- ------------------------------------------------------------
-- UNREAD WATERMARK — last time the member opened the bell.
-- ------------------------------------------------------------
alter table public.users
  add column if not exists announcements_seen_at timestamptz;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
--   • any authenticated member may READ announcements
--   • only admins may INSERT / UPDATE / DELETE
-- Both policies are permissive (OR'd): members get read, admins get everything.
-- ------------------------------------------------------------
alter table public.announcements enable row level security;

drop policy if exists "Members can read announcements" on public.announcements;
create policy "Members can read announcements" on public.announcements
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage announcements" on public.announcements;
create policy "Admins can manage announcements" on public.announcements
  for all
  to authenticated
  using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );
