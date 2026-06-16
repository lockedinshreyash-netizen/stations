import { notFound, redirect } from "next/navigation";
import SessionRoom from "@/components/stations/SessionRoom";
import { type SessionMemberRow } from "@/components/stations/SessionMemberList";
import { createClient } from "@/lib/supabase/server";
import type { User, WorkSession, WorkSessionWithMeta } from "@/types";

const SESSION_SELECT =
  "*, host:users!work_sessions_host_id_fkey(username, avatar_url, founder_number), members:work_session_members(count)";
const MEMBER_SELECT =
  "*, user:users!work_session_members_user_id_fkey(username, avatar_url, founder_number)";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

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
  if (!profile) redirect("/onboarding/complete");

  const { data: row } = await supabase
    .from("work_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .maybeSingle();
  if (!row) notFound();

  type Row = WorkSession & {
    host: {
      username: string;
      avatar_url: string | null;
      founder_number: number | null;
    } | null;
    members: { count: number }[] | null;
  };
  const r = row as Row;
  const { host, members, ...rest } = r;
  const session: WorkSessionWithMeta = {
    ...(rest as WorkSession),
    member_count: members?.[0]?.count ?? 0,
    host_username: host?.username ?? "unknown",
    host_avatar_url: host?.avatar_url ?? null,
    host_founder_number: host?.founder_number ?? null,
  };

  const { data: memberRows } = await supabase
    .from("work_session_members")
    .select(MEMBER_SELECT)
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  const initialMembers: SessionMemberRow[] = (
    (memberRows as (SessionMemberRow & {
      user: {
        username: string;
        avatar_url: string | null;
        founder_number: number | null;
      } | null;
    })[]) ?? []
  ).map((m) => ({
    ...m,
    username: m.user?.username ?? "unknown",
    avatar_url: m.user?.avatar_url ?? null,
    founder_number: m.user?.founder_number ?? null,
  }));

  return (
    <SessionRoom
      user={profile as User}
      initialSession={session}
      initialMembers={initialMembers}
    />
  );
}
