import { redirect } from "next/navigation";
import StationHeader from "@/components/layout/StationHeader";
import WorkStation from "@/components/stations/WorkStation";
import { createClient } from "@/lib/supabase/server";
import type { User, WorkSession, WorkSessionWithMeta } from "@/types";

const SESSION_SELECT =
  "*, host:users!work_sessions_host_id_fkey(username, avatar_url, founder_number), members:work_session_members(count)";

export default async function WorkPage() {
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

  const [{ data: rows }, { data: memberships }] = await Promise.all([
    supabase
      .from("work_sessions")
      .select(SESSION_SELECT)
      .in("status", ["active", "scheduled"])
      .order("scheduled_start_time", { ascending: true })
      .limit(50),
    supabase
      .from("work_session_members")
      .select("session_id")
      .eq("user_id", authUser.id),
  ]);

  type Row = WorkSession & {
    host: {
      username: string;
      avatar_url: string | null;
      founder_number: number | null;
    } | null;
    members: { count: number }[] | null;
  };
  const initialSessions: WorkSessionWithMeta[] = ((rows as Row[]) ?? []).map(
    ({ host, members, ...rest }) => ({
      ...(rest as WorkSession),
      member_count: members?.[0]?.count ?? 0,
      host_username: host?.username ?? "unknown",
      host_avatar_url: host?.avatar_url ?? null,
      host_founder_number: host?.founder_number ?? null,
    })
  );

  const initialMemberIds = ((memberships as { session_id: string }[]) ?? []).map(
    (m) => m.session_id
  );

  return (
    <div>
      <StationHeader
        number="04"
        name="WORK"
        tagline="Focus together. Build accountability."
      />
      <WorkStation
        user={profile as User}
        initialSessions={initialSessions}
        initialMemberIds={initialMemberIds}
      />
    </div>
  );
}
