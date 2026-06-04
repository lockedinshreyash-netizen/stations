import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WinDetail from "@/components/stations/WinDetail";
import type { ReactionType } from "@/types";

export default async function WinDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: win } = await supabase
    .from("wins")
    .select("*, users(username, avatar_url)")
    .eq("id", id)
    .single();

  if (!win) notFound();

  // Fetch current user's reactions for this win
  const { data: reactions } = await supabase
    .from("win_reactions")
    .select("reaction_type")
    .eq("win_id", id)
    .eq("user_id", authUser.id);

  const userReactions = new Set<ReactionType>(
    (reactions ?? []).map((r: { reaction_type: string }) => r.reaction_type as ReactionType)
  );

  return (
    <div className="px-5 md:px-10 py-12 max-w-2xl">
      <WinDetail
        win={win}
        currentUserId={authUser.id}
        initialUserReactions={Array.from(userReactions)}
      />
    </div>
  );
}
