"use client";

import { useState } from "react";
import Link from "next/link";
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
  image_urls?: string[] | null;
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
  startup:  "#c0392b",
  project:  "rgba(240,235,224,0.45)",
  fitness:  "rgba(240,235,224,0.45)",
  exam:     "rgba(240,235,224,0.45)",
  personal: "rgba(240,235,224,0.45)",
  other:    "rgba(240,235,224,0.45)",
};

export default function WinCard({ win, currentUserId, userReactions }: WinCardProps) {
  const [counts, setCounts] = useState<ReactionCounts>(getCounts(win.reaction_counts));
  const [myReactions, setMyReactions] = useState<Set<ReactionType>>(new Set(userReactions));
  const [busy, setBusy] = useState<Set<ReactionType>>(new Set());

  const username = win.users?.username ?? "member";
  const timeAgo = formatDistanceToNow(new Date(win.created_at), { addSuffix: true });

  async function toggleReaction(type: ReactionType, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy.has(type)) return;

    const reacted = myReactions.has(type);

    // Optimistic update immediately
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
    const { data, error } = await supabase.rpc("toggle_reaction", {
      p_win_id: win.id,
      p_user_id: currentUserId,
      p_reaction_type: type,
    });

    if (error || !data) {
      // Revert optimistic update
      setMyReactions((prev) => {
        const next = new Set(prev);
        reacted ? next.add(type) : next.delete(type);
        return next;
      });
      setCounts((prev) => ({
        ...prev,
        [type]: Math.max(0, prev[type] + (reacted ? 1 : -1)),
      }));
      console.error("Reaction toggle failed:", error?.message);
    }

    setBusy((b) => { const s = new Set(b); s.delete(type); return s; });
  }

  return (
    <article
      className="flex flex-col"
      style={{ padding: "24px 0", borderBottom: "0.5px solid rgba(240,235,224,0.08)", cursor: "pointer" }}
    >
      <Link href={`/wins/${win.id}`} className="flex flex-col" style={{ gap: 0, textDecoration: "none" }}>
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

        {/* Images */}
        {win.image_urls && win.image_urls.length > 0 && (
          <div
            className="flex"
            style={{ marginTop: "14px", gap: "8px", maxHeight: "320px", overflow: "hidden" }}
          >
            {win.image_urls.slice(0, 2).map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${win.title} image ${i + 1}`}
                className="object-cover"
                style={{
                  flex: 1,
                  maxHeight: "320px",
                  minWidth: 0,
                }}
              />
            ))}
          </div>
        )}

        {/* Legacy media_url fallback */}
        {(!win.image_urls || win.image_urls.length === 0) && win.media_url && (
          <div style={{ marginTop: "14px", maxHeight: "320px", overflow: "hidden" }}>
            <img src={win.media_url} alt={win.title} className="w-full object-cover" style={{ maxHeight: "320px" }} />
          </div>
        )}
      </Link>

      {/* Reactions — outside Link so clicks don't navigate */}
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
