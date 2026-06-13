"use client";

import { createClient } from "@/lib/supabase/client";
import { mapInboxRows, type InboxRow } from "@/lib/dm/inbox";
import type {
  ConversationStatus,
  ConversationSummary,
  DirectMessage,
  DmParticipant,
  DmRequest,
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

/**
 * Start or resume a conversation with another user. Returns the conversation id
 * and its status: a brand-new conversation with a non-partner comes back
 * `pending` (a DM request the other person must accept before messages can be
 * sent); partners — or a request you're reciprocating — come back `accepted`.
 */
export async function startConversation(
  otherUserId: string
): Promise<{ conversationId: string; status: ConversationStatus }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    other_user: otherUserId,
  });
  if (error) throw new Error(error.message);
  // The RPC returns a single-row table, surfaced by supabase-js as an array.
  const row = (Array.isArray(data) ? data[0] : data) as
    | { conversation_id: string; status: ConversationStatus }
    | undefined;
  if (!row?.conversation_id) throw new Error("Couldn't open that conversation.");
  return { conversationId: row.conversation_id, status: row.status };
}

/**
 * Pending DM requests addressed TO the caller (members who want to message
 * them), newest first. RLS limits rows to the caller's own conversations, so a
 * pending row whose `requested_by` is not the caller is an incoming request.
 */
export async function listIncomingDmRequests(
  selfId: string
): Promise<DmRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, requested_by, created_at")
    .eq("status", "pending")
    .neq("requested_by", selfId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows =
    (data as { id: string; requested_by: string | null; created_at: string }[]) ?? [];
  const requesterIds = rows
    .map((r) => r.requested_by)
    .filter((id): id is string => !!id);
  if (requesterIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("users")
    .select("id, username, avatar_url, founder_number")
    .in("id", [...new Set(requesterIds)]);
  const byId = new Map(
    ((profiles as DmParticipant[]) ?? []).map((p) => [p.id, p])
  );

  return rows
    .filter((r) => r.requested_by)
    .map((r) => ({
      conversation_id: r.id,
      from:
        byId.get(r.requested_by!) ??
        { id: r.requested_by!, username: "member", avatar_url: null, founder_number: null },
      created_at: r.created_at,
    }));
}

/** Other-user ids the caller has an outstanding (pending) outgoing DM request to. */
export async function listOutgoingDmRequestIds(
  selfId: string
): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("user_low, user_high")
    .eq("status", "pending")
    .eq("requested_by", selfId);
  if (error) throw new Error(error.message);
  const rows = (data as { user_low: string; user_high: string }[]) ?? [];
  return new Set(
    rows.map((r) => (r.user_low === selfId ? r.user_high : r.user_low))
  );
}

/** Accept or decline an incoming DM request. RLS allows only the recipient. */
export async function respondToDmRequest(
  conversationId: string,
  accept: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("conversations")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", conversationId);
  if (error) throw new Error(error.message);
}

/**
 * The caller's inbox: every conversation they're in, newest first, with the
 * other participant, a last-message preview, and an unread flag.
 */
export async function getConversations(
  selfId: string
): Promise<ConversationSummary[]> {
  const supabase = createClient();
  // One RPC returns conversations + peer + last message (no per-row queries).
  const { data, error } = await supabase.rpc("get_inbox");
  if (error) throw new Error(error.message);
  return mapInboxRows((data as InboxRow[]) ?? [], selfId);
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

/** Page size for DM history (latest page loads first, older pages on demand). */
export const DM_PAGE_SIZE = 50;

/**
 * A page of messages in a conversation, oldest first. Without `before`,
 * returns the latest page; pass the oldest loaded created_at to page back.
 * RLS blocks non-participants.
 */
export async function getMessages(
  conversationId: string,
  before?: string
): Promise<DirectMessage[]> {
  const supabase = createClient();
  let query = supabase
    .from("direct_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(DM_PAGE_SIZE);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data as DirectMessage[]) ?? []).reverse();
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
