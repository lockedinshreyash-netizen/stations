"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, ArrowRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { enablePush } from "@/lib/push/client";
import { fireCelebration } from "@/lib/celebrate";
import { tap } from "@/lib/feedback";

type ChecklistState = Record<string, boolean>;

// Ordered by quick-win first → momentum (Goal-Gradient).
const ITEMS = [
  { key: "profile_complete", label: "Complete your profile", hint: "Add a photo and a line about you" },
  { key: "post_win", label: "Post your first win", hint: "Show the room what you've shipped" },
  { key: "room_intro", label: "Introduce yourself", hint: "Say hello in your community room" },
  { key: "focus_session", label: "Join a focus session", hint: "Lock in with others in Work" },
  { key: "add_partner", label: "Add an accountability partner", hint: "Someone to keep you honest" },
  { key: "enable_notifications", label: "Turn on notifications", hint: "Never miss what matters" },
] as const;

const EXPAND_KEY = "stations_activation_expanded";

interface Props {
  initial: ChecklistState;
  dismissed: boolean;
  userId: string;
  /** Opens the PostWin modal owned by TodayHome. */
  onPostWin: () => void;
}

/**
 * Activation checklist — the member's "first moves", separate from the daily
 * task todos. Works for existing members too: each item is derived live, so it
 * reflects whatever they've already done. Deliberately a gentle nudge — a slim,
 * collapsed-by-default bar (not a setup wall) that's easy to dismiss for good.
 * Members who were already fully set up never see it.
 */
export default function ActivationChecklist({
  initial,
  dismissed,
  userId,
  onPostWin,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<ChecklistState>(initial);
  const [hidden, setHidden] = useState(dismissed);
  const [expanded, setExpanded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const celebrated = useRef(false);
  // Already done everything when the feature shipped → never nudge (and never
  // fire confetti just for loading the page).
  const startedComplete = useRef(ITEMS.every((i) => initial[i.key])).current;

  // Restore the expand preference (default collapsed = least intrusive).
  useEffect(() => {
    try {
      if (localStorage.getItem(EXPAND_KEY) === "1") setExpanded(true);
    } catch {
      /* ignore */
    }
  }, []);

  const doneCount = ITEMS.filter((i) => state[i.key]).length;
  const allDone = doneCount === ITEMS.length;

  useEffect(() => {
    if (allDone && !startedComplete && !celebrated.current) {
      celebrated.current = true;
      fireCelebration();
    }
  }, [allDone, startedComplete]);

  // Nothing to nudge: dismissed, already-complete members, or just finished
  // the last item this session (celebration above still fires, then it's gone).
  if (hidden || startedComplete || allDone) return null;

  function toggleExpand() {
    tap();
    setExpanded((v) => {
      const next = !v;
      try {
        localStorage.setItem(EXPAND_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function handle(key: string) {
    tap();
    if (state[key]) return;
    switch (key) {
      case "profile_complete":
        window.dispatchEvent(new CustomEvent("stations:open-profile"));
        break;
      case "post_win":
        onPostWin();
        break;
      case "room_intro":
        router.push("/network");
        break;
      case "focus_session":
        router.push("/work");
        break;
      case "add_partner":
        router.push("/network");
        break;
      case "enable_notifications":
        setBusyKey("enable_notifications");
        try {
          await enablePush();
          setState((s) => ({ ...s, enable_notifications: true }));
        } catch {
          /* surfaced by the standalone nudge; leave the item open */
        } finally {
          setBusyKey(null);
        }
        break;
    }
  }

  function dismiss() {
    tap();
    setHidden(true);
    const supabase = createClient();
    void supabase
      .from("users")
      .update({ activation_dismissed: true })
      .eq("id", userId);
  }

  return (
    <div
      className="st-card bg-[var(--bg-surface)] px-4 py-3"
      style={{ border: "0.5px solid rgba(var(--fg-rgb),0.08)" }}
    >
      {/* Compact header — always visible, glanceable, expandable. */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleExpand}
          className="flex items-center gap-2.5 flex-1 text-left"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          aria-expanded={expanded}
        >
          <span
            className="font-poppins uppercase text-[rgb(var(--fg-rgb))]"
            style={{ fontSize: "13px", letterSpacing: "0.12em", fontWeight: 500 }}
          >
            Get set up
          </span>
          <span
            className="font-poppins"
            style={{ fontSize: "13px", color: "rgba(var(--fg-rgb),0.4)" }}
          >
            {doneCount} of {ITEMS.length}
          </span>
          {expanded ? (
            <ChevronUp size={15} className="text-[rgba(var(--fg-rgb),0.4)]" />
          ) : (
            <ChevronDown size={15} className="text-[rgba(var(--fg-rgb),0.4)]" />
          )}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss setup checklist"
          title="Dismiss"
          className="shrink-0 text-[rgba(var(--fg-rgb),0.3)] hover:text-[rgba(var(--fg-rgb),0.6)]"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Slim progress — visible even when collapsed, so it nudges at a glance. */}
      <div
        className="h-1 w-full rounded-full overflow-hidden mt-2.5"
        style={{ background: "rgba(var(--fg-rgb),0.08)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${(doneCount / ITEMS.length) * 100}%`,
            background: "var(--accent)",
            transition: "width 0.4s var(--ease)",
          }}
        />
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 mt-4">
          {ITEMS.map((item) => {
            const done = !!state[item.key];
            const busy = busyKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handle(item.key)}
                disabled={done || busy}
                className="flex items-center gap-3 text-left px-3 py-2.5 rounded-[var(--radius-sm)]"
                style={{
                  background: "rgba(var(--fg-rgb),0.03)",
                  cursor: done ? "default" : "pointer",
                  opacity: done ? 0.6 : 1,
                }}
              >
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "6px",
                    border: done ? "none" : "1.5px solid rgba(var(--fg-rgb),0.25)",
                    background: done ? "var(--accent)" : "transparent",
                  }}
                >
                  {done && <Check size={12} strokeWidth={3} color="#fff" />}
                </span>
                <span className="flex flex-col min-w-0 flex-1">
                  <span
                    className="font-poppins"
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: done ? "rgba(var(--fg-rgb),0.5)" : "rgb(var(--fg-rgb))",
                      textDecoration: done ? "line-through" : "none",
                    }}
                  >
                    {item.label}
                  </span>
                  {!done && (
                    <span
                      className="font-poppins font-light"
                      style={{ fontSize: "12px", color: "rgba(var(--fg-rgb),0.4)" }}
                    >
                      {busy ? "Enabling…" : item.hint}
                    </span>
                  )}
                </span>
                {!done && !busy && (
                  <ArrowRight size={15} className="text-[rgba(var(--fg-rgb),0.3)] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
