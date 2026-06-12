-- ============================================================
-- STATIONS — Inbox performance
-- Run once in the Supabase SQL editor (after direct_messages.sql).
--
-- get_inbox() replaces the old client-side pattern of one
-- direct_messages query PER conversation (N+1) with a single query
-- that returns each conversation, the other participant, and the
-- latest message in one round trip.
-- ============================================================

-- ------------------------------------------------------------
-- Indexes for inbox ordering and the wins feed category filter.
-- ------------------------------------------------------------
create index if not exists idx_wins_category_created
  on public.wins (category, created_at desc);
create index if not exists idx_conversations_low_recent
  on public.conversations (user_low, last_message_at desc);
create index if not exists idx_conversations_high_recent
  on public.conversations (user_high, last_message_at desc);

-- ------------------------------------------------------------
-- get_inbox() — the caller's conversations, newest first, each with
-- the other participant's profile and the last message preview.
-- SECURITY INVOKER: RLS on conversations/direct_messages still applies,
-- so the caller only ever sees their own conversations.
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
  -- left join: if the peer's profile is hidden by users RLS the
  -- conversation still appears (client falls back to a placeholder).
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
  order by c.last_message_at desc
$$;

grant execute on function public.get_inbox() to authenticated;
