"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { subscribeSessionOnlineIds } from "@/lib/firebase/work-chat";
import type { WorkSessionMember } from "@/types";
import FounderMark from "@/components/ui/FounderMark";

export type SessionMemberRow = WorkSessionMember & {
  username: string;
  avatar_url: string | null;
  founder_number: number | null;
};

interface SessionMemberListProps {
  sessionId: string;
  hostId: string;
  members: SessionMemberRow[];
}

export default function SessionMemberList({
  sessionId,
  hostId,
  members,
}: SessionMemberListProps) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    return subscribeSessionOnlineIds(sessionId, setOnlineIds);
  }, [sessionId]);

  // Host first, then by joined_at ascending.
  const sorted = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.user_id === hostId) return -1;
      if (b.user_id === hostId) return 1;
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });
  }, [members, hostId]);

  const onlineCount = sorted.filter((m) => onlineIds.has(m.user_id)).length;

  return (
    <div className="st-glass flex flex-col h-full min-h-0">
      <div
        className="shrink-0 px-5 py-4"
        style={{ borderBottom: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
      >
        <h2
          className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))]"
          style={{ fontSize: "12px", letterSpacing: "0.15em" }}
        >
          Members
        </h2>
        <p
          className="font-poppins text-[rgba(var(--fg-rgb),0.35)] mt-1"
          style={{ fontSize: "11px" }}
        >
          <span style={{ color: "var(--accent)" }}>{onlineCount} online now</span>
          {" · "}
          {sorted.length} total
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {sorted.map((m) => {
          const online = onlineIds.has(m.user_id);
          return (
            <div key={m.id} className="flex items-center gap-3">
              <div className="relative shrink-0">
                <Avatar url={m.avatar_url} username={m.username} />
                {online && (
                  <span
                    className="absolute bottom-0 right-0 rounded-full"
                    style={{
                      width: "8px",
                      height: "8px",
                      background: "var(--accent)",
                      border: "1.5px solid var(--bg-surface)",
                    }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="font-poppins font-medium text-[rgb(var(--fg-rgb))] truncate"
                    style={{ fontSize: "12px" }}
                  >
                    {m.username}
                  </span>
                  <FounderMark founderNumber={m.founder_number} />
                  {m.user_id === hostId && (
                    <span
                      className="font-poppins font-bold uppercase shrink-0"
                      style={{ fontSize: "9px", letterSpacing: "0.1em", color: "var(--accent)" }}
                    >
                      Host
                    </span>
                  )}
                </div>
                <span
                  className="font-poppins text-[rgba(var(--fg-rgb),0.3)]"
                  style={{ fontSize: "10px" }}
                >
                  {m.left_early
                    ? "Left early"
                    : `Joined ${format(new Date(m.joined_at), "h:mm a")}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Avatar({ url, username }: { url: string | null; username: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={username}
        className="rounded-full object-cover"
        style={{ width: "32px", height: "32px" }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-poppins font-bold"
      style={{
        width: "32px",
        height: "32px",
        fontSize: "12px",
        background: "rgba(var(--fg-rgb),0.1)",
        color: "rgba(var(--fg-rgb),0.6)",
      }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
