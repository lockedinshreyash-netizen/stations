"use client";

import { useState } from "react";
import Link from "next/link";
import { Flame, ArrowRight, Radio } from "lucide-react";
import { toggleTodo, planStatus } from "@/lib/todos/queries";
import { fireCelebration } from "@/lib/celebrate";
import { notifyDailyComplete } from "@/lib/push/client";
import { tap } from "@/lib/feedback";
import StatCard from "@/components/ui/StatCard";
import FounderMark from "@/components/ui/FounderMark";
import PostWinModal from "@/components/stations/PostWinModal";
import type { DmParticipant, PartnerTodo, Todo, User } from "@/types";

export interface LiveSession {
  id: string;
  title: string;
  category: string;
  host_username: string;
  member_count: number;
}

interface TodayHomeProps {
  user: User;
  todayTodos: Todo[];
  streak: number;
  partner: { partner: DmParticipant; plan: PartnerTodo[] } | null;
  liveSessions: LiveSession[];
  lastWin: { id: string; title: string; reactions_count: number } | null;
  hasPostedWin: boolean;
}

const LABEL =
  "font-poppins font-light uppercase text-[rgba(var(--fg-rgb),0.25)] mb-5";
const LABEL_STYLE = { fontSize: "14px", letterSpacing: "0.2em" } as const;

/** Opens the global todo panel (owned by TodoFab) — single source of truth. */
function openTodoPanel() {
  tap();
  window.dispatchEvent(new CustomEvent("stations:open-todos"));
}

export default function TodayHome({
  user,
  todayTodos,
  streak,
  partner,
  liveSessions,
  lastWin,
  hasPostedWin,
}: TodayHomeProps) {
  const [todos, setTodos] = useState<Todo[]>(todayTodos);
  const [postOpen, setPostOpen] = useState(false);

  const focusHours = Math.floor(user.total_focus_minutes / 60);
  const roles = Array.isArray(user.role)
    ? (user.role as string[])
    : [user.role];
  const status = planStatus(todos);

  async function handleToggle(todo: Todo) {
    const wasAllDone = planStatus(todos).allDone;
    try {
      await toggleTodo(todo.id, !todo.done);
      const next = todos.map((t) =>
        t.id === todo.id ? { ...t, done: !todo.done } : t
      );
      setTodos(next);
      // Celebrate + ping partners only on the transition INTO a fully-done plan
      // (mirrors TodoFab; the server dedupes the ping to once per day).
      if (!wasAllDone && planStatus(next).allDone) {
        fireCelebration();
        notifyDailyComplete();
      }
    } catch {
      /* keep last good state */
    }
  }

  const partnerStatus = partner
    ? {
        total: partner.plan.length,
        done: partner.plan.filter((t) => t.done).length,
      }
    : null;

  return (
    <div>
      {/* ── Editorial header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden px-5 md:px-10 pt-7 pb-5 md:pt-9 md:pb-6 border-b border-[rgba(var(--fg-rgb),0.06)]">
        <div className="st-aurora" aria-hidden="true" />
        <p
          className="flex items-center gap-2 font-playfair italic text-[rgba(var(--accent-2-rgb),0.55)]"
          style={{ fontSize: "15px", marginBottom: "2px" }}
        >
          Welcome back —
          {user.founder_number ? (
            <span className="inline-flex items-center gap-1 not-italic font-poppins uppercase tracking-[0.15em] text-[11px] text-[var(--accent)]">
              <FounderMark founderNumber={user.founder_number} />
              No. {String(user.founder_number).padStart(3, "0")}
            </span>
          ) : null}
        </p>
        <h1
          className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))] break-words"
          style={{
            fontSize: "clamp(48px, 12vw, 140px)",
            letterSpacing: "-0.025em",
            lineHeight: 0.84,
          }}
        >
          {user.username.toUpperCase()}
          <span className="text-[var(--accent)]">.</span>
        </h1>
        <p
          className="font-playfair italic text-[rgba(var(--fg-rgb),0.4)] mt-3 md:mt-4 max-w-md"
          style={{ fontSize: "19px", lineHeight: 1.45 }}
        >
          {user.category} · {roles.join(", ")}
        </p>
      </div>

      <div
        className="px-5 md:px-10 py-12 max-w-3xl flex flex-col"
        style={{ gap: "56px" }}
      >
        {/* ── Today's 3 things ───────────────────────────────────── */}
        <div>
          <p className={LABEL} style={LABEL_STYLE}>
            Today
          </p>

          {todos.length === 0 ? (
            <div className="flex flex-col gap-4">
              <p
                className="font-playfair italic text-[rgba(var(--fg-rgb),0.55)]"
                style={{ fontSize: "20px" }}
              >
                What are the 3 things you&apos;ll do today?
              </p>
              <button
                type="button"
                onClick={openTodoPanel}
                className="st-btn self-start font-poppins"
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
                }}
              >
                Plan your day
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Progress bar */}
              <div
                className="h-1.5 w-full rounded-full overflow-hidden"
                style={{ background: "rgba(var(--fg-rgb),0.08)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(status.completed / status.total) * 100}%`,
                    background: status.allDone
                      ? "var(--accent-2)"
                      : "var(--accent)",
                    transition: "width 0.4s var(--ease)",
                  }}
                />
              </div>

              {todos.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    tap();
                    handleToggle(t);
                  }}
                  className="flex items-center gap-3 text-left"
                >
                  <span
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "7px",
                      border: t.done
                        ? "none"
                        : "1.5px solid rgba(var(--fg-rgb),0.25)",
                      background: t.done ? "var(--accent)" : "transparent",
                      transition: "background 160ms var(--ease)",
                    }}
                  >
                    {t.done && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="#fff"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span
                    className="font-poppins"
                    style={{
                      fontSize: "17px",
                      color: t.done
                        ? "rgba(var(--fg-rgb),0.35)"
                        : "rgb(var(--fg-rgb))",
                      textDecoration: t.done ? "line-through" : "none",
                    }}
                  >
                    {t.title}
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={openTodoPanel}
                className="self-start font-poppins uppercase mt-1"
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.15em",
                  color: "rgba(var(--fg-rgb),0.4)",
                }}
              >
                {status.allDone ? "Plan tomorrow →" : "Open list →"}
              </button>
            </div>
          )}
        </div>

        {/* ── Streak + stats ─────────────────────────────────────── */}
        <div>
          <p className={LABEL} style={LABEL_STYLE}>
            Your momentum
          </p>
          {streak > 0 && !status.allDone && status.total > 0 && (
            <div
              className="flex items-center gap-2 mb-4 px-4 py-3 rounded-[var(--radius-sm)]"
              style={{
                background: "rgba(var(--accent-rgb),0.08)",
                border: "0.5px solid rgba(var(--accent-rgb),0.2)",
              }}
            >
              <Flame size={16} className="text-[var(--accent)]" />
              <span
                className="font-poppins text-[rgb(var(--fg-rgb))]"
                style={{ fontSize: "14px" }}
              >
                Finish today&apos;s 3 things to keep your {streak}-day streak
                alive.
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Day streak" value={streak} unit="days" />
            <StatCard label="Focus time" value={focusHours} unit="hrs" />
            <StatCard label="Sessions" value={user.total_sessions} />
            <StatCard label="Category" value={user.category} />
          </div>
        </div>

        {/* ── Accountability partner ─────────────────────────────── */}
        <div>
          <p className={LABEL} style={LABEL_STYLE}>
            Accountability
          </p>
          {partner && partnerStatus ? (
            <Link
              href="/messages"
              className="st-card st-card-hover block bg-[var(--bg-surface)] px-5 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-poppins text-[rgb(var(--fg-rgb))]">
                  <span style={{ fontSize: "16px", fontWeight: 500 }}>
                    {partner.partner.username}
                  </span>
                  <FounderMark founderNumber={partner.partner.founder_number} />
                </span>
                <span
                  className="font-poppins"
                  style={{
                    fontSize: "14px",
                    color:
                      partnerStatus.total > 0 &&
                      partnerStatus.done === partnerStatus.total
                        ? "var(--accent-2)"
                        : "rgba(var(--fg-rgb),0.45)",
                  }}
                >
                  {partnerStatus.total > 0
                    ? `${partnerStatus.done}/${partnerStatus.total} today`
                    : "No plan yet"}
                </span>
              </div>
              <p
                className="font-poppins mt-2"
                style={{ fontSize: "13px", color: "rgba(var(--fg-rgb),0.4)" }}
              >
                You&apos;re at {status.completed}/{status.total || 0} — don&apos;t
                be the one who falls behind.
              </p>
            </Link>
          ) : (
            <Link
              href="/messages"
              className="st-card st-card-hover flex items-center justify-between bg-[var(--bg-surface)] px-5 py-4"
            >
              <span
                className="font-playfair italic text-[rgba(var(--fg-rgb),0.6)]"
                style={{ fontSize: "17px" }}
              >
                Find an accountability partner.
              </span>
              <ArrowRight
                size={18}
                className="text-[rgba(var(--fg-rgb),0.35)]"
              />
            </Link>
          )}
        </div>

        {/* ── What's live now ────────────────────────────────────── */}
        {liveSessions.length > 0 && (
          <div>
            <p className={LABEL} style={LABEL_STYLE}>
              Live now
            </p>
            <div className="flex flex-col gap-3">
              {liveSessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/work/${s.id}`}
                  className="st-card st-card-hover flex items-center justify-between bg-[var(--bg-surface)] px-5 py-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Radio
                      size={16}
                      className="text-[var(--accent)] shrink-0 animate-pulse"
                    />
                    <span
                      className="font-poppins text-[rgb(var(--fg-rgb))] truncate"
                      style={{ fontSize: "16px", fontWeight: 500 }}
                    >
                      {s.title}
                    </span>
                  </div>
                  <span
                    className="font-poppins shrink-0"
                    style={{
                      fontSize: "13px",
                      color: "rgba(var(--fg-rgb),0.4)",
                    }}
                  >
                    {s.member_count} in
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Recognition / first win ────────────────────────────── */}
        <div>
          <p className={LABEL} style={LABEL_STYLE}>
            Recognition
          </p>
          {!hasPostedWin ? (
            <div className="flex flex-col gap-4">
              <p
                className="font-playfair italic text-[rgba(var(--fg-rgb),0.55)]"
                style={{ fontSize: "20px" }}
              >
                You haven&apos;t shown the room what you&apos;ve done yet.
              </p>
              <button
                type="button"
                onClick={() => {
                  tap();
                  setPostOpen(true);
                }}
                className="st-btn self-start font-poppins"
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
                }}
              >
                Post your first win
              </button>
            </div>
          ) : lastWin ? (
            <Link
              href={`/wins/${lastWin.id}`}
              className="st-card st-card-hover flex items-center justify-between bg-[var(--bg-surface)] px-5 py-4"
            >
              <span className="min-w-0 flex flex-col">
                <span
                  className="font-poppins text-[rgb(var(--fg-rgb))] truncate"
                  style={{ fontSize: "16px", fontWeight: 500 }}
                >
                  {lastWin.title}
                </span>
                <span
                  className="font-poppins"
                  style={{
                    fontSize: "13px",
                    color: "rgba(var(--fg-rgb),0.4)",
                  }}
                >
                  {lastWin.reactions_count} reaction
                  {lastWin.reactions_count === 1 ? "" : "s"} from the room
                </span>
              </span>
              <ArrowRight
                size={18}
                className="text-[rgba(var(--fg-rgb),0.35)] shrink-0"
              />
            </Link>
          ) : null}
        </div>
      </div>

      {postOpen && (
        <PostWinModal
          onClose={() => setPostOpen(false)}
          onPosted={() => setPostOpen(false)}
        />
      )}
    </div>
  );
}
