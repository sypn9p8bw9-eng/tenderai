import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  TenderDocumentType,
  TenderProcedureType,
  TenderStatus,
} from "@/types/database";

export type TenderFilters = {
  status?: TenderStatus;
};

export type Tender = {
  id: string;
  organization_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  status: TenderStatus;
  procedure_type: TenderProcedureType | null;
  buyer_name: string | null;
  cig: string | null;
  cup: string | null;
  estimated_value: number | null;
  currency: string;
  submission_deadline: string | null;
  source_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type TenderDocument = {
  id: string;
  organization_id: string;
  tender_id: string;
  uploaded_by: string | null;
  document_type: TenderDocumentType;
  title: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
};

function tenderQueryFailure(scope: string) {
  return new Error(`Unable to load ${scope}.`);
}

/** Lists tender records only through the caller's authenticated RLS session. */
export async function listTenders(
  organizationId: string,
  filters: TenderFilters = {},
): Promise<Tender[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("tenders")
    .select("id, organization_id, created_by, title, description, status, procedure_type, buyer_name, cig, cup, estimated_value, currency, submission_deadline, source_url, notes, created_at, updated_at, archived_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;

  if (error) throw tenderQueryFailure("tenders");

  return data ?? [];
}

/** Fetches a tender only when it belongs to the supplied organization. */
export async function getTender(
  organizationId: string,
  tenderId: string,
): Promise<Tender | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenders")
    .select("id, organization_id, created_by, title, description, status, procedure_type, buyer_name, cig, cup, estimated_value, currency, submission_deadline, source_url, notes, created_at, updated_at, archived_at")
    .eq("organization_id", organizationId)
    .eq("id", tenderId)
    .maybeSingle();

  if (error) throw tenderQueryFailure("tender");

  return data;
}

/** Lists source documents only for the current tenant and tender. */
export async function listTenderDocuments(
  organizationId: string,
  tenderId: string,
): Promise<TenderDocument[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tender_documents")
    .select("id, organization_id, tender_id, uploaded_by, document_type, title, file_name, file_path, mime_type, file_size_bytes, created_at")
    .eq("organization_id", organizationId)
    .eq("tender_id", tenderId)
    .order("created_at", { ascending: false });

  if (error) throw tenderQueryFailure("tender documents");

  return data ?? [];
}

/** Fetches a source document only when both tenant and tender match. */
export async function getTenderDocument(
  organizationId: string,
  tenderId: string,
  documentId: string,
): Promise<TenderDocument | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tender_documents")
    .select("id, organization_id, tender_id, uploaded_by, document_type, title, file_name, file_path, mime_type, file_size_bytes, created_at")
    .eq("organization_id", organizationId)
    .eq("tender_id", tenderId)
    .eq("id", documentId)
    .maybeSingle();

  if (error) throw tenderQueryFailure("tender document");

  return data;
}
