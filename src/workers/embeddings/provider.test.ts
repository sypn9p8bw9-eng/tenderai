import assert from "node:assert/strict";
import test from "node:test";

import { EMBEDDING_DIMENSIONS } from "./config.ts";
import {
  EmbeddingProviderError,
  validateEmbeddingBatch,
} from "./provider.ts";

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
