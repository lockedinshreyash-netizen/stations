import { redirect } from "next/navigation";
import StationHeader from "@/components/layout/StationHeader";
import MessagesInbox from "@/components/stations/MessagesInbox";
import { createClient } from "@/lib/supabase/server";
import { mapInboxRows, type InboxRow } from "@/lib/dm/inbox";
import type { ConversationSummary, User } from "@/types";

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

  // One RPC returns every conversation with peer + last message (no N+1);
  // RLS inside get_inbox limits this to the caller's own conversations.
  const { data: inbox } = await supabase.rpc("get_inbox");
  const initialConversations: ConversationSummary[] = mapInboxRows(
    (inbox as InboxRow[]) ?? [],
    selfId
  );

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
