import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StationHeader from "@/components/layout/StationHeader";
import WinsFeed from "@/components/stations/WinsFeed";
import type { User } from "@/types";

export default async function WinsPage() {
  const supabase = await createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, membership_tier, status")
    .eq("id", authUser.id)
    .single();

  if (!profile) redirect("/onboarding/step-2");

  const user = profile as Pick<User, "id" | "membership_tier" | "status">;
  const canPost = user.membership_tier === "paid" || user.membership_tier === "founding";

  return (
    <div>
      <StationHeader
        number="01"
        name="WINS"
        tagline="See what members are building. Progress made visible."
      />
      <WinsFeed currentUserId={user.id} canPost={canPost} />
    </div>
  );
}
