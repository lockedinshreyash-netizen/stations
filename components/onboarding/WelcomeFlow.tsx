"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createTodo } from "@/lib/todos/queries";
import { fireCelebration } from "@/lib/celebrate";
import { tap } from "@/lib/feedback";
import FounderMark from "@/components/ui/FounderMark";
import {
  categoryRoom,
  COLLECTIVE,
  ROOM_META,
  sendMessage,
  MAX_MESSAGE_LENGTH,
  type RoomName,
} from "@/lib/firebase/rooms";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  pushSupported,
  permissionState,
  enablePush,
  PushError,
} from "@/lib/push/client";
import type { UserCategory } from "@/types";

type Step = "identity" | "plan" | "intro" | "notify";
const ORDER: Step[] = ["identity", "plan", "intro", "notify"];

/** The minimal profile the welcome flow needs to personalize + post. */
interface WelcomeProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  category: UserCategory;
  founder_number: number | null;
}

/**
 * First-run welcome flow — runs once, immediately after a member enters the
 * platform (founder claim, or any founding/admin account that hasn't completed
 * it). Three steps that each seed a return loop:
 *   1. identity — "you're in", reinforce the founder number (status).
 *   2. plan     — set today's 3 things (seeds the daily ritual).
 *   3. intro    — say hello in your room (seeds belonging + a first reply).
 * On finish it stamps users.first_run_completed_at so it never replays, then
 * hands off to /home. The (platform) layout redirects here until that's set.
 */
export default function WelcomeFlow() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<WelcomeProfile | null>(null);
  const [step, setStep] = useState<Step>("identity");

  // Step 2 — today's 3 things.
  const [things, setThings] = useState(["", "", ""]);
  // Step 3 — the hello message.
  const [hello, setHello] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Step 4 — turn on notifications.
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifError, setNotifError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/join");
        return;
      }
      const { data: row } = await supabase
        .from("users")
        .select(
          "id, username, avatar_url, category, founder_number, membership_tier, is_admin, first_run_completed_at"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (!row) {
        router.replace("/onboarding/complete");
        return;
      }
      // Mirrors the platform gate: only founders/admins are inside during the
      // founding window; everyone else belongs on the plan screen.
      if (row.membership_tier !== "founding" && !row.is_admin) {
        router.replace("/onboarding/plan");
        return;
      }
      // Already done — don't replay; go straight to the hub.
      if (row.first_run_completed_at) {
        router.replace("/home");
        return;
      }
      setProfile({
        id: row.id,
        username: row.username,
        avatar_url: row.avatar_url,
        category: row.category as UserCategory,
        founder_number: row.founder_number,
      });
      setReady(true);
      // The "you're in" moment — fire the station celebration once.
      fireCelebration();
    })();
  }, [router]);

  const stepIndex = ORDER.indexOf(step);
  const room: RoomName = profile
    ? categoryRoom(profile.category) ?? COLLECTIVE
    : COLLECTIVE;
  const roomMeta = ROOM_META[room];

  function go(next: Step) {
    setError("");
    setStep(next);
  }

  async function saveThings() {
    if (!profile) return;
    const filled = things.map((t) => t.trim()).filter(Boolean);
    if (filled.length === 0) {
      setError("Name at least one thing you'll do today.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Sequential so sort_order stays in the order they typed them.
      for (const title of filled) {
        await createTodo(profile.id, title, { planForToday: true });
      }
      go("intro");
    } catch {
      setError("Couldn't save your plan. Try again.");
    } finally {
      setSaving(false);
    }
  }

  /** Stamp first-run as complete and hand off to the hub. */
  async function finish() {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("users")
      .update({ first_run_completed_at: new Date().toISOString() })
      .eq("id", profile.id);
    router.replace("/home");
  }

  async function postHelloThenNotify() {
    if (!profile) return;
    const content = hello.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!content) {
      setError("Write a line to say hello — or skip for now.");
      return;
    }
    setSaving(true);
    setError("");
    // Best-effort: if chat isn't configured, we still advance the flow.
    if (isFirebaseConfigured) {
      try {
        await sendMessage(room, {
          user_id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          category: profile.category,
          founder_number: profile.founder_number,
          content,
        });
        // Credit the "introduce yourself" activation item (Firebase has no
        // server signal we can read, so we stamp it right after a successful post).
        const supabase = createClient();
        await supabase
          .rpc("complete_activation_task", { p_item_key: "room_intro" })
          .then(() => {}, () => {});
      } catch {
        /* don't trap the user on a chat hiccup */
      }
    }
    setSaving(false);
    proceedToNotify();
  }

  /** Only show the notifications step when we can actually ask (fresh permission
   * + supported); otherwise complete onboarding straight away. */
  function proceedToNotify() {
    if (!pushSupported() || permissionState() !== "default") {
      void finish();
      return;
    }
    go("notify");
  }

  async function enableNotifsThenFinish() {
    setNotifBusy(true);
    setNotifError("");
    try {
      await enablePush();
    } catch (e) {
      // Never trap the user on the notification step.
      if (permissionState() === "denied") {
        await finish();
        return;
      }
      setNotifError(
        e instanceof PushError
          ? e.message
          : "Couldn't enable notifications. You can turn them on later in settings."
      );
      setNotifBusy(false);
      return;
    }
    await finish();
  }

  if (!ready || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <span className="text-[rgba(var(--fg-rgb),0.4)] font-light">
          Entering…
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      {/* Wordmark + thin progress. Back appears after the identity step. */}
      <header className="px-6 md:px-8 pt-8 flex items-center justify-between">
        <span className="font-poppins font-black text-xl tracking-widest uppercase text-[rgb(var(--fg-rgb))]">
          STATIONS
        </span>
        {step !== "identity" && (
          <button
            type="button"
            onClick={() => go(ORDER[Math.max(0, stepIndex - 1)])}
            className="text-[rgba(var(--fg-rgb),0.3)] text-base font-light hover:text-[rgba(var(--fg-rgb),0.6)] transition-colors"
          >
            ← Back
          </button>
        )}
      </header>

      <div className="px-6 md:px-8 mt-6">
        <div className="flex gap-2">
          {ORDER.map((_, i) => (
            <div
              key={i}
              className="h-[3px] flex-1 rounded-full transition-all duration-500"
              style={{
                background:
                  i <= stepIndex ? "var(--accent)" : "rgba(var(--fg-rgb),0.1)",
              }}
            />
          ))}
        </div>
      </div>

      <main className="flex-1 flex flex-col justify-center px-6 md:px-8 py-12 max-w-lg mx-auto w-full">
        {/* ── IDENTITY ──────────────────────────────────────────── */}
        {step === "identity" && (
          <div className="flex flex-col">
            {profile.founder_number ? (
              <span className="flex items-center gap-2 font-poppins uppercase tracking-[0.2em] text-sm text-[var(--accent)] mb-6">
                <FounderMark founderNumber={profile.founder_number} />
                Founding Cohort · No.{" "}
                {String(profile.founder_number).padStart(3, "0")}
              </span>
            ) : (
              <span className="font-poppins uppercase tracking-[0.2em] text-sm text-[var(--accent)] mb-6">
                Welcome
              </span>
            )}
            <h1 className="font-playfair italic text-5xl md:text-6xl text-[rgb(var(--fg-rgb))] leading-[1.05] mb-5">
              You&apos;re in, {profile.username}.
            </h1>
            <p className="text-[rgba(var(--fg-rgb),0.55)] font-light text-lg mb-10 leading-relaxed">
              This isn&apos;t a feed to scroll. It&apos;s a place to do the work
              and be seen doing it. Two quick things and you&apos;re moving.
            </p>
            <button
              type="button"
              onClick={() => {
                tap();
                go("plan");
              }}
              className="st-btn bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white"
            >
              Begin
            </button>
          </div>
        )}

        {/* ── PLAN (today's 3 things) ───────────────────────────── */}
        {step === "plan" && (
          <div className="flex flex-col">
            <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
              What 3 things will you do today?
            </h1>
            <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-8">
              This is your day, on the record. Come back tonight and check them
              off — that&apos;s the habit the whole place runs on.
            </p>

            <div className="flex flex-col gap-3">
              {things.map((value, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span
                    className="font-poppins shrink-0 text-[rgba(var(--fg-rgb),0.3)]"
                    style={{ fontSize: "15px", width: "18px" }}
                  >
                    {i + 1}
                  </span>
                  <input
                    value={value}
                    onChange={(e) =>
                      setThings((prev) =>
                        prev.map((t, j) => (j === i ? e.target.value : t))
                      )
                    }
                    autoFocus={i === 0}
                    maxLength={200}
                    placeholder={
                      i === 0
                        ? "The one that matters most"
                        : "Add another (optional)"
                    }
                    className="st-field flex-1 bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-3.5 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)]"
                  />
                </div>
              ))}
            </div>

            {error && (
              <span className="text-[var(--accent)] text-base mt-4">{error}</span>
            )}

            <button
              type="button"
              onClick={() => {
                tap();
                saveThings();
              }}
              disabled={saving}
              className="st-btn mt-8 bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white disabled:opacity-40"
            >
              {saving ? "Saving…" : "Lock it in"}
            </button>
          </div>
        )}

        {/* ── INTRO (say hello in your room) ────────────────────── */}
        {step === "intro" && (
          <div className="flex flex-col">
            <span className="font-poppins uppercase tracking-[0.2em] text-sm text-[var(--accent)] mb-4">
              {roomMeta.title}
            </span>
            <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
              Introduce yourself.
            </h1>
            <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-8">
              {roomMeta.description} Say one line about who you are and what
              you&apos;re working on — the room is waiting.
            </p>

            <textarea
              value={hello}
              onChange={(e) => setHello(e.target.value)}
              autoFocus
              rows={3}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Hey, I'm…"
              className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-3.5 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)] resize-none"
            />

            {error && (
              <span className="text-[var(--accent)] text-base mt-4">{error}</span>
            )}

            <button
              type="button"
              onClick={() => {
                tap();
                postHelloThenNotify();
              }}
              disabled={saving}
              className="st-btn mt-8 bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white disabled:opacity-40"
            >
              {saving ? "Posting…" : "Post & continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                tap();
                proceedToNotify();
              }}
              disabled={saving}
              className="mt-5 text-center text-[rgba(var(--fg-rgb),0.4)] text-base font-light hover:text-[rgba(var(--fg-rgb),0.7)] transition-colors disabled:opacity-40"
            >
              I&apos;ll say hello later →
            </button>
          </div>
        )}

        {/* ── NOTIFY (turn on notifications) ─────────────────────── */}
        {step === "notify" && (
          <div className="flex flex-col">
            <span className="font-poppins uppercase tracking-[0.2em] text-sm text-[var(--accent)] mb-4">
              One last thing
            </span>
            <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
              Don&apos;t miss what matters.
            </h1>
            <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-8">
              Turn on notifications and we&apos;ll ping you when your partner
              replies, a session goes live, or the room reacts to your win. No
              spam — just the moments worth showing up for.
            </p>

            {notifError && (
              <span className="text-[var(--accent)] text-base mb-4">
                {notifError}
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                tap();
                enableNotifsThenFinish();
              }}
              disabled={notifBusy}
              className="st-btn bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white disabled:opacity-40"
            >
              {notifBusy ? "Turning on…" : "Turn on notifications"}
            </button>
            <button
              type="button"
              onClick={() => {
                tap();
                finish();
              }}
              disabled={notifBusy}
              className="mt-5 text-center text-[rgba(var(--fg-rgb),0.4)] text-base font-light hover:text-[rgba(var(--fg-rgb),0.7)] transition-colors disabled:opacity-40"
            >
              Maybe later →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
