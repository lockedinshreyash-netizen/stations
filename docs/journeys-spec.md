# Archive → Journeys

A discovery feed inside the Archive station (03) where members publish *what they're
trying to become, build, or achieve* — and browse everyone else's. Fills the empty
Archive while courses/interviews are still being produced.

> Design principle: **a window into people, not a directory.** No search-first UI, no
> filters-as-the-point, no career database. Cards that feel personal and make you
> curious about the person behind them.

This lives in the **app** repo (`D:\StationsHQ\stations`), not the marketing site.
Archive is already Station 03 (`app/(platform)/archive`), currently a Mux courses
catalog. Journeys becomes the **default** Archive tab; Courses moves to a second tab.

---

## 0. Why this is cheap to build here

The app already has every primitive Journeys needs:

| Need | Already exists | Reuse |
|---|---|---|
| The concept | dormant `builds` table (`stage` idea/building/launched, `looking_for`, `tags`) — **no UI ever shipped** | Journeys is the richer realization; we add a fresh `journeys` table rather than retrofit the 120-char `builds` row |
| Author identity | `users` (username, avatar, `founder_number`), `openUserProfile(id)`, `FounderMark` | as-is |
| "Connect" | DM request flow (`dm_requests.sql`, `direct_messages.sql`) + `UserProfileModal` | as-is |
| Recent wins | `wins` table + `win_category` enum + reactions | add nullable `journey_id` FK |
| Feed UI | `WinsFeed` / `WinCard` (realtime, pagination, `st-card`) | clone the pattern |
| Catalog/empty states | `ArchiveCatalog`, `StationHeader` | wrap with a tab switch |
| Write API patterns | direct Supabase + RLS for reads/writes; route handlers only for push/mux/billing | direct Supabase + 1 RPC |
| Admin gate / RLS / RPC / push conventions | throughout `supabase/*.sql`, `api/announcements/route.ts` | mirror exactly |

---

## 1. UX flow

```
Archive (03)
 ├─ [ Journeys | Courses ]  ← segmented control, Journeys default
 │
 ├─ JOURNEYS TAB (the feed)
 │   ├─ Featured / "Currently building"  (last_activity_at desc, has wins)
 │   ├─ Category chips (soft filter, NOT search-first)  🚀 💰 🏃 🎥 📚 …
 │   ├─ Journey cards (emoji · title · @author · category · stage · 1-line why · "N recent wins")
 │   ├─ "+ Share your journey" FAB / banner (only if you have none, or < soft-cap)
 │   └─ infinite scroll (25/page, matches wins feed)
 │
 │   tap card → JOURNEY DETAIL
 │     ├─ emoji + title + category + stage chip
 │     ├─ @author + FounderMark  (tap → profile modal)
 │     ├─ Why this matters to me   (serif/italic, the emotional core)
 │     ├─ Current challenge        (optional)
 │     ├─ Recent wins              (auto-pulled: wins where journey_id = this)
 │     ├─ [ Connect ]  → DM request    [ Follow ] (V2)
 │     └─ owner sees [ Edit ] / [ Update stage ] / [ Archive ]
 │
 └─ COURSES TAB = today's ArchiveCatalog, untouched
```

Create/edit is a single modal (mirrors `PostWinModal` / `EditWinModal`): emoji picker,
title, category select, stage select, "why" textarea, optional challenge, connect toggle.

---

## 2. Database schema (`supabase/journeys.sql`)

Idempotent, matches existing conventions (`if not exists`, RLS drop/create, `auth.uid()`).

```sql
-- ============================================================
-- STATIONS — Archive Station (03): Journeys
-- Public, browsable "what I'm building" cards. Discovery, not directory.
-- Safe to re-run.
-- ============================================================

create type journey_category as enum
  ('startup','career','fitness','education','creator','project','business','other');

create type journey_stage as enum
  ('researching','learning','building','applying','growing');

create table if not exists journeys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  emoji text not null default '🚀',
  title text not null check (char_length(title) between 1 and 80),
  category journey_category not null default 'other',
  why text check (char_length(why) <= 600),            -- "why this matters to me"
  stage journey_stage not null default 'building',
  challenges text check (char_length(challenges) <= 400),  -- optional
  is_open_to_connect boolean not null default true,
  status text not null default 'active'
    check (status in ('active','paused','archived')),
  follower_count integer not null default 0,           -- denormalized for V2 follows
  last_activity_at timestamptz not null default now(), -- drives "Currently building" sort
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Link a Win to a Journey (nullable, backward compatible).
alter table wins add column if not exists journey_id uuid
  references journeys(id) on delete set null;

create index if not exists idx_journeys_feed on journeys (status, last_activity_at desc);
create index if not exists idx_journeys_user on journeys (user_id);
create index if not exists idx_journeys_category on journeys (category) where status = 'active';
create index if not exists idx_wins_journey on wins (journey_id, created_at desc);

-- ---------------- RLS ----------------
alter table journeys enable row level security;

-- Read: any ACTIVE member can browse active/paused journeys; owner & admin see all.
drop policy if exists "journeys read" on journeys;
create policy "journeys read" on journeys
  for select using (
    (status in ('active','paused')
       and exists (select 1 from users u where u.id = auth.uid() and u.status = 'active'))
    or auth.uid() = user_id
    or exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true)
  );

-- Create: any ACTIVE member (free included — drives the feed; only Wins stay paid).
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

-- Bump last_activity_at when a win is linked to a journey (keeps "Currently building" live).
create or replace function bump_journey_activity()
returns trigger language plpgsql security definer as $$
begin
  if new.journey_id is not null then
    update journeys set last_activity_at = now(), updated_at = now()
    where id = new.journey_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_bump_journey_activity on wins;
create trigger trg_bump_journey_activity
  after insert or update of journey_id on wins
  for each row execute function bump_journey_activity();

-- Feed read: one round-trip, joins author + recent-win count. Mirrors get_inbox().
create or replace function get_journeys_feed(
  p_limit int default 25,
  p_offset int default 0,
  p_category journey_category default null
) returns table (
  id uuid, emoji text, title text, category journey_category,
  why text, stage journey_stage, status text, last_activity_at timestamptz,
  user_id uuid, username text, avatar_url text, founder_number int,
  recent_win_count bigint
) language sql security definer as $$
  select j.id, j.emoji, j.title, j.category, j.why, j.stage, j.status,
         j.last_activity_at,
         u.id, u.username, u.avatar_url, u.founder_number,
         (select count(*) from wins w where w.journey_id = j.id) as recent_win_count
  from journeys j
  join users u on u.id = j.user_id
  where j.status = 'active'
    and (p_category is null or j.category = p_category)
  order by j.last_activity_at desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;
```

---

## 3. Backend architecture

Follow the app's split: **RLS-enforced direct Supabase** for CRUD/reads (like wins,
builds, archive_lesson_progress); **route handlers only** for privileged/external
side-effects (push, mux, billing). Journeys needs **no new route handler** for MVP.

- **Reads** — server component (`archive/page.tsx`) decides the tab, calls
  `supabase.rpc("get_journeys_feed", …)` (anon key, SECURITY DEFINER does the joins).
  Detail page reads one `journeys` row + its linked `wins`.
- **Writes** — client modal calls `supabase.from("journeys").insert/update/delete`;
  RLS guarantees ownership. No service-role needed.
- **Win linkage** — `PostWinModal` adds an optional "Part of a journey?" select that
  sets `wins.journey_id`; the DB trigger bumps `last_activity_at`.
- **Connect** — reuse the existing DM-request action; no new infra.
- **Push (optional, V2)** — when someone connects/follows, reuse `sendPushToUsers`.

---

## 4. API (logical operations)

Real "API" here is the Supabase data contract, not REST. Operations:

| Operation | Call | Auth |
|---|---|---|
| List feed | `rpc('get_journeys_feed', {p_limit, p_offset, p_category})` | active member (RLS) |
| Get one | `from('journeys').select(...).eq('id', id).single()` + linked wins | active member |
| Create | `from('journeys').insert({...}).select().single()` | own + active |
| Update / change stage / pause | `from('journeys').update({...}).eq('id', id)` | owner |
| Archive / delete | `update({status:'archived'})` or `.delete()` | owner |
| Link win | `from('wins').insert/update({journey_id})` | win owner (paid) |
| Connect | existing DM-request mutation | active member |
| Admin moderate | `update`/`delete` under admin RLS, or `/archive/admin` tab | admin |

If you prefer route handlers for parity with `announcements`, add
`app/api/journeys/route.ts` (POST create) with the same `getUser` → `is_admin`/owner
re-check pattern — optional, not required.

---

## 5. Mobile UI (see wireframe in chat)

- **Feed card:** emoji tile · title (15px/500) · `@author · Category` · stage pill ·
  one-line `why` (serif italic — the human hook) · "N recent wins" meta. `st-card`,
  0.5px border, tap → detail. Author tap → `openUserProfile`.
- **Detail:** big emoji + title, category + stage chips, author + `FounderMark`,
  "Why this matters" (serif), "Current challenge", "Recent wins" (auto-pulled rows),
  `[Connect]` (accent) + `[Follow]`. Owner: Edit / Update stage / Archive.
- **Create/edit modal:** emoji picker → title → category → stage → why → challenge →
  connect toggle. Mirrors `PostWinModal`.
- **Tabs:** segmented control at top of Archive; Journeys default, Courses second.
- Respects `BottomNav`, dark/light theme tokens, `<420px` compact rules.

---

## 6. Onboarding

1. **Inline first-run** — Journeys tab with no journey of your own shows a soft prompt
   card: *"What are you building? Share your journey →"* (one tap to the modal).
2. **WelcomeFlow step (optional)** — add a `journey` step after `notify`, pre-filling
   category from the user's onboarding `goals[]`/`role[]`. Skippable.
3. **Activation checklist item** — add `share_journey` to `get_activation_checklist()`
   (derived live: `exists journey for user`). Reuses the existing checklist surface.
4. **Win → Journey nudge** — after posting a Win with no journey, offer to start one.

---

## 7. Wins integration

- `wins.journey_id` (nullable FK) is the single link. Posting a Win optionally attaches
  it to one of your journeys.
- Journey detail's "Recent wins" = `wins where journey_id = this order by created_at desc limit 5`.
- DB trigger bumps `journeys.last_activity_at` on link → journey rises in "Currently
  building", so **posting wins keeps your journey alive in the feed** (the core loop).
- Backward compatible: existing wins have `journey_id = null`, unaffected.

---

## 8. Future expansion

- **Follow** a journey → push notification on new linked win or stage change (infra
  already exists: `follower_count` column reserved, `sendPushToUsers`).
- **Journey updates / timeline** — short text posts on a journey (own micro-feed).
- **Milestones** — checklist within a journey ("Ship MVP", "First paying user").
- **Reactions** on journeys (reuse `toggle_reaction` pattern).
- **Compete tie-in** — challenges scoped to a journey category.
- **Archive synthesis** — surface "Journeys like yours" + relevant courses once the
  course library fills (the two tabs cross-pollinate).
- **Discovery surfaces** — "Journey of the week" in Home; weekly digest push.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Becomes a stale directory (created once, abandoned) | sort by `last_activity_at`; wins bump it; "Currently building" leads; surface only active |
| Empty feed at launch (cold start) | admin seeds 8–12 founder journeys; founders are highly engaged; WelcomeFlow + checklist drive creation |
| Feels like LinkedIn / résumés | no titles/companies/skills fields; "why this matters" is the required emotional core; serif/italic voice; emoji-led |
| Spam / low-effort cards | soft cap (≤3 active/user) in UI; char limits; admin RLS + `/archive/admin` moderation; report → DM-request infra |
| Privacy (sharing ambitions publicly) | members-only (active RLS); `is_open_to_connect` toggle; `paused`/`archived` statuses; no journey is public to the web |
| Free-tier abuse (create open to free) | active-status gate; rate-limit creates; only Wins stay paid |
| Discovery noise from filters | chips are *soft* (one optional category), never a search bar |

---

## 10. MVP (≤ 1 week)

**In:** one `journeys` table + `wins.journey_id` + `get_journeys_feed` RPC; Archive
tab switch (Journeys default); feed (cards, infinite scroll, optional category chips);
detail page; create/edit modal; Connect via existing DM; admin seeds founder journeys.

**Cut to V2:** follow/notify, journey updates/timeline, milestones, reactions, weekly
digest, Compete tie-in.

### Build order
1. **DB** — write & apply `supabase/journeys.sql` (table, enums, `wins.journey_id`,
   RLS, trigger, RPC). *(Manual apply, like the other pending migrations.)*
2. **Types** — add `Journey`, `JourneyCategory`, `JourneyStage`, `journey_id?` on `Win`.
3. **Feed** — `components/stations/JourneysFeed.tsx` (clone `WinsFeed`) + `JourneyCard.tsx`.
4. **Archive tab** — segmented control in `archive/page.tsx`; Journeys default, Courses = existing `ArchiveCatalog`.
5. **Detail** — `app/(platform)/archive/journeys/[id]/page.tsx` (server read + linked wins) + `JourneyDetail.tsx`.
6. **Create/edit** — `JourneyModal.tsx` (clone `PostWinModal`); empty-state prompt + Connect button.
7. **Wins link** — optional journey `<select>` in `PostWinModal`.
8. **Seed** — admin creates 8–12 founder journeys; QA RLS (free can create, can't post wins).

### Estimate
DB+types ~0.5d · feed+card ~1.5d · detail ~1d · create/edit+empty states ~1d ·
tab switch+wins link ~0.5d · seed/QA/polish ~1d → **~5–6 days**.

> **Migration note:** like `activation_checklist.sql` / `challenges_engine.sql` /
> `announcements.sql`, `journeys.sql` must be applied manually in the Supabase SQL
> editor before deploy. Until then the Journeys tab degrades quietly (empty feed).
