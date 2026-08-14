import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "../../types/database.ts";
import { parseEmbeddingEnvironment } from "./config.ts";
import {
  EmbeddingProviderError,
  type EmbeddingProvider,
} from "./provider.ts";

type WorkerClient = SupabaseClient<Database>;
type ClaimedChunk =
  Database["public"]["Functions"]["claim_document_embedding_batch"]["Returns"][number];

export type EmbeddingWorkerResult =
  | { status: "idle" }
  | { chunkCount: number; status: "completed" }
  | { chunkCount: number; errorCode: string; status: "failed" };

class EmbeddingWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "EmbeddingWorkerError";
  }
}

export function createEmbeddingWorkerClient(): WorkerClient {
  const environment = parseEmbeddingEnvironment();

  return createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

export function createEmbeddingWorkerReference() {
  return `embeddings:${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
}

async function claimBatch(
  client: WorkerClient,
  model: string,
  workerReference: string,
  limit: number,
) {
  const { data, error } = await client.rpc("claim_document_embedding_batch", {
    p_limit: limit,
    p_model: model,
    p_worker_reference: workerReference,
  });

  if (error) {
    throw new EmbeddingWorkerError(
      "EMBEDDING_CLAIM_FAILED",
      `Unable to claim document chunks for embedding: ${error.message}`,
    );
  }

  return data ?? [];
}

async function completeBatch(
  client: WorkerClient,
  provider: EmbeddingProvider,
  workerReference: string,
  chunks: ClaimedChunk[],
  embeddings: number[][],
) {
  const payload: Json = chunks.map((chunk, index) => ({
    chunk_id: chunk.chunk_id,
    embedding: embeddings[index],
  }));

  const { error } = await client.rpc("complete_document_embedding_batch", {
    p_embeddings: payload,
    p_model: provider.model,
    p_worker_reference: workerReference,
  });

  if (error) {
    throw new EmbeddingWorkerError(
      "EMBEDDING_PERSIST_FAILED",
      `Unable to persist the embedding batch: ${error.message}`,
    );
  }
}

async function failBatch(
  client: WorkerClient,
  provider: EmbeddingProvider,
  workerReference: string,
  chunks: ClaimedChunk[],
  failure: EmbeddingWorkerError,
) {
  const { error } = await client.rpc("fail_document_embedding_batch", {
    p_chunk_ids: chunks.map((chunk) => chunk.chunk_id),
    p_error_code: failure.code,
    p_error_message: failure.message.slice(0, 1000),
    p_model: provider.model,
    p_worker_reference: workerReference,
  });

  if (error) {
    throw new Error(
      `Embedding batch failed with ${failure.code}, but its failure state could not be persisted: ${error.message}`,
    );
  }
}

function asWorkerFailure(error: unknown) {
  if (error instanceof EmbeddingWorkerError) return error;
  if (error instanceof EmbeddingProviderError) {
    return new EmbeddingWorkerError(error.code, error.message);
  }

  return new EmbeddingWorkerError(
    "EMBEDDING_PROCESSING_FAILED",
    "The embedding batch failed unexpectedly.",
  );
}

export async function processEmbeddingBatch(
  client: WorkerClient,
  provider: EmbeddingProvider,
  workerReference: string,
  limit: number,
): Promise<EmbeddingWorkerResult> {
  const chunks = await claimBatch(client, provider.model, workerReference, limit);
  if (chunks.length === 0) return { status: "idle" };

  try {
    const embeddings = await provider.embed(chunks.map((chunk) => chunk.chunk_text));
    await completeBatch(client, provider, workerReference, chunks, embeddings);
    return { chunkCount: chunks.length, status: "completed" };
  } catch (error) {
    const failure = asWorkerFailure(error);
    await failBatch(client, provider, workerReference, chunks, failure);
    return {
      chunkCount: chunks.length,
      errorCode: failure.code,
      status: "failed",
    };
  }
}
