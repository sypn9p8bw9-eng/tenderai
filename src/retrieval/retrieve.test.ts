import assert from "node:assert/strict";
import test from "node:test";

import { EMBEDDING_DIMENSIONS } from "../workers/embeddings/config.ts";
import { retrievalInputSchema, serializeEmbedding } from "./retrieve.ts";

test("accepts bounded tenant-scoped retrieval input", () => {
  const result = retrievalInputSchema.parse({
    organizationId: "e3980a5a-aeca-49eb-8eda-45857235bc8e",
    query: "certificazione ISO 9001",
  });

  assert.equal(result.source, "all");
  assert.equal(result.topK, 5);
});

test("rejects invalid source filters and unbounded top-k values", () => {
  assert.throws(() =>
    retrievalInputSchema.parse({
      organizationId: "e3980a5a-aeca-49eb-8eda-45857235bc8e",
      query: "certificazione ISO 9001",
      source: "another-tenant",
      topK: 500,
    }),
  );
});

test("serializes only finite vectors with the database dimension", () => {
  const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5);
  const serialized = serializeEmbedding(embedding);

  assert.ok(serialized.startsWith("[0.5,0.5"));
  assert.ok(serialized.endsWith("]"));
  assert.throws(() => serializeEmbedding([0.5]));
});
