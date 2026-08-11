import { z } from "zod";

const supabaseEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type SupabaseEnvironment = z.infer<typeof supabaseEnvironmentSchema>;

/**
 * Validates configuration at the point a Supabase client is requested so the
 * application can still build before a Supabase project has been provisioned.
 */
export function getSupabaseEnvironment(): SupabaseEnvironment {
  return supabaseEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
