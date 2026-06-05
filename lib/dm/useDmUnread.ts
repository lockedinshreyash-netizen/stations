"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * True when the user has any direct message they received but haven't read.
 *
 * Source of truth is the DB: a message is unread when sender_id != me and
 * read_at is null. RLS limits both the count query and realtime events to the
 * caller's own conversations, so this never leaks others' message state.
 *
 * Clearing is implicit — opening a thread calls markConversationRead, which
 * sets read_at; the resulting UPDATE event re-runs the count and drops the
 * badge (consistent across tabs/devices).
 */
export function useDmUnread(userId: string): boolean {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const check = async () => {
      const { count } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .neq("sender_id", userId)
        .is("read_at", null);
      if (active) setHasUnread((count ?? 0) > 0);
    };

    check();

    const channel = supabase
      .channel("dm_unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => check()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return hasUnread;
}
