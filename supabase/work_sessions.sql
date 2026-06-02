-- ============================================================
-- STATIONS — Work Station (04) schema
-- Scheduled co-working sessions: tables, RLS, and the atomic
-- focus-rating RPC. Run this in the Supabase SQL editor.
-- Safe to re-run (IF NOT EXISTS / OR REPLACE / drop-recreate policies).
-- ============================================================

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------
create table if not exists work_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references users(id) on delete cascade,
  title text not null,
  category text not null check (category in ('scholar', 'builder', 'creator', 'athlete')),
  duration_minutes integer not null,
  scheduled_start_time timestamptz not null,
  scheduled_end_time timestamptz not null,
  actual_start_time timestamptz,
  actual_end_time timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed', 'cancelled')),
  chat_closed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists work_session_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references work_sessions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_early boolean not null default false,
  leave_reason text,
  left_at timestamptz,
  focus_quality_rating integer check (focus_quality_rating >= 1 and focus_quality_rating <= 5),
  unique (session_id, user_id)
);

-- ------------------------------------------------------------
-- USERS — focus stat columns
-- ------------------------------------------------------------
alter table users add column if not exists total_focus_hours integer not null default 0;
alter table users add column if not exists total_sessions_completed integer not null default 0;
alter table users add column if not exists focus_streak_days integer not null default 0;
alter table users add column if not exists last_focus_session_date date;

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
create index if not exists idx_work_sessions_status on work_sessions (status);
create index if not exists idx_work_sessions_start on work_sessions (scheduled_start_time);
create index if not exists idx_work_session_members_session on work_session_members (session_id);
create index if not exists idx_work_session_members_user on work_session_members (user_id);

-- ------------------------------------------------------------
-- RLS — work_sessions
-- ------------------------------------------------------------
alter table work_sessions enable row level security;

drop policy if exists "work_sessions select" on work_sessions;
create policy "work_sessions select" on work_sessions
  for select using (auth.uid() is not null);

drop policy if exists "work_sessions insert" on work_sessions;
create policy "work_sessions insert" on work_sessions
  for insert with check (auth.uid() = host_id);

drop policy if exists "work_sessions host update" on work_sessions;
create policy "work_sessions host update" on work_sessions
  for update using (auth.uid() = host_id);

-- ------------------------------------------------------------
-- RLS — work_session_members
-- ------------------------------------------------------------
alter table work_session_members enable row level security;

drop policy if exists "work_session_members select" on work_session_members;
create policy "work_session_members select" on work_session_members
  for select using (auth.uid() is not null);

drop policy if exists "work_session_members insert" on work_session_members;
create policy "work_session_members insert" on work_session_members
  for insert with check (auth.uid() = user_id);

drop policy if exists "work_session_members own update" on work_session_members;
create policy "work_session_members own update" on work_session_members
  for update using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- RPC — submit_focus_rating
-- Atomically: records the caller's rating + updates the caller's
-- focus stats (hours, sessions, streak). Each member rates and
-- updates only their own row, so this is RLS-safe via SECURITY
-- DEFINER while never touching other users' stats.
-- Returns a recap row for the UI.
-- ------------------------------------------------------------
create or replace function submit_focus_rating(
  p_session_id uuid,
  p_user_id uuid,
  p_rating integer
)
returns table (
  duration_minutes integer,
  others_count integer,
  focus_quality_rating integer,
  focus_streak_days integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration integer;
  v_others integer;
  v_last date;
  v_today date := current_date;
  v_streak integer;
  v_already_rated boolean;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select s.duration_minutes into v_duration
  from work_sessions s
  where s.id = p_session_id;

  if v_duration is null then
    raise exception 'Session not found';
  end if;

  -- Had the caller already rated? (Guards against double-counting stats.)
  select (m.focus_quality_rating is not null) into v_already_rated
  from work_session_members m
  where m.session_id = p_session_id and m.user_id = p_user_id;

  if v_already_rated is null then
    raise exception 'You are not a member of this session';
  end if;

  -- Record / update the caller's rating.
  update work_session_members m
  set focus_quality_rating = p_rating
  where m.session_id = p_session_id and m.user_id = p_user_id;

  -- Everyone else in the session (for the recap line).
  select count(*) into v_others
  from work_session_members m
  where m.session_id = p_session_id and m.user_id <> p_user_id;

  -- A re-rating just updates the score; stats were already counted once.
  if v_already_rated then
    select u.focus_streak_days into v_streak from users u where u.id = p_user_id;
    return query select v_duration, v_others, p_rating, coalesce(v_streak, 0);
    return;
  end if;

  -- Streak calculation (STEP 7) — first rating only.
  select u.last_focus_session_date into v_last
  from users u where u.id = p_user_id;

  if v_last is null then
    v_streak := 1;
  elsif v_last = v_today then
    -- Already counted today — keep streak, don't double-add the day.
    select u.focus_streak_days into v_streak from users u where u.id = p_user_id;
  elsif v_last = v_today - 1 then
    select u.focus_streak_days + 1 into v_streak from users u where u.id = p_user_id;
  else
    v_streak := 1; -- missed a day → reset
  end if;

  update users u
  set
    total_focus_hours = u.total_focus_hours + round(v_duration / 60.0)::int,
    total_sessions_completed = u.total_sessions_completed + 1,
    focus_streak_days = v_streak,
    last_focus_session_date = v_today
  where u.id = p_user_id;

  return query select v_duration, v_others, p_rating, v_streak;
end;
$$;

grant execute on function submit_focus_rating(uuid, uuid, integer) to authenticated;
