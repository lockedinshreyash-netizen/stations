import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // New / logged-out visitors start the value-first funnel; members go in.
  redirect(user ? "/wins" : "/join");
}
