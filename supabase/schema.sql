-- ============================================================
-- STATIONS — Supabase PostgreSQL Schema
-- Run this in the Supabase SQL editor to initialize the database
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type membership_tier as enum ('founding', 'paid', 'free');
-- role is stored as text[] to allow multi-role users (max 2 selected during onboarding)
create type user_status as enum ('pending', 'active', 'suspended');
create type application_status as enum ('pending', 'approved', 'rejected');
create type session_type as enum ('study', 'work', 'build', 'focus');
create type session_station as enum ('work', 'focus');
create type session_status as enum ('waiting', 'active', 'ended');
create type win_category as enum ('startup', 'project', 'fitness', 'exam', 'personal', 'other');
create type build_stage as enum ('idea', 'building', 'launched');
create type challenge_type as enum ('weekly', 'monthly');
create type challenge_metric as enum ('focus_minutes', 'sessions_completed', 'wins_posted', 'streak_days');

-- ============================================================
-- USERS
-- ============================================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null,
  avatar_url text,
  role text[] not null default '{}',
  goals text[] not null default '{}',
  category text not null default 'Grinder',
  bio text,
  status user_status not null default 'pending',
  membership_tier membership_tier not null default 'free',
  is_admin boolean not null default false,
  total_focus_minutes integer not null default 0,
  total_sessions integer not null default 0,
  streak_days integer not null default 0,
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);

alter table users enable row level security;

create policy "Users can view active members" on users
  for select using (status = 'active' or auth.uid() = id);

create policy "Users can update own profile" on users
  for update using (auth.uid() = id);

create policy "Service role full access to users" on users
  using (auth.role() = 'service_role');

-- ============================================================
-- APPLICATIONS
-- ============================================================
create table applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  why_join text not null,
  goals_declaration text not null default '',
  role text not null,
  status application_status not null default 'pending',
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table applications enable row level security;

create policy "Users can view own application" on applications
  for select using (auth.uid() = user_id);

create policy "Users can insert own application" on applications
  for insert with check (auth.uid() = user_id);

create policy "Admins can manage all applications" on applications
  using (exists (select 1 from users where id = auth.uid() and is_admin = true));

-- ============================================================
-- SESSIONS
-- ============================================================
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  type session_type not null,
  host_id uuid not null references users(id) on delete cascade,
  station session_station not null,
  status session_status not null default 'waiting',
  chat_locked boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "Active members can view sessions" on sessions
  for select using (
    exists (select 1 from users where id = auth.uid() and status = 'active' and membership_tier in ('paid', 'founding'))
  );

create policy "Active paid members can create sessions" on sessions
  for insert with check (
    exists (select 1 from users where id = auth.uid() and status = 'active' and membership_tier in ('paid', 'founding'))
  );

create policy "Host can update own session" on sessions
  for update using (auth.uid() = host_id);

-- ============================================================
-- SESSION PARTICIPANTS
-- ============================================================
create table session_participants (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  duration_minutes integer,
  unique (session_id, user_id)
);

alter table session_participants enable row level security;

create policy "Paid members can manage own participation" on session_participants
  for all using (
    auth.uid() = user_id and
    exists (select 1 from users where id = auth.uid() and membership_tier in ('paid', 'founding'))
  );

create policy "Paid members can view participants" on session_participants
  for select using (
    exists (select 1 from users where id = auth.uid() and membership_tier in ('paid', 'founding'))
  );

-- ============================================================
-- WINS
-- ============================================================
create table wins (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  description text not null,
  category win_category not null,
  media_url text,
  reactions_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table wins enable row level security;

create policy "Active members can view wins" on wins
  for select using (
    exists (select 1 from users where id = auth.uid() and status = 'active')
  );

create policy "Paid members can post wins" on wins
  for insert with check (
    exists (select 1 from users where id = auth.uid() and status = 'active' and membership_tier in ('paid', 'founding'))
  );

create policy "Users can update own wins" on wins
  for update using (auth.uid() = user_id);

-- ============================================================
-- BUILDS
-- ============================================================
create table builds (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text not null check (char_length(description) <= 120),
  stage build_stage not null default 'idea',
  looking_for text,
  is_looking boolean not null default false,
  tags text[] not null default '{}',
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table builds enable row level security;

create policy "Active members can view builds" on builds
  for select using (
    exists (select 1 from users where id = auth.uid() and status = 'active')
  );

create policy "Paid members can manage own builds" on builds
  for all using (
    auth.uid() = user_id and
    exists (select 1 from users where id = auth.uid() and membership_tier in ('paid', 'founding'))
  );

-- ============================================================
-- CHALLENGES
-- ============================================================
create table challenges (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null,
  type challenge_type not null,
  category text,
  metric challenge_metric not null,
  target_value integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

alter table challenges enable row level security;

create policy "Paid members can view challenges" on challenges
  for select using (
    exists (select 1 from users where id = auth.uid() and membership_tier in ('paid', 'founding'))
  );

create policy "Admins can manage challenges" on challenges
  for all using (
    exists (select 1 from users where id = auth.uid() and is_admin = true)
  );

-- ============================================================
-- CHALLENGE PARTICIPANTS
-- ============================================================
create table challenge_participants (
  id uuid primary key default uuid_generate_v4(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  current_value integer not null default 0,
  completed boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

alter table challenge_participants enable row level security;

create policy "Paid members can manage own participation" on challenge_participants
  for all using (
    auth.uid() = user_id and
    exists (select 1 from users where id = auth.uid() and membership_tier in ('paid', 'founding'))
  );

create policy "Paid members can view participants" on challenge_participants
  for select using (
    exists (select 1 from users where id = auth.uid() and membership_tier in ('paid', 'founding'))
  );

-- ============================================================
-- MESSAGES
-- ============================================================
create table messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

-- Messages only insertable when session chat is not locked
create policy "Paid members can insert when chat unlocked" on messages
  for insert with check (
    auth.uid() = user_id and
    exists (select 1 from users where id = auth.uid() and membership_tier in ('paid', 'founding')) and
    exists (select 1 from sessions where id = session_id and chat_locked = false)
  );

create policy "Session participants can view messages" on messages
  for select using (
    exists (select 1 from session_participants where session_id = messages.session_id and user_id = auth.uid())
  );

-- ============================================================
-- WIN REACTIONS (join table — one reaction per user per win)
-- ============================================================
create table win_reactions (
  id uuid primary key default uuid_generate_v4(),
  win_id uuid not null references wins(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (win_id, user_id)
);

alter table win_reactions enable row level security;

create policy "Active members can manage own reactions" on win_reactions
  for all using (
    auth.uid() = user_id and
    exists (select 1 from users where id = auth.uid() and status = 'active')
  );

create policy "Active members can view reactions" on win_reactions
  for select using (
    exists (select 1 from users where id = auth.uid() and status = 'active')
  );

-- ============================================================
-- ARCHIVE RESOURCES
-- ============================================================
create table archive_resources (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text not null,
  url text not null,
  category text not null,
  contributed_by uuid not null references users(id),
  is_pinned boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table archive_resources enable row level security;

create policy "Paid members can view approved resources" on archive_resources
  for select using (
    is_approved = true and
    exists (select 1 from users where id = auth.uid() and membership_tier in ('paid', 'founding'))
  );

create policy "Paid members can submit resources" on archive_resources
  for insert with check (
    exists (select 1 from users where id = auth.uid() and membership_tier in ('paid', 'founding'))
  );

create policy "Admins can manage all resources" on archive_resources
  for all using (
    exists (select 1 from users where id = auth.uid() and is_admin = true)
  );

-- ============================================================
-- INDEXES
-- ============================================================
create index on users (membership_tier);
create index on users (status);
create index on users (category);
create index on wins (user_id);
create index on wins (created_at desc);
create index on sessions (status);
create index on sessions (station);
create index on builds (stage);
create index on builds (is_looking);
create index on challenge_participants (challenge_id);
create index on messages (session_id, created_at);
