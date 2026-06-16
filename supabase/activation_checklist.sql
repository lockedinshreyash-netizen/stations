-- ============================================================
-- STATIONS — Activation Checklist
-- Run once in the Supabase SQL editor. Idempotent.
--
-- A gamified "first moves" list, SEPARATE from the daily task todos. Five of the
-- six items are derived live from existing tables; only "room_intro" (which lives
-- in Firebase, not Postgres) is persisted here, stamped right after a successful
-- room post.
-- ============================================================

-- ------------------------------------------------------------
-- TABLE — persists only the items we can't derive from SQL.
-- ------------------------------------------------------------
create table if not exists public.activation_tasks (
  user_id      uuid not null references public.users(id) on delete cascade,
  item_key     text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

alter table public.activation_tasks enable row level security;

drop policy if exists "manage own activation tasks" on public.activation_tasks;
create policy "manage own activation tasks" on public.activation_tasks
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Whole-widget dismissal (cross-device), owner-updatable like first_run_completed_at.
alter table public.users
  add column if not exists activation_dismissed boolean not null default false;

-- ------------------------------------------------------------
-- get_activation_checklist() — the 6 booleans for the current member.
-- SECURITY DEFINER so it can read the caller's own rows across tables without
-- each table's RLS; strictly scoped to auth.uid(), so no cross-user leakage.
-- ------------------------------------------------------------
create or replace function public.get_activation_checklist()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile_complete', exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.avatar_url is not null
        and coalesce(trim(u.bio), '') <> ''
    ),
    'post_win', exists (
      select 1 from public.wins where user_id = auth.uid()
    ),
    'focus_session', exists (
      select 1 from public.work_session_members where user_id = auth.uid()
    ),
    'add_partner', exists (
      select 1 from public.partnerships
      where status = 'accepted' and auth.uid() in (requester_id, addressee_id)
    ),
    'enable_notifications', exists (
      select 1 from public.push_subscriptions where user_id = auth.uid()
    ),
    'room_intro', exists (
      select 1 from public.activation_tasks
      where user_id = auth.uid() and item_key = 'room_intro'
    )
  );
$$;

revoke all on function public.get_activation_checklist() from public;
grant execute on function public.get_activation_checklist() to authenticated;

-- ------------------------------------------------------------
-- complete_activation_task(item_key) — stamp a persisted item.
-- Only 'room_intro' is client-stampable; the rest are derived above, so they
-- can't be forged. Called right after a successful room post.
-- ------------------------------------------------------------
create or replace function public.complete_activation_task(p_item_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_item_key not in ('room_intro') then
    raise exception 'unknown activation item: %', p_item_key;
  end if;
  insert into public.activation_tasks (user_id, item_key)
  values (uid, p_item_key)
  on conflict (user_id, item_key) do nothing;
end $$;

revoke all on function public.complete_activation_task(text) from public;
grant execute on function public.complete_activation_task(text) to authenticated;
