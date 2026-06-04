"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const WINS_SEEN_KEY = "wins_lastseen";

/** Records that the user has just viewed the Wins feed. */
export function markWinsSeen() {
  try {
    localStorage.setItem(WINS_SEEN_KEY, String(Date.now()));
  } catch {
    /* ignore storage failures */
  }
}

function getWinsSeen(): number {
  try {
    return Number(localStorage.getItem(WINS_SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * True when a win posted by someone else has appeared since the user last
 * opened the Wins feed. Combines an initial "is the newest win unseen?" check
 * (catches wins posted while away) with a live INSERT subscription.
 *
 * `markSeen()` clears the flag and stamps the seen time — call it when the
 * user reaches the feed.
 */
export function useWinsUnread(userId: string) {
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Catch wins posted while this client wasn't subscribed.
    supabase
      .from("wins")
      .select("user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        const w = data?.[0] as { user_id: string; created_at: string } | undefined;
        if (
          w &&
          w.user_id !== userId &&
          new Date(w.created_at).getTime() > getWinsSeen()
        ) {
          setHasNew(true);
        }
      });

    // Live: any new win from another member lights the badge.
    const channel = supabase
      .channel("wins_badge")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wins" },
        (payload) => {
          const w = payload.new as { user_id: string };
          if (w.user_id !== userId) setHasNew(true);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markSeen = useCallback(() => {
    markWinsSeen();
    setHasNew(false);
  }, []);

  return { hasNew, markSeen };
}
