-- ============================================================
-- STATIONS — Direct Messages (private 1:1 DMs)
-- Run once in the Supabase SQL editor.
--
-- Privacy is enforced at the DATABASE with Row Level Security: a row is only
-- ever readable/writable by the two participants. Because Supabase Realtime
-- (postgres_changes) honors the SELECT policy, live events are likewise only
-- delivered to those two users. There is no client-trusted path — nobody else
-- can read a conversation or its messages, via the API or realtime.
--
-- NOTE: the accept-before-message gate lives in supabase/dm_requests.sql, which
-- MUST be run after this file (and inbox.sql). It adds conversations.status /
-- requested_by, tightens the send policy to require an 'accepted' conversation,
-- and changes get_or_create_conversation's return shape.
-- ============================================================

-- ------------------------------------------------------------
-- TABLES
-- A conversation is an unordered pair, stored canonically as
-- (user_low < user_high) so each pair has exactly one row.
-- ------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid primary key default uuid_generate_v4(),
  user_low        uuid not null references public.users(id) on delete cascade,
  user_high       uuid not null references public.users(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint conversations_ordered check (user_low < user_high),
  unique (user_low, user_high)
);

create table if not exists public.direct_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.users(id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 2000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  edited_at       timestamptz
);

-- Existing installs: add the edited_at marker if it isn't there yet.
alter table public.direct_messages
  add column if not exists edited_at timestamptz;

-- Send the full OLD row on UPDATE/DELETE so RLS can be evaluated for realtime
-- events (the policies reference conversation_id, not just the primary key) and
-- so the client can remove/replace the right message.
alter table public.direct_messages replica identity full;

create index if not exists direct_messages_conversation_idx
  on public.direct_messages (conversation_id, created_at);
create index if not exists conversations_user_low_idx  on public.conversations (user_low);
create index if not exists conversations_user_high_idx on public.conversations (user_high);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY — the privacy guarantee
-- ------------------------------------------------------------
alter table public.conversations   enable row level security;
alter table public.direct_messages enable row level security;

-- Conversations: visible ONLY to the two participants. No direct INSERT policy —
-- conversations are created through get_or_create_conversation() below.
drop policy if exists "participants read conversations" on public.conversations;
create policy "participants read conversations" on public.conversations
  for select using (auth.uid() = user_low or auth.uid() = user_high);

-- Helper kept SECURITY DEFINER-free: a plain predicate reused by the policies.
-- Messages: a participant of the parent conversation may read them.
drop policy if exists "participants read dms" on public.direct_messages;
create policy "participants read dms" on public.direct_messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_low or auth.uid() = c.user_high)
    )
  );

-- Only a participant may send, and only as themselves.
drop policy if exists "participants send dms" on public.direct_messages;
create policy "participants send dms" on public.direct_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_low or auth.uid() = c.user_high)
    )
  );

-- The recipient (not the sender) may mark messages read.
drop policy if exists "recipient marks read" on public.direct_messages;
create policy "recipient marks read" on public.direct_messages
  for update using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_low or auth.uid() = c.user_high)
    )
  );

-- The sender may edit their own message (content/edited_at). Separate UPDATE
-- policy from "recipient marks read"; RLS ORs permissive policies together.
drop policy if exists "sender edits own dm" on public.direct_messages;
create policy "sender edits own dm" on public.direct_messages
  for update using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

-- The sender may delete their own message.
drop policy if exists "sender deletes own dm" on public.direct_messages;
create policy "sender deletes own dm" on public.direct_messages
  for delete using (auth.uid() = sender_id);

-- ------------------------------------------------------------
-- get_or_create_conversation(other_user) — start (or resume) a DM.
-- Runs as definer so it can INSERT the conversation, but only ever for a pair
-- that includes the caller. Returns the conversation id.
-- ------------------------------------------------------------
create or replace function public.get_or_create_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me  uuid := auth.uid();
  lo  uuid;
  hi  uuid;
  cid uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if other_user = me then
    raise exception 'cannot start a conversation with yourself';
  end if;
  if not exists (select 1 from public.users where id = other_user) then
    raise exception 'no such user';
  end if;

  if me < other_user then lo := me; hi := other_user;
  else                    lo := other_user; hi := me;
  end if;

  insert into public.conversations (user_low, user_high)
    values (lo, hi)
    on conflict (user_low, user_high) do nothing;

  select id into cid
    from public.conversations
   where user_low = lo and user_high = hi;

  return cid;
end $$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- ------------------------------------------------------------
-- Keep conversations.last_message_at fresh for inbox ordering.
-- ------------------------------------------------------------
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists dm_touch_conversation on public.direct_messages;
create trigger dm_touch_conversation
  after insert on public.direct_messages
  for each row execute function public.touch_conversation();

-- ------------------------------------------------------------
-- REALTIME — deliver live inserts to the two participants (RLS-filtered).
-- ------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null;
end $$;
