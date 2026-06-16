import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StationHeader from "@/components/layout/StationHeader";
import CompeteStation from "@/components/compete/CompeteStation";
import type { Challenge, User } from "@/types";

export default async function CompetePage() {
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
  const user = profile as User;

  // Refresh the viewer's own standings so their numbers are current on load
  // (the cron keeps everyone else fresh on a 15-min cadence).
  await supabase.rpc("refresh_challenge_progress");

  const { data: challengeRows } = await supabase
    .from("challenges")
    .select("*")
    .order("ends_at", { ascending: true });
  const challenges = (challengeRows as Challenge[]) ?? [];

  const { data: partRows } = await supabase
    .from("challenge_participants")
    .select("challenge_id, current_value, completed")
    .eq("user_id", user.id);
  const participation: Record<
    string,
    { current_value: number; completed: boolean }
  > = {};
  for (const p of (partRows as
    | { challenge_id: string; current_value: number; completed: boolean }[]
    | null) ?? []) {
    participation[p.challenge_id] = {
      current_value: p.current_value,
      completed: p.completed,
    };
  }

  return (
    <div>
      <StationHeader
        number="06"
        name="COMPETE"
        tagline="Challenges that turn ambition into receipts. Climb the board."
      />
      <CompeteStation
        challenges={challenges}
        participation={participation}
        userId={user.id}
        isAdmin={user.is_admin}
      />
    </div>
  );
}
