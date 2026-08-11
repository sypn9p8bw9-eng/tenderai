import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnvironment } from "@/lib/env";
import type { Database } from "@/types/database";

/** Creates a browser client with only the browser-safe publishable key. */
export function createSupabaseBrowserClient() {
  const environment = getSupabaseEnvironment();

  return createBrowserClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
