"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  const images: string[] = win.image_urls?.length ? win.image_urls : win.media_url ? [win.media_url] : [];

  // Realtime: refresh counts when another user reacts
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`win-detail-${win.id}`)
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
    e.preventDefault();
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
    setCounts((prev) => ({
      ...prev,
      [type]: Math.max(0, prev[type] + (reacted ? -1 : 1)),
    }));

    const supabase = createClient();
    const { error } = await supabase.rpc("toggle_reaction", {
      p_win_id: win.id,
      p_user_id: currentUserId,
      p_reaction_type: type,
    });

    if (error) {
      // Revert
      setMyReactions((prev) => {
        const next = new Set(prev);
        reacted ? next.add(type) : next.delete(type);
        return next;
      });
      setCounts((prev) => ({
        ...prev,
        [type]: Math.max(0, prev[type] + (reacted ? 1 : -1)),
      }));
      console.error("Reaction failed:", error.message);
    }

    setBusy((b) => { const s = new Set(b); s.delete(type); return s; });
  }

  return (
    <article className="flex flex-col" style={{ gap: 0 }}>
      {/* Back */}
      <Link
        href="/wins"
        className="font-poppins font-light text-[rgba(240,235,224,0.3)] hover:text-[rgba(240,235,224,0.6)] transition-colors"
        style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "32px", display: "inline-block" }}
      >
        ← Wins
      </Link>

      {/* Meta */}
      <div className="flex items-center flex-wrap" style={{ gap: "10px", marginBottom: "16px" }}>
        <span className="font-poppins text-[#f0ebe0]" style={{ fontSize: "12px", fontWeight: 500 }}>{username}</span>
        <span
          className="font-poppins uppercase"
          style={{ fontSize: "9px", letterSpacing: "0.15em", color: "rgba(240,235,224,0.4)" }}
        >
          {win.category}
        </span>
        <span className="font-poppins font-light text-[rgba(240,235,224,0.25)]" style={{ fontSize: "11px" }}>{timeAgo}</span>
      </div>

      {/* Title */}
      <h1 className="font-poppins font-black text-[#f0ebe0] leading-tight" style={{ fontSize: "36px", marginBottom: "20px" }}>
        {win.title}
      </h1>

      {/* Description */}
      <p className="font-poppins font-light text-[rgba(240,235,224,0.7)]" style={{ fontSize: "16px", lineHeight: 1.8 }}>
        {win.description}
      </p>

      {/* Images */}
      {images.length > 0 && (
        <div
          className="flex"
          style={{ marginTop: "28px", gap: "8px", maxHeight: "500px", overflow: "hidden" }}
        >
          {images.slice(0, 2).map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${win.title} image ${i + 1}`}
              className="object-cover"
              style={{ flex: 1, maxHeight: "500px", minWidth: 0 }}
            />
          ))}
        </div>
      )}

      {/* External link */}
      {win.media_url && images[0] !== win.media_url && (
        <a
          href={win.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-poppins font-light hover:opacity-70 transition-opacity"
          style={{ fontSize: "13px", color: "#c0392b", marginTop: "20px", display: "inline-block" }}
        >
          {win.media_url} ↗
        </a>
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
    </article>
  );
}
