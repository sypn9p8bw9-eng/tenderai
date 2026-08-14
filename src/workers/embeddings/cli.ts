import { loadEnvFile } from "node:process";

import { parseEmbeddingEnvironment } from "./config.ts";
import { createEmbeddingProvider } from "./provider.ts";
import {
  createEmbeddingWorkerClient,
  createEmbeddingWorkerReference,
  processEmbeddingBatch,
} from "./worker.ts";

function loadLocalEnvironment() {
  try {
    loadEnvFile(".env.local");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function parseMaximumChunks(argumentsList: string[]) {
  const maxArgument = argumentsList.find((argument) => argument.startsWith("--max="));
  if (!maxArgument) return 32;

  const maximum = Number(maxArgument.slice("--max=".length));
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 100) {
    throw new Error("--max must be an integer between 1 and 100.");
  }

  return maximum;
}

async function main() {
  loadLocalEnvironment();

  const maximumChunks = parseMaximumChunks(process.argv.slice(2));
  const environment = parseEmbeddingEnvironment();
  if (environment.EMBEDDING_PROVIDER === "mock") {
    console.warn(
      "DEVELOPMENT ONLY: mock embeddings are deterministic test fixtures and are not semantically valid.",
    );
  }
  const provider = createEmbeddingProvider(environment);
  const result = await processEmbeddingBatch(
    createEmbeddingWorkerClient(),
    provider,
    createEmbeddingWorkerReference(),
    maximumChunks,
  );

  if (result.status === "idle") {
    console.info("Embedding worker finished: no eligible chunks found.");
    return;
  }

  if (result.status === "failed") {
    console.error(
      `Embedding worker failed ${result.chunkCount} chunks with ${result.errorCode}.`,
    );
    process.exitCode = 1;
    return;
  }

  console.info(`Embedding worker completed ${result.chunkCount} chunks.`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown worker error.";
  console.error(message);
  process.exitCode = 1;
});
