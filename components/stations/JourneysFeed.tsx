"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import JourneyCard from "@/components/stations/JourneyCard";
import JourneyModal from "@/components/stations/JourneyModal";
import { JOURNEY_CATEGORIES } from "@/lib/journeys/meta";
import type { JourneyCategory, JourneyWithAuthor } from "@/types";

const PAGE_SIZE = 25;

const FILTERS: { value: JourneyCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...JOURNEY_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];

export default function JourneysFeed() {
  const [filter, setFilter] = useState<JourneyCategory | "all">("all");
  const [journeys, setJourneys] = useState<JourneyWithAuthor[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // cursor = last_activity_at of the last loaded journey; null = first page.
  const fetchJourneys = useCallback(
    async (cursor: string | null) => {
      if (cursor) setLoadingMore(true);
      else setLoading(true);

      try {
        const supabase = createClient();
        let query = supabase
          .from("journeys")
          .select("*, users(username, avatar_url, founder_number)")
          .eq("status", "active")
          .order("last_activity_at", { ascending: false })
          .limit(PAGE_SIZE);

        if (filter !== "all") query = query.eq("category", filter);
        if (cursor) query = query.lt("last_activity_at", cursor);

        const { data, error } = await query;
        // If the table isn't there yet (migration not applied), degrade quietly.
        const rows = error ? [] : ((data as unknown as JourneyWithAuthor[]) ?? []);
        setHasMore(rows.length >= PAGE_SIZE);
        setJourneys((prev) =>
          cursor
            ? [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))]
            : rows
        );
      } catch {
        if (!cursor) setJourneys([]);
        setHasMore(false);
      }

      if (cursor) setLoadingMore(false);
      else setLoading(false);
    },
    [filter]
  );

  useEffect(() => {
    fetchJourneys(null);
  }, [fetchJourneys]);

  const loadMore = () => {
    if (loadingMore || journeys.length === 0) return;
    fetchJourneys(journeys[journeys.length - 1].last_activity_at);
  };

  return (
    <div className="px-5 md:px-10 py-8">
      <style>{`
        .jy-topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .jy-filters { display: flex; align-items: center; flex-wrap: wrap; gap: 0; }
        .jy-postbtn { flex-shrink: 0; }
        @media (max-width: 767px) {
          .jy-topbar { flex-direction: column; align-items: stretch; gap: 10px; }
          .jy-postbtn { width: 100%; }
          .jy-filters { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .jy-filters::-webkit-scrollbar { display: none; }
        }
      `}</style>

      <div className="jy-topbar mb-8">
        <button
          onClick={() => setModalOpen(true)}
          className="jy-postbtn st-btn font-poppins"
          style={{
            background: "rgb(var(--fg-rgb))",
            color: "var(--bg-primary)",
            fontSize: "14px",
            fontWeight: 500,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            padding: "10px 20px",
            border: "none",
            cursor: "pointer",
            order: -1,
          }}
        >
          Share your journey
        </button>

        <div className="jy-filters">
          {FILTERS.map(({ value, label }) => {
            const active = filter === value;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className="font-poppins font-light uppercase transition-colors"
                style={{
                  fontSize: "14px",
                  letterSpacing: "0.15em",
                  padding: "6px 14px 8px",
                  background: "none",
                  border: "none",
                  borderBottom: active
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  color: active
                    ? "rgb(var(--fg-rgb))"
                    : "rgba(var(--fg-rgb),0.35)",
                  cursor: "pointer",
                  transition: "color 150ms, border-color 150ms",
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
        <p
          className="font-playfair italic text-[rgba(var(--fg-rgb),0.2)]"
          style={{ fontSize: "18px" }}
        >
          Loading…
        </p>
      ) : journeys.length === 0 ? (
        <div className="flex flex-col" style={{ gap: "16px" }}>
          <p
            className="font-playfair italic text-[rgba(var(--fg-rgb),0.3)]"
            style={{ fontSize: "20px", lineHeight: 1.5, maxWidth: "32rem" }}
          >
            {filter === "all"
              ? "No journeys yet. What are you building, becoming, or chasing? Be the first to share yours."
              : "No journeys in this category yet."}
          </p>
          {filter === "all" && (
            <button
              onClick={() => setModalOpen(true)}
              className="st-btn font-poppins uppercase self-start"
              style={{
                fontSize: "14px",
                letterSpacing: "0.15em",
                padding: "12px 22px",
                background: "rgb(var(--fg-rgb))",
                color: "var(--bg-primary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Start your journey
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {journeys.map((j) => (
            <JourneyCard key={j.id} journey={j} />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="font-poppins uppercase self-center transition-colors"
              style={{
                fontSize: "14px",
                letterSpacing: "0.15em",
                padding: "10px 20px",
                marginTop: "8px",
                background: "none",
                border: "0.5px solid rgba(var(--fg-rgb),0.2)",
                color: "rgba(var(--fg-rgb),0.6)",
                cursor: loadingMore ? "default" : "pointer",
              }}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}

      {modalOpen && (
        <JourneyModal
          mode="create"
          onClose={() => setModalOpen(false)}
          onSaved={(created) => {
            setModalOpen(false);
            setJourneys((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
          }}
        />
      )}
    </div>
  );
}
