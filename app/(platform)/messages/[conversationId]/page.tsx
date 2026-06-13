import { notFound, redirect } from "next/navigation";
import DmThread from "@/components/stations/DmThread";
import { createClient } from "@/lib/supabase/server";
import type {
  ConversationStatus,
  DirectMessage,
  DmParticipant,
  User,
} from "@/types";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

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

  // RLS returns the conversation only if the caller is a participant; anyone
  // else gets null here and is sent to a 404 — they can't reach the thread.
  const { data: convo } = await supabase
    .from("conversations")
    .select("user_low, user_high, status, requested_by")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) notFound();

  const c = convo as {
    user_low: string;
    user_high: string;
    status: ConversationStatus;
    requested_by: string | null;
  };
  const otherId = c.user_low === authUser.id ? c.user_high : c.user_low;

  const { data: peer } = await supabase
    .from("users")
    .select("id, username, avatar_url, founder_number")
    .eq("id", otherId)
    .maybeSingle();
  if (!peer) notFound();

  // Latest page only (oldest first after reversing); DmThread pages back
  // through earlier history on demand.
  const { data: messages } = await supabase
    .from("direct_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(50);
  const initialMessages = ((messages as DirectMessage[]) ?? []).slice().reverse();

  return (
    <DmThread
      user={profile as User}
      conversationId={conversationId}
      peer={peer as DmParticipant}
      initialMessages={initialMessages}
      initialStatus={c.status}
      viewerIsRequester={c.requested_by === authUser.id}
    />
  );
}
