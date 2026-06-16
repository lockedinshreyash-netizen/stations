-- ============================================================
-- STATIONS — Challenges Engine (progress + leaderboard + cron)
-- Run once in the Supabase SQL editor. Idempotent.
--
-- The challenges / challenge_participants tables + enums already exist
-- (supabase/schema.sql). This adds: joining, windowed progress recompute,
-- the per-challenge leaderboard, and a pg_cron job that keeps every active
-- challenge's standings fresh. Progress is written ONLY by SECURITY DEFINER
-- functions, so a client can never forge current_value / completed.
--
-- Depends on the `private` schema (created by supabase/push_notifications.sql).
-- ============================================================

-- ------------------------------------------------------------
-- private.refresh_challenge_progress(p_user) — the core recompute. For every
-- ACTIVE challenge the user is in, recompute current_value windowed to the
-- challenge's [starts_at, ends_at] per its metric, and flip `completed`.
-- ------------------------------------------------------------
create or replace function private.refresh_challenge_progress(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v int;
begin
  for c in
    select cp.challenge_id, ch.metric, ch.target_value, ch.starts_at, ch.ends_at
      from public.challenge_participants cp
      join public.challenges ch on ch.id = cp.challenge_id
     where cp.user_id = p_user
       and now() between ch.starts_at and ch.ends_at
  loop
    if c.metric = 'focus_minutes' then
      select coalesce(sum(ws.duration_minutes), 0)::int into v
        from public.work_session_members wm
        join public.work_sessions ws on ws.id = wm.session_id
       where wm.user_id = p_user
         and wm.focus_quality_rating is not null
         and ws.status = 'completed'
         and ws.actual_end_time between c.starts_at and c.ends_at;
    elsif c.metric = 'sessions_completed' then
      select count(*)::int into v
        from public.work_session_members wm
        join public.work_sessions ws on ws.id = wm.session_id
       where wm.user_id = p_user
         and wm.focus_quality_rating is not null
         and ws.status = 'completed'
         and ws.actual_end_time between c.starts_at and c.ends_at;
    elsif c.metric = 'wins_posted' then
      select count(*)::int into v
        from public.wins
       where user_id = p_user
         and created_at between c.starts_at and c.ends_at;
    elsif c.metric = 'streak_days' then
      select coalesce(focus_streak_days, 0) into v
        from public.users where id = p_user;
    else
      v := 0;
    end if;

    update public.challenge_participants
       set current_value = v,
           completed = (v >= c.target_value)
     where challenge_id = c.challenge_id and user_id = p_user;
  end loop;
end $$;

-- ------------------------------------------------------------
-- public.refresh_challenge_progress() — caller refreshes their OWN standings
-- (the Compete page calls this on load). No arbitrary-user param is exposed.
-- ------------------------------------------------------------
create or replace function public.refresh_challenge_progress()
returns void
language sql
security definer
set search_path = public, private
as $$
  select private.refresh_challenge_progress(auth.uid());
$$;

revoke all on function public.refresh_challenge_progress() from public;
grant execute on function public.refresh_challenge_progress() to authenticated;

-- ------------------------------------------------------------
-- public.join_challenge(challenge_id) — idempotent enrolment + immediate refresh.
-- ------------------------------------------------------------
create or replace function public.join_challenge(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  insert into public.challenge_participants (challenge_id, user_id)
  values (p_challenge_id, uid)
  on conflict (challenge_id, user_id) do nothing;
  perform private.refresh_challenge_progress(uid);
end $$;

revoke all on function public.join_challenge(uuid) from public;
grant execute on function public.join_challenge(uuid) to authenticated;

-- ------------------------------------------------------------
-- public.challenge_leaderboard(challenge_id) — ranked standings. Exposes only
-- public display fields (username / avatar / founder number), like get_inbox.
-- ------------------------------------------------------------
create or replace function public.challenge_leaderboard(p_challenge_id uuid)
returns table (
  rank             int,
  user_id          uuid,
  username         text,
  avatar_url       text,
  founder_number   int,
  current_value    int,
  completed        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    row_number() over (
      order by cp.current_value desc, cp.joined_at asc
    )::int as rank,
    cp.user_id,
    u.username,
    u.avatar_url,
    u.founder_number,
    cp.current_value,
    cp.completed
  from public.challenge_participants cp
  join public.users u on u.id = cp.user_id
  where cp.challenge_id = p_challenge_id
  order by rank;
$$;

revoke all on function public.challenge_leaderboard(uuid) from public;
grant execute on function public.challenge_leaderboard(uuid) to authenticated;

-- ------------------------------------------------------------
-- private.refresh_all_active_challenges() — recompute everyone in any active
-- challenge. Driven by pg_cron so leaderboards stay fresh without each client
-- triggering a full refresh.
-- ------------------------------------------------------------
create or replace function private.refresh_all_active_challenges()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  r record;
begin
  for r in
    select distinct cp.user_id
      from public.challenge_participants cp
      join public.challenges ch on ch.id = cp.challenge_id
     where now() between ch.starts_at and ch.ends_at
  loop
    perform private.refresh_challenge_progress(r.user_id);
  end loop;
end $$;

create extension if not exists pg_cron with schema extensions;

do $$ begin
  perform cron.unschedule('stations-refresh-challenges');
exception when others then null; end $$;

select cron.schedule(
  'stations-refresh-challenges',
  '*/15 * * * *',
  $$ select private.refresh_all_active_challenges(); $$
);
