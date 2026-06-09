-- ============================================================
-- STATIONS — Accountability Partners (1:1)
-- Run once in the Supabase SQL editor.
--
-- A partnership is an unordered pair of users. User A sends a request to user B;
-- B accepts (or declines). Once accepted, the two are accountability partners:
-- they can see each other's daily plan (see todos.sql) and get pinged when the
-- other finishes everything they committed to.
--
-- V1 is strictly 1:1 — no groups. The schema generalizes later to a memberships
-- model, but we keep it deliberately simple for now.
-- ============================================================

-- ------------------------------------------------------------
-- TABLE
-- Direction is preserved (requester/addressee) so a pending request knows who
-- still has to respond, but uniqueness is enforced on the UNORDERED pair so the
-- same two people can never have two partnership rows (in either direction).
-- ------------------------------------------------------------
create table if not exists public.partnerships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint partnerships_distinct check (requester_id <> addressee_id)
);

-- One row per unordered pair, regardless of who asked first.
create unique index if not exists partnerships_pair_idx on public.partnerships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- Fast lookups for "my partners" / "my pending requests" in either direction.
create index if not exists partnerships_requester_idx on public.partnerships (requester_id, status);
create index if not exists partnerships_addressee_idx on public.partnerships (addressee_id, status);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- A partnership row is only ever visible to its two participants.
-- ------------------------------------------------------------
alter table public.partnerships enable row level security;

drop policy if exists "participants read partnerships" on public.partnerships;
create policy "participants read partnerships" on public.partnerships
  for select using (auth.uid() in (requester_id, addressee_id));

-- Only the requester may create a request, and only as a pending one for itself.
drop policy if exists "requester creates pending" on public.partnerships;
create policy "requester creates pending" on public.partnerships
  for insert with check (auth.uid() = requester_id and status = 'pending');

-- Only the addressee may respond (accept/decline). The pair + requester can't
-- change; with check keeps the row's identity columns stable.
drop policy if exists "addressee responds" on public.partnerships;
create policy "addressee responds" on public.partnerships
  for update using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

-- Either party may remove the partnership (cancel a request, or un-partner).
drop policy if exists "either party removes" on public.partnerships;
create policy "either party removes" on public.partnerships
  for delete using (auth.uid() in (requester_id, addressee_id));

-- ------------------------------------------------------------
-- REALTIME — deliver live partnership changes to the two participants. RLS
-- filters events, so each user only sees rows they're part of (the inbox
-- "Partners" tab refreshes when a request arrives or is accepted/removed).
-- ------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.partnerships;
exception when duplicate_object then null;
end $$;
