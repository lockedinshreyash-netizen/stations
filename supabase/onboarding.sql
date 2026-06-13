-- ============================================================
-- STATIONS — First-run experience flag
-- Run once in the Supabase SQL editor.
--
-- `first_run_completed_at` gates the one-time welcome flow
-- (/onboarding/welcome): set your 3 things + introduce yourself in your room.
-- The (platform) layout redirects founding/admin members with a NULL value
-- into that flow; the flow stamps now() on finish so it never replays.
--
-- Existing members are backfilled to now() so the live cohort is NOT pushed
-- back through onboarding. Only accounts created after this migration start
-- NULL and therefore see the welcome flow.
-- ============================================================

alter table public.users
  add column if not exists first_run_completed_at timestamptz;

-- Don't disrupt anyone already inside the platform.
update public.users
  set first_run_completed_at = now()
  where first_run_completed_at is null;

-- The existing owner-update RLS policy on public.users already lets a member
-- stamp their own row (same policy CompleteProfile uses) — no new policy needed.
