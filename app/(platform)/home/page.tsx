import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TodayHome from "@/components/home/TodayHome";
import type { DmParticipant, PartnerTodo, Todo, User } from "@/types";
import type { LiveSession } from "@/components/home/TodayHome";

/** "Today" as a UTC date string, matching the DB's current_date (Supabase=UTC). */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Daily-ritual streak: consecutive days (ending today or yesterday) on which
 * the member completed their plan. Computed from daily_plan_completions, the
 * once-per-day marker written when a plan is fully checked off. Today being
 * absent doesn't break the streak — the day isn't over yet.
 */
function computeStreak(planDates: string[]): number {
  const days = new Set(planDates);
  const cursor = new Date();
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/**
 * The platform hub. Everything here is the member's own day made visible: their
 * 3 things, their streak, their partner's progress, what's live now, and their
 * recognition. Fetched server-side so the client component never mount-fetches
 * (the repo lints react-hooks/set-state-in-effect as an error). Every
 * supplemental query degrades to empty if its table/RPC isn't there yet (the
 * todos/partnerships/work_sessions migrations ship separately), so the hub
 * always renders.
 */
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
  if (!profile) redirect("/onboarding/complete");

  const user = profile as User;
  const today = todayUTC();

  // ── Today's 3 things ────────────────────────────────────────────────
  const { data: todoRows } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", user.id)
    .eq("planned_for", today)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const todayTodos = (todoRows as Todo[]) ?? [];

  // ── Streak (from completion markers) ────────────────────────────────
  const { data: completionRows } = await supabase
    .from("daily_plan_completions")
    .select("plan_date")
    .eq("user_id", user.id)
    .order("plan_date", { ascending: false })
    .limit(400);
  const streak = computeStreak(
    ((completionRows as { plan_date: string }[]) ?? []).map((r) => r.plan_date)
  );

  // ── Accountability partner + their plan ─────────────────────────────
  const { data: partnerRows } = await supabase
    .from("partnerships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .limit(1);
  let partner: { partner: DmParticipant; plan: PartnerTodo[] } | null = null;
  const firstPartnership = (
    partnerRows as { requester_id: string; addressee_id: string }[] | null
  )?.[0];
  if (firstPartnership) {
    const otherId =
      firstPartnership.requester_id === user.id
        ? firstPartnership.addressee_id
        : firstPartnership.requester_id;
    const { data: partnerProfile } = await supabase
      .from("users")
      .select("id, username, avatar_url, founder_number")
      .eq("id", otherId)
      .maybeSingle();
    if (partnerProfile) {
      const { data: planRows } = await supabase.rpc("get_partner_today_plan", {
        partner_id: otherId,
      });
      partner = {
        partner: partnerProfile as DmParticipant,
        plan: (planRows as PartnerTodo[]) ?? [],
      };
    }
  }

  // ── What's live now (active co-working sessions) ────────────────────
  const { data: sessionRows } = await supabase
    .from("work_sessions")
    .select(
      "id, title, category, host:users!work_sessions_host_id_fkey(username), members:work_session_members(count)"
    )
    .eq("status", "active")
    .order("scheduled_start_time", { ascending: true })
    .limit(5);
  const liveSessions: LiveSession[] = (
    (sessionRows as
      | {
          id: string;
          title: string;
          category: string;
          host: { username: string } | null;
          members: { count: number }[] | null;
        }[]
      | null) ?? []
  ).map((s) => ({
    id: s.id,
    title: s.title,
    category: s.category,
    host_username: s.host?.username ?? "member",
    member_count: s.members?.[0]?.count ?? 0,
  }));

  // ── Recognition (the member's latest win + its reactions) ───────────
  const { data: winRows } = await supabase
    .from("wins")
    .select("id, title, reactions_count")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const wins = (winRows as { id: string; title: string; reactions_count: number }[]) ?? [];
  const lastWin = wins[0] ?? null;

  // ── Activation checklist (separate from the daily task todos) ───────
  const { data: activationData } = await supabase.rpc("get_activation_checklist");
  const activation = (activationData as Record<string, boolean>) ?? {};

  return (
    <TodayHome
      user={user}
      todayTodos={todayTodos}
      streak={streak}
      partner={partner}
      liveSessions={liveSessions}
      lastWin={lastWin}
      hasPostedWin={wins.length > 0}
      activation={activation}
      activationDismissed={user.activation_dismissed ?? false}
    />
  );
}
