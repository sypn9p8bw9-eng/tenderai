import { hostname } from "node:os";
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database, Json } from "../../types/database.ts";
import { chunkPageText } from "./chunk-text.ts";
import { extractDigitalPdfPages } from "./extract-pdf.ts";

const EVIDENCE_BUCKET = "evidence-documents";
const TENDER_BUCKET = "tender-documents";
const PDF_MIME_TYPE = "application/pdf";
const EXTRACTOR_VERSION = "6.2.108";

type WorkerClient = SupabaseClient<Database>;
type ProcessingJob = Database["public"]["Tables"]["document_processing_jobs"]["Row"];

type DocumentSource = {
  bucket: typeof EVIDENCE_BUCKET | typeof TENDER_BUCKET;
  filePath: string;
  mimeType: string;
};

export type DocumentWorkerResult =
  | { status: "idle" }
  | { jobId: string; status: "completed" }
  | { errorCode: string; jobId: string; status: "failed" };

class DocumentWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "DocumentWorkerError";
  }
}

const workerEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

function parseWorkerEnvironment() {
  const parsed = workerEnvironmentSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      "Document worker configuration is missing or invalid. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return parsed.data;
}

export function createDocumentWorkerClient(): WorkerClient {
  const environment = parseWorkerEnvironment();

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

export function createWorkerReference() {
  return `documents:${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
}

async function claimNextJob(
  client: WorkerClient,
  workerReference: string,
): Promise<ProcessingJob | null> {
  const { data, error } = await client.rpc("claim_document_processing_job", {
    p_worker_reference: workerReference,
  });

  if (error) {
    throw new Error(`Unable to claim a document processing job: ${error.message}`);
  }

  return data?.[0] ?? null;
}

async function resolveDocumentSource(
  client: WorkerClient,
  job: ProcessingJob,
): Promise<DocumentSource> {
  if (job.evidence_document_id) {
    const { data, error } = await client
      .from("evidence_documents")
      .select("id, organization_id, file_name, file_path, mime_type")
      .eq("id", job.evidence_document_id)
      .eq("organization_id", job.organization_id)
      .maybeSingle();

    if (error || !data) {
      throw new DocumentWorkerError(
        "SOURCE_NOT_FOUND",
        "Il documento Evidence associato non è più disponibile.",
      );
    }

    const expectedPath = `${job.organization_id}/${data.id}/${data.file_name}`;
    if (data.file_path !== expectedPath) {
      throw new DocumentWorkerError(
        "INVALID_STORAGE_PATH",
        "Il percorso Storage del documento Evidence non rispetta il perimetro organizzativo.",
      );
    }

    return {
      bucket: EVIDENCE_BUCKET,
      filePath: data.file_path,
      mimeType: data.mime_type,
    };
  }

  if (job.tender_document_id) {
    const { data, error } = await client
      .from("tender_documents")
      .select("id, organization_id, tender_id, file_name, file_path, mime_type")
      .eq("id", job.tender_document_id)
      .eq("organization_id", job.organization_id)
      .maybeSingle();

    if (error || !data) {
      throw new DocumentWorkerError(
        "SOURCE_NOT_FOUND",
        "Il documento di gara associato non è più disponibile.",
      );
    }

    const expectedPath = `${job.organization_id}/${data.tender_id}/${data.id}/${data.file_name}`;
    if (data.file_path !== expectedPath) {
      throw new DocumentWorkerError(
        "INVALID_STORAGE_PATH",
        "Il percorso Storage del documento di gara non rispetta il perimetro organizzativo.",
      );
    }

    return {
      bucket: TENDER_BUCKET,
      filePath: data.file_path,
      mimeType: data.mime_type,
    };
  }

  throw new DocumentWorkerError(
    "SOURCE_NOT_FOUND",
    "Il job non contiene un riferimento documento valido.",
  );
}

async function downloadPrivateDocument(
  client: WorkerClient,
  source: DocumentSource,
) {
  const { data, error } = await client.storage
    .from(source.bucket)
    .download(source.filePath, {}, { cache: "no-store" });

  if (error || !data) {
    throw new DocumentWorkerError(
      "STORAGE_DOWNLOAD_FAILED",
      "Non è stato possibile scaricare il file privato da Supabase Storage.",
    );
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new DocumentWorkerError(
      "EMPTY_FILE",
      "Il file caricato è vuoto e non può essere elaborato.",
    );
  }

  return bytes;
}

function asWorkerFailure(error: unknown) {
  if (error instanceof DocumentWorkerError) return error;

  return new DocumentWorkerError(
    "PDF_EXTRACTION_FAILED",
    "Il PDF non è stato letto correttamente. Verifica che sia un PDF digitale valido e non protetto.",
  );
}

async function recordFailure(
  client: WorkerClient,
  job: ProcessingJob,
  workerReference: string,
  failure: DocumentWorkerError,
) {
  const { error } = await client.rpc("fail_document_processing_job", {
    p_error_code: failure.code,
    p_error_message: failure.message,
    p_job_id: job.id,
    p_worker_reference: workerReference,
  });

  if (error) {
    throw new Error(
      `Job ${job.id} failed with ${failure.code}, but its failure state could not be persisted: ${error.message}`,
    );
  }
}

async function processClaimedJob(
  client: WorkerClient,
  job: ProcessingJob,
  workerReference: string,
) {
  const source = await resolveDocumentSource(client, job);

  if (source.mimeType !== PDF_MIME_TYPE) {
    throw new DocumentWorkerError(
      "UNSUPPORTED_MIME_TYPE",
      "Formato non supportato: M6 elabora esclusivamente PDF digitali (application/pdf).",
    );
  }

  const bytes = await downloadPrivateDocument(client, source);
  let pages;

  try {
    pages = await extractDigitalPdfPages(bytes);
  } catch {
    throw new DocumentWorkerError(
      "PDF_EXTRACTION_FAILED",
      "Il PDF non è stato letto correttamente. Verifica che sia un PDF digitale valido e non protetto.",
    );
  }

  if (!pages.some((page) => page.text.trim().length > 0)) {
    throw new DocumentWorkerError(
      "NO_EXTRACTABLE_TEXT",
      "Il PDF non contiene testo digitale estraibile. L'OCR per documenti scansionati non è ancora disponibile.",
    );
  }

  let chunkIndex = 0;
  const chunkPayload: Json[] = [];

  for (const page of pages) {
    for (const chunk of chunkPageText(page.text)) {
      chunkPayload.push({
        character_end: chunk.characterEnd,
        character_start: chunk.characterStart,
        chunk_index: chunkIndex,
        content: chunk.content,
        metadata: { source: "digital_pdf" },
        page_number: page.pageNumber,
      });
      chunkIndex += 1;
    }
  }

  const pagePayload: Json[] = pages.map((page) => ({
    extracted_text: page.text,
    metadata: {
      extractor: "pdfjs-dist",
      extractor_version: EXTRACTOR_VERSION,
      source: "digital_pdf",
    },
    page_number: page.pageNumber,
  }));

  const { error } = await client.rpc("complete_document_processing_job", {
    p_chunks: chunkPayload,
    p_job_id: job.id,
    p_pages: pagePayload,
    p_worker_reference: workerReference,
  });

  if (error) {
    throw new DocumentWorkerError(
      "OUTPUT_PERSIST_FAILED",
      "Il testo estratto non è stato salvato in modo atomico.",
    );
  }
}

export async function processNextDocumentJob(
  client: WorkerClient,
  workerReference: string,
): Promise<DocumentWorkerResult> {
  const job = await claimNextJob(client, workerReference);
  if (!job) return { status: "idle" };

  try {
    await processClaimedJob(client, job, workerReference);
    return { jobId: job.id, status: "completed" };
  } catch (error) {
    const failure = asWorkerFailure(error);
    await recordFailure(client, job, workerReference, failure);
    return { errorCode: failure.code, jobId: job.id, status: "failed" };
  }
}
