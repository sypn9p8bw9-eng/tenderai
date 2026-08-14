import { loadEnvFile } from "node:process";

import {
  createDocumentWorkerClient,
  createWorkerReference,
  processNextDocumentJob,
} from "./worker.ts";

function loadLocalEnvironment() {
  try {
    loadEnvFile(".env.local");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function parseMaximumJobs(argumentsList: string[]) {
  const maxArgument = argumentsList.find((argument) => argument.startsWith("--max="));
  if (!maxArgument) return 1;

  const maximum = Number(maxArgument.slice("--max=".length));
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 100) {
    throw new Error("--max must be an integer between 1 and 100.");
  }

  return maximum;
}

async function main() {
  loadLocalEnvironment();

  const maximumJobs = parseMaximumJobs(process.argv.slice(2));
  const client = createDocumentWorkerClient();
  const workerReference = createWorkerReference();
  let processedJobs = 0;
  let failedJobs = 0;

  while (processedJobs < maximumJobs) {
    const result = await processNextDocumentJob(client, workerReference);
    if (result.status === "idle") break;

    processedJobs += 1;

    if (result.status === "failed") {
      failedJobs += 1;
      console.error(`Job ${result.jobId} failed with ${result.errorCode}.`);
    } else {
      console.info(`Job ${result.jobId} completed.`);
    }
  }

  console.info(
    `Document worker finished: ${processedJobs} processed, ${failedJobs} failed.`,
  );

  if (failedJobs > 0) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown worker error.";
  console.error(message);
  process.exitCode = 1;
});
