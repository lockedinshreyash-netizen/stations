"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WinCategory } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface WinCardProps {
  win: {
    id: string;
    title: string;
    description: string;
    category: WinCategory;
    media_url: string | null;
    reactions_count: number;
    created_at: string;
    users: { username: string; avatar_url: string | null } | null;
  };
  currentUserId: string;
  userReacted: boolean;
}

const CATEGORY_COLORS: Record<WinCategory, string> = {
  startup: "#c0392b",
  project: "rgba(240,235,224,0.45)",
  fitness: "rgba(240,235,224,0.45)",
  exam: "rgba(240,235,224,0.45)",
  personal: "rgba(240,235,224,0.45)",
  other: "rgba(240,235,224,0.45)",
};

export default function WinCard({ win, currentUserId, userReacted }: WinCardProps) {
  const [reacted, setReacted] = useState(userReacted);
  const [count, setCount] = useState(win.reactions_count);
  const [loading, setLoading] = useState(false);

  const username = win.users?.username ?? "member";
  const timeAgo = formatDistanceToNow(new Date(win.created_at), { addSuffix: true });

  async function toggleReaction() {
    if (loading) return;
    setLoading(true);
    const supabase = createClient();

    if (reacted) {
      await supabase
        .from("win_reactions")
        .delete()
        .eq("win_id", win.id)
        .eq("user_id", currentUserId);
      await supabase
        .from("wins")
        .update({ reactions_count: count - 1 })
        .eq("id", win.id);
      setCount((c) => c - 1);
      setReacted(false);
    } else {
      await supabase
        .from("win_reactions")
        .insert({ win_id: win.id, user_id: currentUserId, emoji: "✊" });
      await supabase
        .from("wins")
        .update({ reactions_count: count + 1 })
        .eq("id", win.id);
      setCount((c) => c + 1);
      setReacted(true);
    }
    setLoading(false);
  }

  return (
    <article
      className="flex flex-col"
      style={{
        padding: "24px 0",
        borderBottom: "0.5px solid rgba(240,235,224,0.08)",
        gap: "0",
      }}
    >
      {/* Top row: username · category · timestamp */}
      <div className="flex items-center" style={{ gap: "10px", marginBottom: "8px" }}>
        <span
          className="font-poppins text-[#f0ebe0]"
          style={{ fontSize: "12px", fontWeight: 500 }}
        >
          {username}
        </span>

        <span
          className="font-poppins uppercase"
          style={{
            fontSize: "9px",
            letterSpacing: "0.15em",
            color: CATEGORY_COLORS[win.category],
          }}
        >
          {win.category}
        </span>

        <span
          className="font-poppins font-light text-[rgba(240,235,224,0.25)] ml-auto"
          style={{ fontSize: "11px" }}
        >
          {timeAgo}
        </span>
      </div>

      {/* Title */}
      <h2
        className="font-poppins font-black text-[#f0ebe0] leading-tight"
        style={{ fontSize: "20px", marginBottom: "6px" }}
      >
        {win.title}
      </h2>

      {/* Description */}
      <p
        className="font-poppins font-light text-[rgba(240,235,224,0.6)]"
        style={{ fontSize: "14px", lineHeight: 1.7 }}
      >
        {win.description}
      </p>

      {/* Media */}
      {win.media_url && (
        <div style={{ marginTop: "14px", maxHeight: "320px", overflow: "hidden" }}>
          <img
            src={win.media_url}
            alt={win.title}
            className="w-full object-cover"
            style={{ maxHeight: "320px" }}
          />
        </div>
      )}

      {/* Reaction */}
      <div style={{ marginTop: "16px" }}>
        <button
          onClick={toggleReaction}
          disabled={loading}
          className="flex items-center font-poppins font-light transition-colors"
          style={{
            gap: "6px",
            fontSize: "13px",
            color: reacted ? "#f0ebe0" : "rgba(240,235,224,0.3)",
            background: "none",
            border: "none",
            cursor: loading ? "default" : "pointer",
            padding: 0,
          }}
        >
          <span style={{ fontSize: "15px" }}>✊</span>
          <span>{count > 0 ? count : ""}</span>
        </button>
      </div>
    </article>
  );
}
