import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  MOCK_EMBEDDING_MODEL,
  parseEmbeddingEnvironment,
} from "./config.ts";
import {
  DeterministicMockEmbeddingProvider,
  EmbeddingProviderError,
  createEmbeddingProvider,
  validateEmbeddingBatch,
} from "./provider.ts";

const baseEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder-value",
};

test("accepts a complete finite embedding batch", () => {
  const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.25);
  assert.doesNotThrow(() => validateEmbeddingBatch([embedding], 1));
});

test("rejects the wrong number of provider results", () => {
  assert.throws(
    () => validateEmbeddingBatch([], 1),
    (error: unknown) =>
      error instanceof EmbeddingProviderError &&
      error.code === "INVALID_EMBEDDING_RESPONSE",
  );
});

test("rejects malformed or non-finite vectors", () => {
  const wrongSize = Array.from({ length: EMBEDDING_DIMENSIONS - 1 }, () => 0.25);
  const nonFinite = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.25);
  nonFinite[10] = Number.NaN;

  assert.throws(() => validateEmbeddingBatch([wrongSize], 1));
  assert.throws(() => validateEmbeddingBatch([nonFinite], 1));
});

test("defaults to OpenAI and requires its API key", () => {
  const environment = parseEmbeddingEnvironment({
    ...baseEnvironment,
    OPENAI_API_KEY: "openai-placeholder-key-value",
  });

  assert.equal(environment.EMBEDDING_PROVIDER, "openai");
  assert.equal(environment.EMBEDDING_MODEL, DEFAULT_EMBEDDING_MODEL);
  assert.throws(
    () => parseEmbeddingEnvironment(baseEnvironment),
    /OPENAI_API_KEY is required/,
  );
});

test("mock mode needs no OpenAI key and uses an isolated model name", () => {
  const environment = parseEmbeddingEnvironment({
    ...baseEnvironment,
    EMBEDDING_PROVIDER: "mock",
    NODE_ENV: "development",
    OPENAI_API_KEY: "",
  });

  assert.equal(environment.EMBEDDING_PROVIDER, "mock");
  assert.equal(environment.EMBEDDING_MODEL, MOCK_EMBEDDING_MODEL);
  assert.equal(environment.OPENAI_API_KEY, undefined);
  assert.ok(createEmbeddingProvider(environment) instanceof DeterministicMockEmbeddingProvider);
});

test("mock mode is rejected in production and cannot use another model name", () => {
  assert.throws(
    () =>
      parseEmbeddingEnvironment({
        ...baseEnvironment,
        EMBEDDING_PROVIDER: "mock",
      }),
    /requires NODE_ENV=development or NODE_ENV=test/,
  );

  assert.throws(
    () =>
      parseEmbeddingEnvironment({
        ...baseEnvironment,
        EMBEDDING_PROVIDER: "mock",
        NODE_ENV: "production",
      }),
    /development-only/,
  );

  assert.throws(
    () =>
      parseEmbeddingEnvironment({
        ...baseEnvironment,
        EMBEDDING_MODEL: DEFAULT_EMBEDDING_MODEL,
        EMBEDDING_PROVIDER: "mock",
        NODE_ENV: "development",
      }),
    /prevent model mixing/,
  );
});

test("mock vectors are deterministic, finite, and text-dependent", async () => {
  const provider = new DeterministicMockEmbeddingProvider();
  const [first, repeated, different] = await provider.embed([
    "Certificazione ISO 9001",
    "Certificazione ISO 9001",
    "Polizza assicurativa professionale",
  ]);

  assert.equal(provider.model, MOCK_EMBEDDING_MODEL);
  assert.equal(first?.length, EMBEDDING_DIMENSIONS);
  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, different);
  assert.ok(first?.every(Number.isFinite));
});
