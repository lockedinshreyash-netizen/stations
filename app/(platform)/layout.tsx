import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlatformShell from "@/components/layout/PlatformShell";
import type { User } from "@/types";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!profile) {
    // Auth exists but no profile yet — finish the value-first funnel.
    redirect("/onboarding/complete");
  }

  // ── FOUNDING 100 GATE (authoritative server-side check) ──────────────
  // During the founding launch, platform access is code-only. A profile alone
  // is not enough: the account must be a founding member (set exclusively by
  // the atomic claim_founder_code RPC) or an admin. Anyone else — a free/paid
  // account that never claimed a code, or a profile whose claim lost a race —
  // is held at the plan screen (where they can enter a code or wait for paid
  // to open). Read server-side on every request, so it can't be bypassed.
  if (profile.membership_tier !== "founding" && !profile.is_admin) {
    redirect("/onboarding/plan");
  }

  // ── FIRST-RUN GATE ───────────────────────────────────────────────────
  // A member who has never been through the welcome flow (set your 3 things +
  // introduce yourself in your room) is routed there once. The flow stamps
  // first_run_completed_at on finish, so it never replays. /onboarding/welcome
  // lives outside this route group, so this redirect can't loop.
  if (!profile.first_run_completed_at) {
    redirect("/onboarding/welcome");
  }

  return <PlatformShell user={profile as User}>{children}</PlatformShell>;
}
