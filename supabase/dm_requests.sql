-- ============================================================
-- STATIONS — DM Requests (accept-before-message gate)
-- Run once in the Supabase SQL editor, AFTER direct_messages.sql and inbox.sql.
--
-- Before this, anyone could open a conversation and message any member they
-- found by username. Now a conversation starts as a PENDING request from the
-- initiator; the other person must accept before EITHER party can send a
-- message. Accountability partners (supabase/partnerships.sql) skip the gate —
-- being partners is itself the acceptance, so they DM each other directly.
--
-- The gate is enforced at the DATABASE: the direct_messages INSERT policy
-- requires the parent conversation to be 'accepted'. The UI is secondary.
-- ============================================================

-- ------------------------------------------------------------
-- Conversation lifecycle columns.
-- status: existing rows default to 'accepted' so live conversations keep
--   working; new requests are created 'pending' by get_or_create_conversation.
-- requested_by: who initiated the request (the participant who must be accepted).
-- ------------------------------------------------------------
alter table public.conversations
  add column if not exists status text not null default 'accepted'
    check (status in ('pending', 'accepted', 'declined'));

alter table public.conversations
  add column if not exists requested_by uuid references public.users(id) on delete set null;

-- Fast "my pending requests" lookups (incoming + outgoing). RLS still scopes
-- rows to the caller's own conversations.
create index if not exists conversations_status_idx
  on public.conversations (status);

-- ------------------------------------------------------------
-- direct_messages INSERT — now also requires an ACCEPTED conversation.
-- This is the real guarantee: a request can't carry messages until accepted.
-- ------------------------------------------------------------
drop policy if exists "participants send dms" on public.direct_messages;
create policy "participants send dms" on public.direct_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.status = 'accepted'
        and (auth.uid() = c.user_low or auth.uid() = c.user_high)
    )
  );

-- ------------------------------------------------------------
-- conversations UPDATE — only the RECIPIENT of a pending request may respond
-- (accept/decline). The recipient is the participant who is NOT requested_by.
-- with check keeps them a participant and stops them reassigning requested_by
-- to themselves.
-- ------------------------------------------------------------
drop policy if exists "recipient responds to dm request" on public.conversations;
create policy "recipient responds to dm request" on public.conversations
  for update
  using (
    auth.uid() in (user_low, user_high)
    and requested_by is not null
    and auth.uid() <> requested_by
  )
  with check (
    auth.uid() in (user_low, user_high)
    and auth.uid() <> requested_by
  );

-- ------------------------------------------------------------
-- get_or_create_conversation(other_user) — now returns the conversation id AND
-- its status, and applies the request rules:
--   • no row yet           → create ('accepted' if already partners, else 'pending')
--   • accepted             → return as-is
--   • pending, I requested → idempotent (still my outgoing request)
--   • pending, they did    → I'm reaching back, so accept it
--   • declined             → re-open as a fresh request from me (accepted if partners)
-- Return type changed (uuid → table), so the old signature is dropped first.
-- ------------------------------------------------------------
drop function if exists public.get_or_create_conversation(uuid);
create function public.get_or_create_conversation(other_user uuid)
returns table (conversation_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  me           uuid := auth.uid();
  lo           uuid;
  hi           uuid;
  are_partners boolean;
  rec          record;
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

  -- Already accountability partners? Then the DM is allowed straight away.
  are_partners := exists (
    select 1 from public.partnerships p
    where p.status = 'accepted'
      and least(p.requester_id, p.addressee_id) = lo
      and greatest(p.requester_id, p.addressee_id) = hi
  );

  select c.id, c.status, c.requested_by
    into rec
    from public.conversations c
   where c.user_low = lo and c.user_high = hi;

  if rec.id is null then
    insert into public.conversations (user_low, user_high, status, requested_by)
      values (lo, hi, case when are_partners then 'accepted' else 'pending' end, me)
      on conflict (user_low, user_high) do nothing;
    select c.id, c.status, c.requested_by
      into rec
      from public.conversations c
     where c.user_low = lo and c.user_high = hi;
  elsif rec.status = 'pending' then
    -- The other person already asked me (or we're partners now): accept it.
    if rec.requested_by <> me or are_partners then
      update public.conversations set status = 'accepted' where id = rec.id;
      rec.status := 'accepted';
    end if;
  elsif rec.status = 'declined' then
    -- A declined pair can be re-opened with a fresh request from me.
    update public.conversations
       set status       = case when are_partners then 'accepted' else 'pending' end,
           requested_by = me
     where id = rec.id;
    rec.status := case when are_partners then 'accepted' else 'pending' end;
  end if;

  conversation_id := rec.id;
  status          := rec.status;
  return next;
end $$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- ------------------------------------------------------------
-- get_inbox() — only ACCEPTED conversations belong in the inbox list; pending
-- requests surface separately (incoming under "Requests", outgoing as a
-- "Requested" state in search). Re-declared here with the status filter.
-- ------------------------------------------------------------
create or replace function public.get_inbox()
returns table (
  id               uuid,
  last_message_at  timestamptz,
  other_id         uuid,
  other_username   text,
  other_avatar_url text,
  other_founder_number integer,
  last_message     text,
  last_sender_id   uuid,
  last_read_at     timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.last_message_at,
    case when c.user_low = auth.uid() then c.user_high else c.user_low end,
    u.username,
    u.avatar_url,
    u.founder_number,
    lm.content,
    lm.sender_id,
    lm.read_at
  from public.conversations c
  left join public.users u
    on u.id = case when c.user_low = auth.uid() then c.user_high else c.user_low end
  left join lateral (
    select m.content, m.sender_id, m.read_at
    from public.direct_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where auth.uid() in (c.user_low, c.user_high)
    and c.status = 'accepted'
  order by c.last_message_at desc
$$;

grant execute on function public.get_inbox() to authenticated;
