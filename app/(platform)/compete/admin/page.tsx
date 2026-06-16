import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StationHeader from "@/components/layout/StationHeader";
import ChallengeAdminForm from "@/components/compete/ChallengeAdminForm";
import type { User } from "@/types";

export default async function CompeteAdminPage() {
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
  if (!(profile as User).is_admin) redirect("/compete");

  return (
    <div>
      <StationHeader
        number="06"
        name="NEW CHALLENGE"
        tagline="Set a goal, a metric, and a window. Members race it."
      />
      <ChallengeAdminForm userId={authUser.id} />
    </div>
  );
}
