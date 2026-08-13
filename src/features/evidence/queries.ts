import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  EvidenceDocumentCategory,
  EvidenceDocumentStatus,
} from "@/types/database";

export type EvidenceDocumentFilters = {
  category?: EvidenceDocumentCategory;
  status?: EvidenceDocumentStatus;
};

export type EvidenceDocument = {
  id: string;
  organization_id: string;
  uploaded_by: string | null;
  title: string;
  description: string | null;
  category: EvidenceDocumentCategory;
  status: EvidenceDocumentStatus;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size_bytes: number;
  issued_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function evidenceQueryFailure(scope: string) {
  return new Error(`Unable to load ${scope}.`);
}

/** Lists documents only through the caller's authenticated RLS session. */
export async function listEvidenceDocuments(
  organizationId: string,
  filters: EvidenceDocumentFilters = {},
): Promise<EvidenceDocument[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("evidence_documents")
    .select("id, organization_id, uploaded_by, title, description, category, status, file_name, file_path, mime_type, file_size_bytes, issued_at, expires_at, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;

  if (error) throw evidenceQueryFailure("evidence documents");

  return data ?? [];
}

/** Fetches a document only when it belongs to the supplied organization. */
export async function getEvidenceDocument(
  organizationId: string,
  documentId: string,
): Promise<EvidenceDocument | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evidence_documents")
    .select("id, organization_id, uploaded_by, title, description, category, status, file_name, file_path, mime_type, file_size_bytes, issued_at, expires_at, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("id", documentId)
    .maybeSingle();

  if (error) throw evidenceQueryFailure("evidence document");

  return data;
}
