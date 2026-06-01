"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WinCategory, ReactionCounts, ReactionType } from "@/types";
import { REACTIONS, getCounts } from "@/lib/utils/reactions";
import { formatDistanceToNow } from "date-fns";

export interface WinCardData {
  id: string;
  title: string;
  description: string;
  category: WinCategory;
  media_url: string | null;
  reactions_count: number;
  reaction_counts: ReactionCounts | null;
  created_at: string;
  users: { username: string; avatar_url: string | null } | null;
}

interface WinCardProps {
  win: WinCardData;
  currentUserId: string;
  userReactions: Set<ReactionType>;
}

const CATEGORY_COLORS: Record<WinCategory, string> = {
  startup: "#c0392b",
  project: "rgba(240,235,224,0.45)",
  fitness: "rgba(240,235,224,0.45)",
  exam:    "rgba(240,235,224,0.45)",
  personal:"rgba(240,235,224,0.45)",
  other:   "rgba(240,235,224,0.45)",
};

async function patchReactionCounts(winId: string, type: ReactionType, delta: 1 | -1) {
  const supabase = createClient();
  const { data } = await supabase
    .from("wins")
    .select("reaction_counts")
    .eq("id", winId)
    .single();
  const current = getCounts((data?.reaction_counts as ReactionCounts | null) ?? null);
  current[type] = Math.max(0, current[type] + delta);
  await supabase.from("wins").update({ reaction_counts: current }).eq("id", winId);
}

export default function WinCard({ win, currentUserId, userReactions }: WinCardProps) {
  const [counts, setCounts] = useState<ReactionCounts>(getCounts(win.reaction_counts));
  const [myReactions, setMyReactions] = useState<Set<ReactionType>>(new Set(userReactions));
  const [busy, setBusy] = useState<Set<ReactionType>>(new Set());

  const username = win.users?.username ?? "member";
  const timeAgo = formatDistanceToNow(new Date(win.created_at), { addSuffix: true });

  async function toggleReaction(type: ReactionType, e: React.MouseEvent) {
    e.stopPropagation();
    if (busy.has(type)) return;

    const reacted = myReactions.has(type);

    // Optimistic update
    setBusy((b) => new Set(b).add(type));
    setMyReactions((prev) => {
      const next = new Set(prev);
      reacted ? next.delete(type) : next.add(type);
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [type]: Math.max(0, prev[type] + (reacted ? -1 : 1)),
    }));

    const supabase = createClient();

    if (reacted) {
      const { error } = await supabase
        .from("win_reactions")
        .delete()
        .eq("win_id", win.id)
        .eq("user_id", currentUserId)
        .eq("reaction_type", type);

      if (error) {
        // Revert
        setMyReactions((prev) => new Set(prev).add(type));
        setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }));
      } else {
        await patchReactionCounts(win.id, type, -1);
      }
    } else {
      const { error } = await supabase
        .from("win_reactions")
        .insert({ win_id: win.id, user_id: currentUserId, reaction_type: type });

      if (error) {
        // Revert
        setMyReactions((prev) => { const s = new Set(prev); s.delete(type); return s; });
        setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
      } else {
        await patchReactionCounts(win.id, type, 1);
      }
    }

    setBusy((b) => { const s = new Set(b); s.delete(type); return s; });
  }

  return (
    <article
      className="flex flex-col"
      style={{ padding: "24px 0", borderBottom: "0.5px solid rgba(240,235,224,0.08)" }}
    >
      {/* Top row */}
      <div className="flex items-center" style={{ gap: "10px", marginBottom: "8px" }}>
        <span className="font-poppins text-[#f0ebe0]" style={{ fontSize: "12px", fontWeight: 500 }}>
          {username}
        </span>
        <span
          className="font-poppins uppercase"
          style={{ fontSize: "9px", letterSpacing: "0.15em", color: CATEGORY_COLORS[win.category] }}
        >
          {win.category}
        </span>
        <span className="font-poppins font-light text-[rgba(240,235,224,0.25)] ml-auto" style={{ fontSize: "11px" }}>
          {timeAgo}
        </span>
      </div>

      {/* Title */}
      <h2 className="font-poppins font-black text-[#f0ebe0] leading-tight" style={{ fontSize: "20px", marginBottom: "6px" }}>
        {win.title}
      </h2>

      {/* Description */}
      <p className="font-poppins font-light text-[rgba(240,235,224,0.6)]" style={{ fontSize: "14px", lineHeight: 1.7 }}>
        {win.description}
      </p>

      {/* Media */}
      {win.media_url && (
        <div style={{ marginTop: "14px", maxHeight: "320px", overflow: "hidden" }}>
          <img src={win.media_url} alt={win.title} className="w-full object-cover" style={{ maxHeight: "320px" }} />
        </div>
      )}

      {/* Reactions */}
      <style>{`
        .reaction-btn { padding: 6px 10px; }
        @media (max-width: 767px) { .reaction-btn { padding: 4px 8px; } }
      `}</style>
      <div className="flex items-center" style={{ marginTop: "16px", gap: "8px", flexWrap: "wrap" }}>
        {REACTIONS.map(({ type, emoji, label }) => {
          const active = myReactions.has(type);
          const count = counts[type];
          return (
            <button
              key={type}
              onClick={(e) => toggleReaction(type, e)}
              className="reaction-btn font-poppins flex items-center transition-colors"
              style={{
                gap: "5px",
                background: active ? "#f0ebe0" : "transparent",
                color: active ? "#0a0a0a" : "rgba(240,235,224,0.35)",
                border: active ? "none" : "0.5px solid rgba(240,235,224,0.12)",
                cursor: busy.has(type) ? "default" : "pointer",
                fontSize: "13px",
                lineHeight: 1,
                borderRadius: 0,
              }}
              title={label}
            >
              <span style={{ fontSize: "13px" }}>{emoji}</span>
              {count > 0 && (
                <span style={{ fontSize: "11px", fontWeight: 500 }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </article>
  );
}
