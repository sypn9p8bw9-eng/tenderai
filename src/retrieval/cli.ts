import { loadEnvFile } from "node:process";

import { retrieveDocumentChunks, retrievalInputSchema } from "./retrieve.ts";
import { parseEmbeddingEnvironment } from "../workers/embeddings/config.ts";
import { OpenAIEmbeddingProvider } from "../workers/embeddings/provider.ts";
import { createEmbeddingWorkerClient } from "../workers/embeddings/worker.ts";

function loadLocalEnvironment() {
  try {
    loadEnvFile(".env.local");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function readArgument(argumentsList: string[], name: string) {
  const prefix = `--${name}=`;
  return argumentsList.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function parseArguments(argumentsList: string[]) {
  const topKValue = readArgument(argumentsList, "top-k");

  return retrievalInputSchema.parse({
    organizationId: readArgument(argumentsList, "organization"),
    query: readArgument(argumentsList, "query"),
    source: readArgument(argumentsList, "source") ?? "all",
    topK: topKValue === undefined ? 5 : Number(topKValue),
  });
}

async function main() {
  loadLocalEnvironment();

  const input = parseArguments(process.argv.slice(2));
  const environment = parseEmbeddingEnvironment();
  const provider = new OpenAIEmbeddingProvider(
    environment.OPENAI_API_KEY,
    environment.EMBEDDING_MODEL,
  );
  const results = await retrieveDocumentChunks(
    createEmbeddingWorkerClient(),
    provider,
    input,
  );

  console.info(JSON.stringify(results, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown retrieval error.";
  console.error(message);
  process.exitCode = 1;
});
