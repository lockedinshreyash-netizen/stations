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
    // Auth exists but no profile yet — still in onboarding
    redirect("/onboarding/step-2");
  }

  // ── FOUNDING 100 GATE (authoritative server-side check) ──────────────
  // During the founding launch, platform access is code-only. A profile alone
  // is not enough: the account must be a founding member (set exclusively by
  // the atomic claim_founder_code RPC) or an admin. Anyone else — a free/paid
  // account that never claimed a code, or a profile whose claim lost a race —
  // is held at the founder-code step. This is read server-side from the DB on
  // every platform request, so it cannot be bypassed by client tampering.
  if (profile.membership_tier !== "founding" && !profile.is_admin) {
    redirect("/onboarding/founder");
  }

  return <PlatformShell user={profile as User}>{children}</PlatformShell>;
}
