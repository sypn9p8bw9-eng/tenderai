import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnvironment } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Creates a request-scoped server client. Auth/session middleware is
 * intentionally deferred until authentication is introduced.
 */
export async function createSupabaseServerClient() {
  const environment = getSupabaseEnvironment();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          void headers;
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot set cookies. A future proxy will handle
            // session refreshes for authenticated requests.
          }
        },
      },
    },
  );
}
