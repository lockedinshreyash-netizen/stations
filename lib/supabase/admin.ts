import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for trusted server contexts ONLY (API route
 * handlers reached via the push pipeline). It bypasses Row Level Security, so
 * it must never be imported into client code or used to act on behalf of an
 * unauthenticated request without its own authorization check.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
