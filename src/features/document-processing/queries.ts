import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DocumentProcessingStatus } from "@/types/database";

export type DocumentProcessingJob = {
  id: string;
  organization_id: string;
  evidence_document_id: string | null;
  tender_document_id: string | null;
  status: DocumentProcessingStatus;
  attempt_number: number;
  max_attempts: number;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
};

const processingJobColumns = "id, organization_id, evidence_document_id, tender_document_id, status, attempt_number, max_attempts, queued_at, started_at, completed_at, failed_at, last_error_code, last_error_message";

async function listLatestJobs(
  organizationId: string,
  sourceColumn: "evidence_document_id" | "tender_document_id",
  documentIds: string[],
) {
  const jobsByDocumentId = new Map<string, DocumentProcessingJob>();

  if (!documentIds.length) return jobsByDocumentId;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("document_processing_jobs")
    .select(processingJobColumns)
    .eq("organization_id", organizationId)
    .in(sourceColumn, documentIds)
    .order("attempt_number", { ascending: false });

  if (error) throw new Error("Unable to load document processing status.");

  for (const job of data ?? []) {
    const documentId = job[sourceColumn];

    if (documentId && !jobsByDocumentId.has(documentId)) {
      jobsByDocumentId.set(documentId, job);
    }
  }

  return jobsByDocumentId;
}

export function listLatestEvidenceProcessingJobs(
  organizationId: string,
  documentIds: string[],
) {
  return listLatestJobs(organizationId, "evidence_document_id", documentIds);
}

export function listLatestTenderProcessingJobs(
  organizationId: string,
  documentIds: string[],
) {
  return listLatestJobs(organizationId, "tender_document_id", documentIds);
}
