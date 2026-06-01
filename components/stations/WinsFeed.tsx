"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import WinCard from "@/components/stations/WinCard";
import PostWinModal from "@/components/stations/PostWinModal";
import type { WinCategory } from "@/types";

const CATEGORIES: { value: WinCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "startup", label: "Startup" },
  { value: "project", label: "Project" },
  { value: "fitness", label: "Fitness" },
  { value: "exam", label: "Exam" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

interface Win {
  id: string;
  title: string;
  description: string;
  category: WinCategory;
  media_url: string | null;
  reactions_count: number;
  created_at: string;
  users: { username: string; avatar_url: string | null } | null;
}

interface WinsFeedProps {
  currentUserId: string;
  canPost: boolean; // paid + founding only
}

export default function WinsFeed({ currentUserId, canPost }: WinsFeedProps) {
  const [filter, setFilter] = useState<WinCategory | "all">("all");
  const [wins, setWins] = useState<Win[]>([]);
  const [reactedIds, setReactedIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchWins = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("wins")
      .select("*, users(username, avatar_url)")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("category", filter);
    }

    const { data } = await query;
    setWins((data as Win[]) ?? []);

    // Fetch which wins current user has reacted to
    if (data && data.length > 0) {
      const ids = data.map((w: Win) => w.id);
      const { data: reactions } = await supabase
        .from("win_reactions")
        .select("win_id")
        .eq("user_id", currentUserId)
        .in("win_id", ids);
      setReactedIds(new Set((reactions ?? []).map((r: { win_id: string }) => r.win_id)));
    } else {
      setReactedIds(new Set());
    }

    setLoading(false);
  }, [filter, currentUserId]);

  useEffect(() => {
    fetchWins();
  }, [fetchWins]);

  return (
    <div className="px-10 py-8">
      {/* Top bar: filter + post button */}
      <div className="flex items-center justify-between mb-8" style={{ gap: "16px" }}>
        {/* Category filter */}
        <div className="flex items-center flex-wrap" style={{ gap: "0" }}>
          {CATEGORIES.map(({ value, label }) => {
            const active = filter === value;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className="font-poppins font-light uppercase transition-colors"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.15em",
                  padding: "6px 14px 8px",
                  background: "none",
                  border: "none",
                  borderBottom: active ? "2px solid #c0392b" : "2px solid transparent",
                  color: active ? "#f0ebe0" : "rgba(240,235,224,0.35)",
                  cursor: "pointer",
                  transition: "color 150ms, border-color 150ms",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Post button */}
        {canPost && (
          <button
            onClick={() => setModalOpen(true)}
            className="font-poppins shrink-0"
            style={{
              background: "#f0ebe0",
              color: "#0a0a0a",
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              padding: "10px 18px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Post a Win
          </button>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <p
          className="font-playfair italic text-[rgba(240,235,224,0.2)]"
          style={{ fontSize: "15px" }}
        >
          Loading…
        </p>
      ) : wins.length === 0 ? (
        <p
          className="font-playfair italic text-[rgba(240,235,224,0.2)]"
          style={{ fontSize: "15px" }}
        >
          {filter === "all" ? "No wins yet. Be the first." : `No ${filter} wins yet.`}
        </p>
      ) : (
        <div>
          {/* Top border for the first item */}
          <div style={{ borderTop: "0.5px solid rgba(240,235,224,0.08)" }} />
          {wins.map((win) => (
            <WinCard
              key={win.id}
              win={win}
              currentUserId={currentUserId}
              userReacted={reactedIds.has(win.id)}
            />
          ))}
        </div>
      )}

      {/* Post modal */}
      {modalOpen && (
        <PostWinModal
          onClose={() => setModalOpen(false)}
          onPosted={() => {
            setModalOpen(false);
            fetchWins();
          }}
        />
      )}
    </div>
  );
}
