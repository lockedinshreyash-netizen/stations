"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tap } from "@/lib/feedback";
import FounderMark from "@/components/ui/FounderMark";
import type { Challenge, ChallengeMetric } from "@/types";

const METRIC: Record<ChallengeMetric, { noun: string }> = {
  focus_minutes: { noun: "focus minutes" },
  sessions_completed: { noun: "sessions" },
  wins_posted: { noun: "wins" },
  streak_days: { noun: "day streak" },
};

const LABEL =
  "font-poppins font-light uppercase text-[rgba(var(--fg-rgb),0.25)] mb-5";
const LABEL_STYLE = { fontSize: "14px", letterSpacing: "0.2em" } as const;

interface Participation {
  current_value: number;
  completed: boolean;
}
interface LeaderRow {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  founder_number: number | null;
  current_value: number;
  completed: boolean;
}

interface Props {
  challenges: Challenge[];
  participation: Record<string, Participation>;
  userId: string;
  isAdmin: boolean;
}

export default function CompeteStation({
  challenges,
  participation,
  userId,
  isAdmin,
}: Props) {
  const [parts, setParts] = useState(participation);
  const now = Date.now();

  const active = challenges.filter(
    (c) =>
      new Date(c.starts_at).getTime() <= now &&
      new Date(c.ends_at).getTime() >= now
  );
  const upcoming = challenges.filter(
    (c) => new Date(c.starts_at).getTime() > now
  );
  const past = challenges.filter((c) => new Date(c.ends_at).getTime() < now);

  async function join(id: string) {
    tap();
    const supabase = createClient();
    const { error } = await supabase.rpc("join_challenge", {
      p_challenge_id: id,
    });
    if (!error) {
      setParts((p) => ({ ...p, [id]: { current_value: 0, completed: false } }));
    }
  }

  return (
    <div
      className="px-5 md:px-10 py-12 max-w-3xl flex flex-col"
      style={{ gap: "48px" }}
    >
      {isAdmin && (
        <Link
          href="/compete/admin"
          className="st-btn self-start font-poppins uppercase inline-flex items-center gap-2"
          style={{
            background: "rgb(var(--fg-rgb))",
            color: "var(--bg-primary)",
            fontSize: "13px",
            fontWeight: 500,
            letterSpacing: "0.12em",
            padding: "10px 18px",
          }}
        >
          <Plus size={15} /> New challenge
        </Link>
      )}

      {challenges.length === 0 && (
        <p
          className="font-playfair italic text-[rgba(var(--fg-rgb),0.45)]"
          style={{ fontSize: "20px" }}
        >
          No challenges yet. {isAdmin ? "Create the first one." : "Check back soon."}
        </p>
      )}

      <Group title="Active" items={active}>
        {(c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            phase="active"
            part={parts[c.id]}
            userId={userId}
            onJoin={join}
          />
        )}
      </Group>
      <Group title="Upcoming" items={upcoming}>
        {(c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            phase="upcoming"
            part={parts[c.id]}
            userId={userId}
            onJoin={join}
          />
        )}
      </Group>
      <Group title="Finished" items={past}>
        {(c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            phase="past"
            part={parts[c.id]}
            userId={userId}
            onJoin={join}
          />
        )}
      </Group>
    </div>
  );
}

function Group({
  title,
  items,
  children,
}: {
  title: string;
  items: Challenge[];
  children: (c: Challenge) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={LABEL} style={LABEL_STYLE}>
        {title}
      </p>
      <div className="flex flex-col gap-4">{items.map(children)}</div>
    </div>
  );
}

function ChallengeCard({
  challenge: c,
  phase,
  part,
  userId,
  onJoin,
}: {
  challenge: Challenge;
  phase: "active" | "upcoming" | "past";
  part: Participation | undefined;
  userId: string;
  onJoin: (id: string) => void;
}) {
  const [board, setBoard] = useState<LeaderRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const m = METRIC[c.metric];
  const joined = !!part;
  const pct = part
    ? Math.min(100, Math.round((part.current_value / c.target_value) * 100))
    : 0;

  async function toggleBoard() {
    tap();
    if (!open && board === null) {
      const supabase = createClient();
      const { data } = await supabase.rpc("challenge_leaderboard", {
        p_challenge_id: c.id,
      });
      setBoard((data as LeaderRow[]) ?? []);
    }
    setOpen((o) => !o);
  }

  const top = board?.slice(0, 10) ?? [];
  const mine = board?.find((r) => r.user_id === userId) ?? null;
  const mineInTop = mine ? mine.rank <= 10 : false;

  return (
    <div className="st-card bg-[var(--bg-surface)] px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="font-poppins text-[rgb(var(--fg-rgb))]"
          style={{ fontSize: "18px", fontWeight: 600 }}
        >
          {c.title}
        </span>
        <span
          className="font-poppins shrink-0 text-[rgba(var(--fg-rgb),0.35)]"
          style={{ fontSize: "12px" }}
        >
          {format(new Date(c.starts_at), "MMM d")} –{" "}
          {format(new Date(c.ends_at), "MMM d")}
        </span>
      </div>

      <p
        className="font-poppins font-light text-[rgba(var(--fg-rgb),0.6)] mt-1"
        style={{ fontSize: "14px", lineHeight: 1.5 }}
      >
        {c.description}
      </p>

      <p
        className="font-poppins uppercase mt-3"
        style={{
          fontSize: "12px",
          letterSpacing: "0.1em",
          color: "var(--accent-2)",
        }}
      >
        Goal: {c.target_value} {m.noun}
      </p>

      {/* Your progress */}
      {joined && (
        <div className="mt-3">
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ background: "rgba(var(--fg-rgb),0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: part!.completed ? "var(--accent-2)" : "var(--accent)",
                transition: "width 0.4s var(--ease)",
              }}
            />
          </div>
          <span
            className="font-poppins"
            style={{ fontSize: "13px", color: "rgba(var(--fg-rgb),0.5)" }}
          >
            You: {part!.current_value}/{c.target_value}
            {part!.completed ? " · done ✓" : ""}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-4">
        {!joined && phase !== "past" && (
          <button
            type="button"
            onClick={() => onJoin(c.id)}
            className="st-btn font-poppins uppercase"
            style={{
              background: "var(--accent)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 500,
              letterSpacing: "0.12em",
              padding: "8px 18px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Join challenge
          </button>
        )}
        <button
          type="button"
          onClick={toggleBoard}
          className="font-poppins uppercase"
          style={{
            fontSize: "12px",
            letterSpacing: "0.12em",
            color: "rgba(var(--fg-rgb),0.45)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          {open ? "Hide leaderboard" : "Leaderboard"}
        </button>
      </div>

      {/* Leaderboard */}
      {open && (
        <div className="mt-4 flex flex-col gap-1.5 border-t border-[rgba(var(--fg-rgb),0.08)] pt-4">
          {top.length === 0 ? (
            <span
              className="font-poppins font-light text-[rgba(var(--fg-rgb),0.4)]"
              style={{ fontSize: "14px" }}
            >
              No one's on the board yet. Be first.
            </span>
          ) : (
            <>
              {top.map((r) => (
                <LeaderboardRow key={r.user_id} row={r} me={r.user_id === userId} />
              ))}
              {mine && !mineInTop && (
                <>
                  <span
                    className="text-center text-[rgba(var(--fg-rgb),0.3)]"
                    style={{ fontSize: "12px" }}
                  >
                    ···
                  </span>
                  <LeaderboardRow row={mine} me />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderboardRow({ row, me }: { row: LeaderRow; me: boolean }) {
  return (
    <div
      className="flex items-center gap-3 px-2 py-1.5 rounded-[var(--radius-sm)]"
      style={{ background: me ? "rgba(var(--accent-rgb),0.1)" : "transparent" }}
    >
      <span
        className="font-poppins shrink-0 text-right"
        style={{
          width: "28px",
          fontSize: "14px",
          fontWeight: 600,
          color:
            row.rank <= 3 ? "var(--accent-2)" : "rgba(var(--fg-rgb),0.4)",
        }}
      >
        {row.rank}
      </span>
      <span className="flex items-center gap-1.5 min-w-0 flex-1">
        <span
          className="font-poppins truncate text-[rgb(var(--fg-rgb))]"
          style={{ fontSize: "15px", fontWeight: me ? 600 : 400 }}
        >
          {me ? "You" : row.username}
        </span>
        <FounderMark founderNumber={row.founder_number} />
      </span>
      <span
        className="font-poppins shrink-0"
        style={{ fontSize: "14px", color: "rgba(var(--fg-rgb),0.55)" }}
      >
        {row.current_value}
      </span>
    </div>
  );
}
