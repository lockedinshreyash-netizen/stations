import { redirect } from "next/navigation";
import StationHeader from "@/components/layout/StationHeader";
import MessagesInbox from "@/components/stations/MessagesInbox";
import { createClient } from "@/lib/supabase/server";
import type { ConversationSummary, DmParticipant, User } from "@/types";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();
  if (!profile) redirect("/onboarding/step-2");

  const selfId = authUser.id;

  // Conversations the caller participates in (RLS limits this to their own).
  const { data: convos } = await supabase
    .from("conversations")
    .select("id, user_low, user_high, last_message_at")
    .order("last_message_at", { ascending: false });

  const rows =
    (convos as {
      id: string;
      user_low: string;
      user_high: string;
      last_message_at: string;
    }[]) ?? [];

  let initialConversations: ConversationSummary[] = [];
  if (rows.length > 0) {
    const otherIds = rows.map((c) => (c.user_low === selfId ? c.user_high : c.user_low));
    const { data: people } = await supabase
      .from("users")
      .select("id, username, avatar_url, founder_number")
      .in("id", otherIds);
    const byId = new Map(((people as DmParticipant[]) ?? []).map((p) => [p.id, p]));

    initialConversations = await Promise.all(
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
          unread: !!lastMsg && lastMsg.sender_id !== selfId && lastMsg.read_at === null,
        };
      })
    );
  }

  return (
    <div>
      <StationHeader
        number="05"
        name="MESSAGES"
        tagline="Private, one-to-one. Only you and them."
      />
      <MessagesInbox user={profile as User} initialConversations={initialConversations} />
    </div>
  );
}
