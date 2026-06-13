import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth (and email-link) callback. Supabase redirects here with a `?code=`
 * after the provider flow; we exchange it for a session (writing the auth
 * cookies via the SSR server client) and then forward the user on.
 *
 * `next` controls the destination — the funnel sends new sign-ups to
 * /onboarding/complete (create profile), while a returning member's session
 * is resolved there too and bounced onward by the platform gate.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding/complete";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Allow only same-origin relative paths to prevent open-redirects.
      const dest = next.startsWith("/") ? next : "/onboarding/complete";
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
