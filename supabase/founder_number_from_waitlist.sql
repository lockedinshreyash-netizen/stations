-- ============================================================
-- STATIONS — Founder number = waitlist position
-- Run once in the Supabase SQL editor (replaces the sequence-based
-- numbering from founding_cohort.sql).
--
-- BEFORE: claim_founder_code() pulled the founding number from a sequence at
-- the moment the user redeemed the code in the app. That meant the number
-- depended on app-login order (and the sequence burned numbers on failed
-- claims), so it never matched the "You're #X of 100" spot the landing page
-- showed when the code was issued.
--
-- AFTER: the founding number is the code's POSITION in the waitlist —
-- i.e. how many people had joined up to and including that signup, ordered by
-- created_at (id as a tie-break). That is exactly the number the landing page
-- displayed at signup, it is permanent, and it is the same no matter when the
-- member finally logs in to the app.
-- ============================================================

create or replace function public.claim_founder_code(code text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  claimed_at timestamptz;
  claimed_id uuid;
  num        int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Race-proof redemption: exactly one caller can flip redeemed for a code.
  update public.waitlist
     set redeemed = true, redeemed_at = now()
   where founder_code = upper(trim(code)) and redeemed = false
   returning created_at, id into claimed_at, claimed_id;
  if not found then
    return null;                       -- invalid or already claimed
  end if;

  -- The founding number is the row's signup position: rows are never deleted,
  -- so this matches the count the landing page showed at signup time.
  select count(*)::int into num
    from public.waitlist w
   where (w.created_at, w.id) <= (claimed_at, claimed_id);

  update public.users
     set membership_tier  = 'founding',
         founder_number   = num,
         room_memberships = array_append(
           array_remove(room_memberships, 'founding'), 'founding'
         )
   where id = uid;

  return num;
end $$;

-- The sequence is no longer used by anything.
drop sequence if exists public.founder_number_seq;

-- Re-assert least privilege (create or replace keeps the old ACL, but be
-- explicit so this file is safe to run standalone).
revoke all on function public.claim_founder_code(text) from public;
revoke all on function public.claim_founder_code(text) from anon;
grant execute on function public.claim_founder_code(text) to authenticated;
