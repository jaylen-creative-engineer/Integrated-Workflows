import { createClient } from "@supabase/supabase-js";

let supabaseAdmin = null;

/**
 * Returns a singleton Supabase client configured with the service-role key.
 * Server-only; do not import in client components.
 */
export function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable"
    );
  }

  supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "integrated-workflows/energy-sync",
      },
    },
  });

  return supabaseAdmin;
}
