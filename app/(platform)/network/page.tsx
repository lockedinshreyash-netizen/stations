import { redirect } from "next/navigation";
import StationHeader from "@/components/layout/StationHeader";
import NetworkRooms from "@/components/stations/NetworkRooms";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/types";

export default async function NetworkPage() {
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

  return (
    <div>
      <StationHeader
        number="02"
        name="NETWORK"
        tagline="Meet ambitious people working toward meaningful goals."
      />
      <NetworkRooms user={profile as User} />
    </div>
  );
}
