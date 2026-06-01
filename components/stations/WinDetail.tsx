"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WinCardData } from "@/components/stations/WinCard";
import type { ReactionType, ReactionCounts } from "@/types";
import { REACTIONS, getCounts } from "@/lib/utils/reactions";
import { formatDistanceToNow } from "date-fns";

interface WinDetailProps {
  win: WinCardData;
  currentUserId: string;
  initialUserReactions: ReactionType[];
}

export default function WinDetail({ win, currentUserId, initialUserReactions }: WinDetailProps) {
  const [counts, setCounts] = useState<ReactionCounts>(getCounts(win.reaction_counts));
  const [myReactions, setMyReactions] = useState<Set<ReactionType>>(new Set(initialUserReactions));
  const [busy, setBusy] = useState<Set<ReactionType>>(new Set());

  const username = win.users?.username ?? "member";
  const timeAgo = formatDistanceToNow(new Date(win.created_at), { addSuffix: true });

  // Realtime subscription for reaction_counts updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`win-${win.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wins", filter: `id=eq.${win.id}` },
        (payload) => {
          const updated = payload.new as { reaction_counts: ReactionCounts | null };
          setCounts(getCounts(updated.reaction_counts));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [win.id]);

  async function toggleReaction(type: ReactionType, e: React.MouseEvent) {
    e.stopPropagation();
    if (busy.has(type)) return;

    const reacted = myReactions.has(type);
    setBusy((b) => new Set(b).add(type));

    // Optimistic
    setMyReactions((prev) => {
      const next = new Set(prev);
      reacted ? next.delete(type) : next.add(type);
      return next;
    });
    setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] + (reacted ? -1 : 1)) }));

    const supabase = createClient();

    if (reacted) {
      await supabase
        .from("win_reactions")
        .delete()
        .eq("win_id", win.id)
        .eq("user_id", currentUserId)
        .eq("reaction_type", type);
    } else {
      await supabase
        .from("win_reactions")
        .insert({ win_id: win.id, user_id: currentUserId, reaction_type: type });
    }

    // Patch reaction_counts on wins directly (no RPC dependency)
    const { data } = await supabase
      .from("wins")
      .select("reaction_counts")
      .eq("id", win.id)
      .single();
    const current = getCounts(data?.reaction_counts ?? null);
    current[type] = Math.max(0, current[type] + (reacted ? -1 : 1));
    await supabase.from("wins").update({ reaction_counts: current }).eq("id", win.id);

    setBusy((b) => { const s = new Set(b); s.delete(type); return s; });
  }

  return (
    <article className="flex flex-col" style={{ gap: "0" }}>
      {/* Meta */}
      <div className="flex items-center" style={{ gap: "10px", marginBottom: "12px" }}>
        <span className="font-poppins text-[#f0ebe0]" style={{ fontSize: "12px", fontWeight: 500 }}>{username}</span>
        <span className="font-poppins font-light text-[rgba(240,235,224,0.25)]" style={{ fontSize: "11px" }}>{timeAgo}</span>
      </div>

      {/* Title */}
      <h1 className="font-poppins font-black text-[#f0ebe0] leading-tight" style={{ fontSize: "32px", marginBottom: "16px" }}>
        {win.title}
      </h1>

      {/* Description */}
      <p className="font-poppins font-light text-[rgba(240,235,224,0.7)]" style={{ fontSize: "16px", lineHeight: 1.8 }}>
        {win.description}
      </p>

      {/* Media */}
      {win.media_url && (
        <div style={{ marginTop: "24px" }}>
          <img src={win.media_url} alt={win.title} className="w-full object-cover" style={{ maxHeight: "480px" }} />
        </div>
      )}

      {/* Reactions */}
      <div className="flex items-center flex-wrap" style={{ marginTop: "32px", gap: "8px" }}>
        {REACTIONS.map(({ type, emoji, label }) => {
          const active = myReactions.has(type);
          const count = counts[type];
          return (
            <button
              key={type}
              onClick={(e) => toggleReaction(type, e)}
              className="font-poppins flex items-center transition-colors"
              style={{
                gap: "6px",
                padding: "8px 14px",
                background: active ? "#f0ebe0" : "transparent",
                color: active ? "#0a0a0a" : "rgba(240,235,224,0.35)",
                border: active ? "none" : "0.5px solid rgba(240,235,224,0.12)",
                cursor: busy.has(type) ? "default" : "pointer",
                fontSize: "14px",
                borderRadius: 0,
              }}
              title={label}
            >
              <span style={{ fontSize: "14px" }}>{emoji}</span>
              {count > 0 && (
                <span style={{ fontSize: "12px", fontWeight: 500 }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Back link */}
      <a
        href="/wins"
        className="font-poppins font-light text-[rgba(240,235,224,0.3)] hover:text-[rgba(240,235,224,0.6)] transition-colors"
        style={{ fontSize: "12px", marginTop: "48px", display: "inline-block" }}
      >
        ← Back to Wins
      </a>
    </article>
  );
}
