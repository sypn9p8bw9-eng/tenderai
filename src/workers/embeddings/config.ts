import { z } from "zod";

export const EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const MOCK_EMBEDDING_MODEL = "mock-local-1536";

export type EmbeddingEnvironment =
  | {
      EMBEDDING_MODEL: string;
      EMBEDDING_PROVIDER: "openai";
      NEXT_PUBLIC_SUPABASE_URL: string;
      OPENAI_API_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
    }
  | {
      EMBEDDING_MODEL: typeof MOCK_EMBEDDING_MODEL;
      EMBEDDING_PROVIDER: "mock";
      NEXT_PUBLIC_SUPABASE_URL: string;
      OPENAI_API_KEY?: undefined;
      SUPABASE_SERVICE_ROLE_KEY: string;
    };

const optionalEnvironmentValue = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().trim().optional(),
);

const embeddingEnvironmentSchema = z.object({
  EMBEDDING_MODEL: optionalEnvironmentValue.pipe(
    z.string().min(1).max(200).optional(),
  ),
  EMBEDDING_PROVIDER: z.enum(["openai", "mock"]).default("openai"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  OPENAI_API_KEY: optionalEnvironmentValue.pipe(z.string().min(20).optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export function parseEmbeddingEnvironment(
  environment: Record<string, string | undefined> = process.env,
): EmbeddingEnvironment {
  const parsed = embeddingEnvironmentSchema.safeParse(environment);

  if (!parsed.success) {
    throw new Error(
      "Embedding configuration is missing or invalid. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMBEDDING_PROVIDER, and the provider-specific values.",
    );
  }

  if (parsed.data.EMBEDDING_PROVIDER === "mock") {
    if (!parsed.data.NODE_ENV || !["development", "test"].includes(parsed.data.NODE_ENV)) {
      throw new Error(
        "EMBEDDING_PROVIDER=mock is development-only and requires NODE_ENV=development or NODE_ENV=test.",
      );
    }

    const model = parsed.data.EMBEDDING_MODEL ?? MOCK_EMBEDDING_MODEL;
    if (model !== MOCK_EMBEDDING_MODEL) {
      throw new Error(
        `The mock provider must use EMBEDDING_MODEL=${MOCK_EMBEDDING_MODEL} to prevent model mixing.`,
      );
    }

    return {
      EMBEDDING_MODEL: MOCK_EMBEDDING_MODEL,
      EMBEDDING_PROVIDER: "mock",
      NEXT_PUBLIC_SUPABASE_URL: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  if (!parsed.data.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai.",
    );
  }

  return {
    EMBEDDING_MODEL: parsed.data.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
    EMBEDDING_PROVIDER: "openai",
    NEXT_PUBLIC_SUPABASE_URL: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    OPENAI_API_KEY: parsed.data.OPENAI_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  };
}
