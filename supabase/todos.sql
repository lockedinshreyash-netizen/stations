-- ============================================================
-- STATIONS — Todos + Daily "3 things" plan
-- Run once in the Supabase SQL editor. (Run partnerships.sql first — the
-- get_partner_today_plan() function below references public.partnerships.)
--
-- The todo list is a GENERAL feature available to every member, independent of
-- accountability partners. It is also the foundational data layer we'll later
-- mine for streaks, XP, and leaderboards.
--
-- A todo with planned_for = current_date is part of today's "3 things" daily
-- plan. planned_for = null means it's just in the backlog.
-- ============================================================

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------
create table if not exists public.todos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  done         boolean not null default false,
  completed_at timestamptz,
  planned_for  date,        -- null = backlog; current_date = in today's daily plan
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists todos_user_planned_idx on public.todos (user_id, planned_for);
create index if not exists todos_user_open_idx     on public.todos (user_id, done);

-- One row per user per day, written only by the server-side completion resolver,
-- so the "finished all their tasks" push fires at most once per user per day
-- (re-checking a todo can never re-ping a partner).
create table if not exists public.daily_plan_completions (
  user_id      uuid not null references public.users(id) on delete cascade,
  plan_date    date not null,
  announced_at timestamptz not null default now(),
  primary key (user_id, plan_date)
);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Each member fully owns their own todos; nobody else can read or write them
-- directly. Partner read access is granted narrowly via the definer RPC below.
-- ------------------------------------------------------------
alter table public.todos enable row level security;

drop policy if exists "owner manages todos" on public.todos;
create policy "owner manages todos" on public.todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.daily_plan_completions enable row level security;

-- Owner may read their own completion markers (writes happen via the service
-- role only — there is intentionally no INSERT/UPDATE policy here).
drop policy if exists "owner reads completions" on public.daily_plan_completions;
create policy "owner reads completions" on public.daily_plan_completions
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- get_partner_today_plan(partner_id) — read a partner's daily plan.
-- Runs as definer so it can read another user's todos, but ONLY after verifying
-- the caller and partner_id are accepted accountability partners. This keeps the
-- todos RLS owner-only while still letting partners see each other's "3 things".
-- ------------------------------------------------------------
create or replace function public.get_partner_today_plan(partner_id uuid)
returns table (id uuid, title text, done boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.partnerships p
    where p.status = 'accepted'
      and (
        (p.requester_id = auth.uid() and p.addressee_id = partner_id) or
        (p.addressee_id = auth.uid() and p.requester_id = partner_id)
      )
  ) then
    raise exception 'not partners';
  end if;

  return query
    select t.id, t.title, t.done
    from public.todos t
    where t.user_id = partner_id
      and t.planned_for = current_date
    order by t.sort_order, t.created_at;
end $$;

grant execute on function public.get_partner_today_plan(uuid) to authenticated;
