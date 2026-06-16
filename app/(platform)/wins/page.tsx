import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StationHeader from "@/components/layout/StationHeader";
import WinsFeed from "@/components/stations/WinsFeed";

export default async function WinsPage() {
  const supabase = await createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", authUser.id)
    .single();

  if (!profile) redirect("/onboarding/complete");

  return (
    <div>
      <StationHeader
        number="01"
        name="WINS"
        tagline="See what members are building. Progress made visible."
      />
      <WinsFeed currentUserId={profile.id} />
    </div>
  );
}
