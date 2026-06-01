"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import WinCard, { type WinCardData } from "@/components/stations/WinCard";
import PostWinModal from "@/components/stations/PostWinModal";
import type { WinCategory, ReactionType } from "@/types";

const CATEGORIES: { value: WinCategory | "all"; label: string }[] = [
  { value: "all",      label: "All"      },
  { value: "startup",  label: "Startup"  },
  { value: "project",  label: "Project"  },
  { value: "fitness",  label: "Fitness"  },
  { value: "exam",     label: "Exam"     },
  { value: "personal", label: "Personal" },
  { value: "other",    label: "Other"    },
];

export default function WinsFeed({ currentUserId }: { currentUserId: string }) {
  const [filter, setFilter] = useState<WinCategory | "all">("all");
  const [wins, setWins] = useState<WinCardData[]>([]);
  // { win_id -> Set<reaction_type> }
  const [reactionMap, setReactionMap] = useState<Record<string, Set<ReactionType>>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchWins = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("wins")
      .select("*, users(username, avatar_url)")
      .order("created_at", { ascending: false });

    if (filter !== "all") query = query.eq("category", filter);

    const { data } = await query;
    const winRows = (data as unknown as WinCardData[]) ?? [];
    setWins(winRows);

    if (winRows.length > 0) {
      const ids = winRows.map((w) => w.id);
      const { data: reactions } = await supabase
        .from("win_reactions")
        .select("win_id, reaction_type")
        .eq("user_id", currentUserId)
        .in("win_id", ids);

      const map: Record<string, Set<ReactionType>> = {};
      for (const r of reactions ?? []) {
        if (!map[r.win_id]) map[r.win_id] = new Set();
        map[r.win_id].add(r.reaction_type as ReactionType);
      }
      setReactionMap(map);
    } else {
      setReactionMap({});
    }

    setLoading(false);
  }, [filter, currentUserId]);

  useEffect(() => { fetchWins(); }, [fetchWins]);

  return (
    <div className="px-10 py-8">
      <style>{`
        .wins-topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .wins-filters { display: flex; align-items: center; flex-wrap: wrap; gap: 0; }
        .wins-postbtn { flex-shrink: 0; }
        @media (max-width: 767px) {
          .wins-topbar { flex-direction: column; align-items: stretch; gap: 10px; }
          .wins-postbtn { width: 100%; }
          .wins-filters { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .wins-filters::-webkit-scrollbar { display: none; }
        }
      `}</style>

      <div className="wins-topbar mb-8">
        <button
          onClick={() => setModalOpen(true)}
          className="wins-postbtn font-poppins"
          style={{
            background: "#f0ebe0", color: "#0a0a0a", fontSize: "11px", fontWeight: 500,
            letterSpacing: "0.15em", textTransform: "uppercase", padding: "10px 20px",
            border: "none", cursor: "pointer", borderRadius: 0, order: -1,
          }}
        >
          Post a Win
        </button>

        <div className="wins-filters">
          {CATEGORIES.map(({ value, label }) => {
            const active = filter === value;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className="font-poppins font-light uppercase transition-colors"
                style={{
                  fontSize: "11px", letterSpacing: "0.15em", padding: "6px 14px 8px",
                  background: "none", border: "none",
                  borderBottom: active ? "2px solid #c0392b" : "2px solid transparent",
                  color: active ? "#f0ebe0" : "rgba(240,235,224,0.35)",
                  cursor: "pointer", transition: "color 150ms, border-color 150ms",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="font-playfair italic text-[rgba(240,235,224,0.2)]" style={{ fontSize: "15px" }}>Loading…</p>
      ) : wins.length === 0 ? (
        <p className="font-playfair italic text-[rgba(240,235,224,0.2)]" style={{ fontSize: "15px" }}>
          {filter === "all" ? "No wins yet. Be the first." : `No ${filter} wins yet.`}
        </p>
      ) : (
        <div>
          <div style={{ borderTop: "0.5px solid rgba(240,235,224,0.08)" }} />
          {wins.map((win) => (
            <WinCard
              key={win.id}
              win={win}
              currentUserId={currentUserId}
              userReactions={reactionMap[win.id] ?? new Set()}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <PostWinModal
          onClose={() => setModalOpen(false)}
          onPosted={() => { setModalOpen(false); fetchWins(); }}
        />
      )}
    </div>
  );
}
