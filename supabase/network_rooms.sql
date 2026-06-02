-- Network station — room membership.
-- Run once in the Supabase SQL editor.

-- 1. Column: which Firebase chat rooms a user belongs to.
--    "collective" is always present; their category room is added on signup.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS room_memberships text[] NOT NULL
  DEFAULT ARRAY['collective'];

-- 2. Backfill existing users: collective + their category room (Grinders get
--    only collective, since there is no Grinder room).
UPDATE users
SET room_memberships = (
  CASE
    WHEN lower(category) IN ('scholar', 'builder', 'creator', 'athlete')
      THEN ARRAY['collective', lower(category)]
    ELSE ARRAY['collective']
  END
)
WHERE room_memberships = ARRAY['collective']  -- only untouched defaults
   OR room_memberships IS NULL;

-- 3. RLS: users may read/update their own room_memberships.
--    (Assumes a SELECT/UPDATE policy on users already exists; this is a no-op
--     if your existing "users can update own row" policy already covers it.)
-- Example, only if you don't already have one:
-- CREATE POLICY "users update own row" ON users
--   FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
