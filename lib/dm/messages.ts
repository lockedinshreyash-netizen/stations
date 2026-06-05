"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  ConversationSummary,
  DirectMessage,
  DmParticipant,
} from "@/types";

/**
 * Search active members by username (for starting a DM). Excludes the caller.
 * RLS already limits visibility to active members.
 */
export async function searchUsers(
  query: string,
  selfId: string
): Promise<DmParticipant[]> {
  const q = query.trim();
  if (!q) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, avatar_url, founder_number")
    .ilike("username", `%${q}%`)
    .neq("id", selfId)
    .limit(10);
  if (error) throw new Error(error.message);
  return (data as DmParticipant[]) ?? [];
}

/** Start or resume a conversation with another user; returns its id. */
export async function startConversation(otherUserId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    other_user: otherUserId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * The caller's inbox: every conversation they're in, newest first, with the
 * other participant, a last-message preview, and an unread flag.
 */
export async function getConversations(
  selfId: string
): Promise<ConversationSummary[]> {
  const supabase = createClient();

  const { data: convos, error } = await supabase
    .from("conversations")
    .select("id, user_low, user_high, last_message_at")
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (convos as {
    id: string;
    user_low: string;
    user_high: string;
    last_message_at: string;
  }[]) ?? [];
  if (rows.length === 0) return [];

  // Fetch the other participants' profiles in one query.
  const otherIds = rows.map((c) => (c.user_low === selfId ? c.user_high : c.user_low));
  const { data: people } = await supabase
    .from("users")
    .select("id, username, avatar_url, founder_number")
    .in("id", otherIds);
  const byId = new Map(
    ((people as DmParticipant[]) ?? []).map((p) => [p.id, p])
  );

  // Last message + unread per conversation. (Small N: one light query each.)
  const summaries = await Promise.all(
    rows.map(async (c) => {
      const otherId = c.user_low === selfId ? c.user_high : c.user_low;
      const { data: last } = await supabase
        .from("direct_messages")
        .select("content, sender_id, read_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastMsg = last as
        | { content: string; sender_id: string; read_at: string | null }
        | null;
      return {
        id: c.id,
        last_message_at: c.last_message_at,
        other:
          byId.get(otherId) ??
          { id: otherId, username: "member", avatar_url: null, founder_number: null },
        last_message: lastMsg?.content ?? null,
        // Unread = newest message was sent by the other person and not yet read.
        unread: !!lastMsg && lastMsg.sender_id !== selfId && lastMsg.read_at === null,
      } satisfies ConversationSummary;
    })
  );

  return summaries;
}

/** Confirm the caller is a participant and return the other person's profile. */
export async function getConversationPeer(
  conversationId: string,
  selfId: string
): Promise<DmParticipant | null> {
  const supabase = createClient();
  const { data: convo } = await supabase
    .from("conversations")
    .select("user_low, user_high")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return null;
  const c = convo as { user_low: string; user_high: string };
  const otherId = c.user_low === selfId ? c.user_high : c.user_low;
  const { data: peer } = await supabase
    .from("users")
    .select("id, username, avatar_url, founder_number")
    .eq("id", otherId)
    .maybeSingle();
  return (peer as DmParticipant) ?? null;
}

/** All messages in a conversation, oldest first. RLS blocks non-participants. */
export async function getMessages(
  conversationId: string
): Promise<DirectMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("direct_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as DirectMessage[]) ?? [];
}

/** Send a message. Returns the inserted row. */
export async function sendDirectMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<DirectMessage> {
  const trimmed = content.trim().slice(0, 2000);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, content: trimmed })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as DirectMessage;
}

/** Edit a message's text. RLS allows this only for the sender. */
export async function editDirectMessage(
  messageId: string,
  senderId: string,
  content: string
): Promise<DirectMessage> {
  const trimmed = content.trim().slice(0, 2000);
  if (!trimmed) throw new Error("Message can't be empty.");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("direct_messages")
    .update({ content: trimmed, edited_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("sender_id", senderId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as DirectMessage;
}

/** Delete a message. RLS allows this only for the sender. */
export async function deleteDirectMessage(
  messageId: string,
  senderId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("direct_messages")
    .delete()
    .eq("id", messageId)
    .eq("sender_id", senderId);
  if (error) throw new Error(error.message);
}

/** Mark every message the caller received in this conversation as read. */
export async function markConversationRead(
  conversationId: string,
  selfId: string
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", selfId)
    .is("read_at", null);
}
