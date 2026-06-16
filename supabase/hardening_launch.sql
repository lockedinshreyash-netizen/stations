-- ============================================================
-- STATIONS — LAUNCH HARDENING (app side)
-- Run this in the Supabase SQL editor AFTER supabase/founding_cohort.sql.
-- Idempotent: safe to run more than once.
--
-- Covers:
--   TASK 1 — least-privilege grants on the founder-code RPCs
--   TASK 2 — DB safety net for the Founding 100 gate
-- ============================================================


-- ------------------------------------------------------------
-- TASK 1 — FOUNDER CODE RPC LEAST PRIVILEGE
--
-- Every function is granted to the implicit PUBLIC role on creation. Strip
-- that and grant only the role each function is meant for.
--
--   claim_founder_code(text)      — mutates: consumes a waitlist code + upgrades
--                                   the CALLER's own user row. Auth required
--                                   (raises 'not authenticated' otherwise), so
--                                   restrict to the `authenticated` role.
--   founder_code_available(text)  — read-only existence check for live UX.
--                                   anon needs it on the onboarding step; it is
--                                   SELECT-only and can mutate nothing.
-- ------------------------------------------------------------
revoke all on function public.claim_founder_code(text) from public;
revoke all on function public.claim_founder_code(text) from anon;
grant execute on function public.claim_founder_code(text) to authenticated;

revoke all on function public.founder_code_available(text) from public;
grant execute on function public.founder_code_available(text) to anon, authenticated;


-- ------------------------------------------------------------
-- TASK 2 — FOUNDING 100 GATE (DB safety net)
--
-- The gate is enforced at three layers (UI, server layout, DB). This is the
-- database backstop. membership_tier='founding' + founder_number ARE the gate;
-- they must only ever be set by the atomic claim path, never by a client.
--
-- claim_founder_code() is SECURITY DEFINER (runs as the table owner, bypassing
-- RLS *and* column privileges), so it can still set these columns. But the
-- existing "Users can update own profile" policy (USING auth.uid() = id, no
-- WITH CHECK) otherwise lets a logged-in user PATCH their OWN row to
-- membership_tier='founding' / founder_number=N via the REST API and walk
-- straight through the gate.
--
-- Fix with column-level privileges: the `authenticated` and `anon` roles lose
-- the right to BOTH insert and update these two columns. After this, the only
-- code path that can set membership_tier='founding' / founder_number is
-- claim_founder_code() (SECURITY DEFINER, runs as owner → bypasses these
-- grants). This closes two bypasses at once:
--   • UPDATE: a logged-in user PATCHing their own row to 'founding'.
--   • INSERT: an attacker POSTing a brand-new users row with 'founding' set,
--     skipping onboarding entirely.
--
-- PostgreSQL only checks column privileges for columns NAMED in a statement, so
-- onboarding's INSERT (which now OMITS membership_tier — see CompleteProfile)
-- still succeeds and the column falls back to its default ('free'). All other
-- self-updates (bio, streak_days, total_focus_minutes, …) keep working. The
-- billing webhook writes membership_tier via the service-role client, which
-- bypasses column privileges, so paid upgrades still work.
-- ------------------------------------------------------------
revoke insert (membership_tier, founder_number) on public.users from anon;
revoke insert (membership_tier, founder_number) on public.users from authenticated;
revoke update (membership_tier, founder_number) on public.users from anon;
revoke update (membership_tier, founder_number) on public.users from authenticated;
