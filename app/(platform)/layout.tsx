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

  return <PlatformShell user={profile as User}>{children}</PlatformShell>;
}
