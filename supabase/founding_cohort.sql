-- ============================================================
-- STATIONS — Founding Cohort
-- Run once in the Supabase SQL editor.
--
-- Ties a landing-page founder code (public.waitlist.founder_code) to an app
-- account: grants the 'founding' membership tier (free premium forever — every
-- premium RLS policy already accepts 'founding'), assigns a permanent founding
-- number (#1, #2, …), and drops the member into the private Founding Cohort
-- room. Assumes the waitlist table from the landing page lives in THIS project.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Founding number — a monotonic counter + the column it lands in.
-- ------------------------------------------------------------
create sequence if not exists public.founder_number_seq;

alter table public.users
  add column if not exists founder_number int unique;

-- ------------------------------------------------------------
-- 2. claim_founder_code(code) — the atomic redemption.
--    Runs as the logged-in user (auth.uid()), so the client never needs a
--    service-role key. The user row must already exist (created at the final
--    onboarding step) before this is called.
--
--    Returns the assigned founding number on success, or NULL if the code is
--    invalid or already claimed. The `where redeemed = false` update is the
--    race-proof core: if two people submit the same code, exactly one wins.
-- ------------------------------------------------------------
create or replace function public.claim_founder_code(code text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  num int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  update public.waitlist
     set redeemed = true, redeemed_at = now()
   where founder_code = upper(trim(code)) and redeemed = false;
  if not found then
    return null;                       -- invalid or already claimed
  end if;

  num := nextval('public.founder_number_seq');

  update public.users
     set membership_tier = 'founding',
         founder_number   = num,
         -- Add the private cohort room (idempotent — no duplicate entry).
         room_memberships = array_append(
           array_remove(room_memberships, 'founding'), 'founding'
         )
   where id = uid;

  return num;
end $$;

grant execute on function public.claim_founder_code(text) to authenticated;

-- ------------------------------------------------------------
-- 3. founder_code_available(code) — read-only check for live UX feedback
--    on the founder-code onboarding step. Does NOT claim the code.
-- ------------------------------------------------------------
create or replace function public.founder_code_available(code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.waitlist
     where founder_code = upper(trim(code)) and redeemed = false
  );
$$;

grant execute on function public.founder_code_available(text) to anon, authenticated;
