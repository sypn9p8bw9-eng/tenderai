import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "../types/database.ts";
import { EMBEDDING_DIMENSIONS } from "../workers/embeddings/config.ts";
import {
  type EmbeddingProvider,
  validateEmbeddingBatch,
} from "../workers/embeddings/provider.ts";

export const retrievalInputSchema = z.object({
  organizationId: z.uuid(),
  query: z.string().trim().min(2).max(8000),
  source: z.enum(["all", "evidence", "tender"]).default("all"),
  topK: z.number().int().min(1).max(50).default(5),
});

export type RetrievalInput = z.infer<typeof retrievalInputSchema>;
export type RetrievalResult =
  Database["public"]["Functions"]["match_document_chunks"]["Returns"][number];

export function serializeEmbedding(embedding: readonly number[]) {
  validateEmbeddingBatch([embedding], 1, EMBEDDING_DIMENSIONS);
  return `[${embedding.join(",")}]`;
}

export async function retrieveDocumentChunks(
  client: SupabaseClient<Database>,
  provider: EmbeddingProvider,
  input: RetrievalInput,
): Promise<RetrievalResult[]> {
  const validated = retrievalInputSchema.parse(input);
  const [queryEmbedding] = await provider.embed([validated.query]);

  if (!queryEmbedding) {
    throw new Error("The embedding provider did not return a query vector.");
  }

  const { data, error } = await client.rpc("match_document_chunks", {
    p_model: provider.model,
    p_organization_id: validated.organizationId,
    p_query_embedding: serializeEmbedding(queryEmbedding),
    p_source: validated.source,
    p_top_k: validated.topK,
  });

  if (error) {
    throw new Error(`Semantic retrieval failed: ${error.message}`);
  }

  return data ?? [];
}
