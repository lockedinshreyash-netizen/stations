"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { categorizeUser } from "@/lib/utils/categorize";
import {
  loadFunnel,
  saveFunnel,
  type FunnelState,
  type RoleValue,
  type GoalValue,
} from "@/lib/onboarding/funnel";

const USERNAME_RE = /^[a-z0-9_]+$/;
const KNOWN_CATEGORY_ROOMS = ["scholar", "builder", "creator", "athlete"];

function suggestUsername(seed: string): string {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 18);
  return base.length >= 3 ? base : "";
}

/**
 * Profile completion — runs AFTER auth. Hydrates the anonymous funnel answers
 * (roles/goals/availability held in localStorage) into the real users row,
 * and collects the only PII we deferred: name + username. New accounts default
 * to the 'free' tier (the DB default); the only path to 'founding' is the
 * atomic claim on the next screen (/onboarding/plan).
 */
export default function CompleteProfile() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [funnel, setFunnel] = useState<FunnelState | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      const { data: existing } = await supabase
        .from("users")
        .select("full_name, username, avatar_url, role, goals")
        .eq("id", user.id)
        .maybeSingle();

      const meta = user.user_metadata ?? {};
      const metaName = (meta.full_name as string) || (meta.name as string) || "";
      const metaAvatar =
        (meta.avatar_url as string) || (meta.picture as string) || null;
      const f = loadFunnel();

      if (existing) {
        // Profile already exists (e.g. they walked back here from the plan
        // step). Edit mode: prefill from the saved profile and allow updates —
        // never auto-forward, or the back button would just bounce ahead.
        setIsEdit(true);
        setFullName(existing.full_name || metaName);
        setUsername(existing.username || suggestUsername(metaName));
        setAvatarUrl(existing.avatar_url || metaAvatar);
        // Prefer freshly re-picked funnel answers if present; otherwise seed
        // from the profile (and persist, so a back-step to /join restores the
        // current picks rather than a blank quiz).
        const nextFunnel: FunnelState =
          f.roles.length > 0 && f.goals.length > 0
            ? f
            : {
                roles: (existing.role ?? []) as RoleValue[],
                goals: (existing.goals ?? []) as GoalValue[],
                availability: null,
              };
        saveFunnel(nextFunnel);
        setFunnel(nextFunnel);
        setReady(true);
        return;
      }

      // New account: prefill from the OAuth identity and require the quiz.
      setFullName(metaName);
      setAvatarUrl(metaAvatar);
      setUsername(suggestUsername(metaName || user.email?.split("@")[0] || ""));
      if (f.roles.length === 0 || f.goals.length === 0) {
        router.replace("/join");
        return;
      }
      setFunnel(f);
      setReady(true);
    })();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!funnel) return;
    const name = fullName.trim();
    const handle = username.trim().toLowerCase();
    if (name.length < 2) return setError("Tell us your name.");
    if (handle.length < 3 || handle.length > 20 || !USERNAME_RE.test(handle))
      return setError("Username: 3–20 chars, lowercase letters, numbers, underscores.");

    setLoading(true);
    setError("");
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/join");
      return;
    }

    const { data: taken } = await supabase
      .from("users")
      .select("id")
      .eq("username", handle)
      .neq("id", user.id) // a username I already own isn't "taken"
      .maybeSingle();
    if (taken) {
      setError("That username is taken.");
      setLoading(false);
      return;
    }

    const category = categorizeUser(funnel.roles, funnel.goals);
    const categoryRoom = category.toLowerCase();
    const room_memberships = KNOWN_CATEGORY_ROOMS.includes(categoryRoom)
      ? ["collective", categoryRoom]
      : ["collective"];

    // Fields shared by create and edit. Tier/stats are never set here — tier
    // defaults to 'free' and founding is granted only by the claim RPC.
    const profileFields = {
      username: handle,
      full_name: name,
      avatar_url: avatarUrl,
      role: funnel.roles, // text[]
      goals: funnel.goals,
      category,
      room_memberships,
    };

    const { error: saveError } = isEdit
      ? await supabase.from("users").update(profileFields).eq("id", user.id)
      : await supabase.from("users").insert({
          id: user.id,
          ...profileFields,
          status: "active",
          is_admin: false,
          total_focus_minutes: 0,
          total_sessions: 0,
          streak_days: 0,
        });

    if (saveError) {
      setError("Couldn’t save your profile: " + saveError.message);
      setLoading(false);
      return;
    }

    router.push("/onboarding/plan");
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <span className="text-[rgba(var(--fg-rgb),0.4)] font-light">Setting up…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <header className="px-6 md:px-8 pt-8 flex items-center justify-between">
        <span className="font-poppins font-black text-xl tracking-widest uppercase text-[rgb(var(--fg-rgb))]">
          STATIONS
        </span>
        <button
          type="button"
          onClick={() => router.push("/join")}
          className="text-[rgba(var(--fg-rgb),0.3)] text-base font-light hover:text-[rgba(var(--fg-rgb),0.6)] transition-colors"
        >
          ← Back
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 md:px-8 py-12 max-w-lg mx-auto w-full">
        <h1 className="font-playfair italic text-4xl md:text-5xl text-[rgb(var(--fg-rgb))] mb-3 leading-tight">
          Last thing — who are you?
        </h1>
        <p className="text-[rgba(var(--fg-rgb),0.5)] font-light text-lg mb-10">
          This is how the room will know you.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-6">
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- remote Google avatar; next/image domain config not warranted here
            <img
              src={avatarUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover border border-[rgba(var(--fg-rgb),0.15)]"
            />
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[rgba(var(--fg-rgb),0.5)] text-sm tracking-widest uppercase font-light">
              Full name
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              placeholder="Your full name"
              className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-4 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[rgba(var(--fg-rgb),0.5)] text-sm tracking-widest uppercase font-light">
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              autoComplete="username"
              placeholder="lowercase_only"
              className="st-field bg-[var(--bg-surface)] text-[rgb(var(--fg-rgb))] px-4 py-4 text-base outline-none border border-[rgba(var(--fg-rgb),0.1)] focus:border-[var(--accent)] placeholder:text-[rgba(var(--fg-rgb),0.2)]"
            />
          </div>

          {error && <span className="text-[var(--accent)] text-base">{error}</span>}

          <button
            type="submit"
            disabled={loading}
            className="st-btn mt-2 bg-[rgb(var(--fg-rgb))] text-[var(--bg-primary)] font-poppins font-black tracking-widest uppercase text-base px-8 py-4 hover:bg-white disabled:opacity-40"
          >
            {loading ? "Creating…" : "Continue"}
          </button>
        </form>
      </main>
    </div>
  );
}
