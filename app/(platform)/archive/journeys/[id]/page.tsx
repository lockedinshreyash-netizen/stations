import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JourneyDetail from "@/components/stations/JourneyDetail";
import type { JourneyWithAuthor } from "@/types";

export default async function JourneyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: journey } = await supabase
    .from("journeys")
    .select("*, users(username, avatar_url, founder_number)")
    .eq("id", id)
    .single();

  if (!journey) notFound();

  // Wins linked to this journey (RLS lets active members read them).
  const { data: winRows } = await supabase
    .from("wins")
    .select("id, title, category, created_at")
    .eq("journey_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="px-5 md:px-10 py-12 max-w-2xl">
      <JourneyDetail
        journey={journey as unknown as JourneyWithAuthor}
        recentWins={winRows ?? []}
        currentUserId={authUser.id}
      />
    </div>
  );
}
