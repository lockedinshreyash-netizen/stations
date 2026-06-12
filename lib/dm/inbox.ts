import type { ConversationSummary } from "@/types";

/** Row shape returned by the get_inbox() SQL function (supabase/inbox.sql). */
export interface InboxRow {
  id: string;
  last_message_at: string;
  other_id: string;
  other_username: string | null;
  other_avatar_url: string | null;
  other_founder_number: number | null;
  last_message: string | null;
  last_sender_id: string | null;
  last_read_at: string | null;
}

export function mapInboxRows(rows: InboxRow[], selfId: string): ConversationSummary[] {
  return rows.map((r) => ({
    id: r.id,
    last_message_at: r.last_message_at,
    other: {
      id: r.other_id,
      username: r.other_username ?? "member",
      avatar_url: r.other_avatar_url,
      founder_number: r.other_founder_number,
    },
    last_message: r.last_message,
    // Unread = newest message was sent by the other person and not yet read.
    unread:
      r.last_message !== null &&
      r.last_sender_id !== selfId &&
      r.last_read_at === null,
  }));
}
