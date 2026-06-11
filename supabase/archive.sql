-- ============================================================
-- STATIONS — Archive Station (03) schema
-- Premium courses platform: courses → lessons (Mux video) +
-- per-lesson progress. Catalog is readable by everyone (so free
-- members see what they're missing); the actual video is gated at
-- the Mux playback-token route, not here. Writes are admin-only.
-- Run this in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

-- A course is intentionally flexible: it may have a single lesson
-- (one webinar/interview recording) or a multi-lesson series.
create table if not exists archive_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  description text,
  -- Instructor is denormalized so creators need not be app members.
  instructor_name text not null default '',
  instructor_title text,                -- e.g. "Athlete · Recovery"
  instructor_avatar_url text,
  instructor_user_id uuid references users(id) on delete set null,
  thumbnail_url text,                   -- public Storage bucket: course-thumbnails
  topic text,                           -- reserved for V2 category filtering (no UI yet)
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists archive_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references archive_courses(id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null default 0,
  -- Mux refs. upload_id lets the webhook find this lesson before the
  -- asset exists; passthrough on the asset carries the lesson id too.
  mux_upload_id text,
  mux_asset_id text,
  mux_playback_id text,                 -- signed playback id (filled by webhook)
  duration_seconds integer,             -- filled by webhook
  status text not null default 'awaiting_upload'
    check (status in ('awaiting_upload', 'processing', 'ready', 'errored')),
  created_at timestamptz not null default now()
);

-- One row per (user, lesson). Course % is derived (completed / total).
create table if not exists archive_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  lesson_id uuid not null references archive_lessons(id) on delete cascade,
  completed boolean not null default false,
  last_position_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
create index if not exists idx_archive_courses_status on archive_courses (status);
create index if not exists idx_archive_courses_sort on archive_courses (sort_order);
create index if not exists idx_archive_lessons_course on archive_lessons (course_id, order_index);
create index if not exists idx_archive_lessons_upload on archive_lessons (mux_upload_id);
create index if not exists idx_archive_lesson_progress_user on archive_lesson_progress (user_id);

-- ------------------------------------------------------------
-- RLS — archive_courses
-- Catalog read: published visible to ALL authed users (free included)
-- so the locked catalog can drive upgrades. Admins also see drafts.
-- ------------------------------------------------------------
alter table archive_courses enable row level security;

drop policy if exists "archive_courses public read" on archive_courses;
create policy "archive_courses public read" on archive_courses
  for select using (
    status = 'published'
    or exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true)
  );

drop policy if exists "archive_courses admin all" on archive_courses;
create policy "archive_courses admin all" on archive_courses
  for all
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true))
  with check (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true));

-- ------------------------------------------------------------
-- RLS — archive_lessons
-- Lesson metadata (title/duration) visible whenever its course is
-- published; the VIDEO itself is still gated by the token route.
-- ------------------------------------------------------------
alter table archive_lessons enable row level security;

drop policy if exists "archive_lessons public read" on archive_lessons;
create policy "archive_lessons public read" on archive_lessons
  for select using (
    exists (
      select 1 from archive_courses c
      where c.id = archive_lessons.course_id and c.status = 'published'
    )
    or exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true)
  );

drop policy if exists "archive_lessons admin all" on archive_lessons;
create policy "archive_lessons admin all" on archive_lessons
  for all
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true))
  with check (exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true));

-- ------------------------------------------------------------
-- RLS — archive_lesson_progress
-- Callers read/write ONLY their own rows, and must be paid/founding
-- (free members can't watch, so they can't accrue progress).
-- ------------------------------------------------------------
alter table archive_lesson_progress enable row level security;

drop policy if exists "archive_progress own read" on archive_lesson_progress;
create policy "archive_progress own read" on archive_lesson_progress
  for select using (auth.uid() = user_id);

drop policy if exists "archive_progress own insert" on archive_lesson_progress;
create policy "archive_progress own insert" on archive_lesson_progress
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from users u
      where u.id = auth.uid() and u.membership_tier in ('paid', 'founding')
    )
  );

drop policy if exists "archive_progress own update" on archive_lesson_progress;
create policy "archive_progress own update" on archive_lesson_progress
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from users u
      where u.id = auth.uid() and u.membership_tier in ('paid', 'founding')
    )
  );
