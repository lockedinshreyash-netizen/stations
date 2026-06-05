import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/ui/StatCard";
import LeafShadow from "@/components/layout/LeafShadow";
import type { User } from "@/types";

export default async function PlatformHome() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!profile) redirect("/onboarding/step-2");

  const user = profile as User;
  const focusHours = Math.floor(user.total_focus_minutes / 60);
  const roles = Array.isArray(user.role) ? (user.role as string[]) : [user.role];

  return (
    <div>
      {/* Editorial header — same treatment as station pages */}
      <div className="px-5 md:px-10 pt-12 pb-10 md:pt-16 md:pb-12 border-b border-[rgba(var(--fg-rgb),0.06)]">
        <p
          className="font-playfair italic text-[rgba(var(--fg-rgb),0.4)]"
          style={{ fontSize: "15px", marginBottom: "8px" }}
        >
          Welcome back —
        </p>
        <h1
          className="font-poppins font-black uppercase text-[rgb(var(--fg-rgb))] leading-none break-words"
          style={{ fontSize: "clamp(48px, 12vw, 140px)", letterSpacing: "0.03em" }}
        >
          {user.username.toUpperCase()}
          <span className="text-[var(--accent)]">.</span>
        </h1>
        <p
          className="font-playfair italic text-[rgba(var(--fg-rgb),0.35)] mt-4"
          style={{ fontSize: "19px", lineHeight: 1.5 }}
        >
          {user.category} · {roles.join(", ")}
        </p>
      </div>

      {/* Dashboard content */}
      <div className="px-5 md:px-10 py-12 max-w-3xl flex flex-col" style={{ gap: "56px" }}>

        {/* Stats */}
        <div>
          <p
            className="font-poppins font-light uppercase text-[rgba(var(--fg-rgb),0.25)] mb-5"
            style={{ fontSize: "14px", letterSpacing: "0.2em" }}
          >
            Your stats
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Focus time" value={focusHours} unit="hrs" />
            <StatCard label="Sessions" value={user.total_sessions} />
            <StatCard label="Streak" value={user.streak_days} unit="days" />
            <StatCard label="Category" value={user.category} />
          </div>
        </div>

        {/* Active challenges */}
        <div>
          <p
            className="font-poppins font-light uppercase text-[rgba(var(--fg-rgb),0.25)] mb-5"
            style={{ fontSize: "14px", letterSpacing: "0.2em" }}
          >
            Active challenges
          </p>
          <p
            className="font-playfair italic text-[rgba(var(--fg-rgb),0.2)]"
            style={{ fontSize: "18px" }}
          >
            No active challenges.
          </p>
        </div>

        {/* Recent wins */}
        <div>
          <p
            className="font-poppins font-light uppercase text-[rgba(var(--fg-rgb),0.25)] mb-5"
            style={{ fontSize: "14px", letterSpacing: "0.2em" }}
          >
            Recent wins
          </p>
          <p
            className="font-playfair italic text-[rgba(var(--fg-rgb),0.2)]"
            style={{ fontSize: "18px" }}
          >
            No wins yet.{" "}
            <a
              href="/wins"
              className="text-[rgba(var(--fg-rgb),0.35)] underline underline-offset-4 hover:text-[rgb(var(--fg-rgb))] transition-colors"
            >
              Post your first win.
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
