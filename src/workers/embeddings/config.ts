import { z } from "zod";

export const EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

const embeddingEnvironmentSchema = z.object({
  EMBEDDING_MODEL: z.string().trim().min(1).max(200).default(DEFAULT_EMBEDDING_MODEL),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  OPENAI_API_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export function parseEmbeddingEnvironment() {
  const parsed = embeddingEnvironmentSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      "Embedding worker configuration is missing or invalid. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, and optionally EMBEDDING_MODEL.",
    );
  }

  return parsed.data;
}
