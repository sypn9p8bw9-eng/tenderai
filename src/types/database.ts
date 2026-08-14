export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrganizationRole = "owner" | "admin" | "member" | "viewer";
export type InvitationStatus = "pending" | "accepted" | "revoked";
export type EvidenceDocumentCategory =
  | "legal"
  | "certification"
  | "soa"
  | "financial"
  | "insurance"
  | "administrative"
  | "reference"
  | "personnel"
  | "equipment"
  | "technical"
  | "other";
export type EvidenceDocumentStatus =
  | "active"
  | "expired"
  | "expiring_soon"
  | "needs_review"
  | "archived";
export type TenderStatus =
  | "draft"
  | "evaluating"
  | "in_progress"
  | "submitted"
  | "won"
  | "lost"
  | "archived";
export type TenderProcedureType =
  | "open"
  | "restricted"
  | "negotiated"
  | "direct_award"
  | "framework"
  | "other";
export type TenderDocumentType =
  | "bando"
  | "disciplinare"
  | "capitolato"
  | "allegato"
  | "chiarimento"
  | "modello"
  | "other";
export type DocumentProcessingStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";
export type DocumentEmbeddingStatus = "processing" | "completed" | "failed";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          invited_by: string | null;
          joined_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          invited_by?: string | null;
          joined_at?: string;
          updated_at?: string;
        };
        Update: {
          role?: OrganizationRole;
          invited_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: OrganizationRole;
          token_hash: string;
          status: InvitationStatus;
          invited_by: string;
          accepted_by: string | null;
          created_at: string;
          expires_at: string;
          accepted_at: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role: OrganizationRole;
          token_hash: string;
          status?: InvitationStatus;
          invited_by: string;
          accepted_by?: string | null;
          created_at?: string;
          expires_at?: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
        };
        Update: {
          status?: InvitationStatus;
          accepted_by?: string | null;
          accepted_at?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      evidence_documents: {
        Row: {
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
        Insert: {
          id?: string;
          organization_id: string;
          uploaded_by?: string | null;
          title: string;
          description?: string | null;
          category: EvidenceDocumentCategory;
          status?: EvidenceDocumentStatus;
          file_name: string;
          file_path: string;
          mime_type: string;
          file_size_bytes: number;
          issued_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          category?: EvidenceDocumentCategory;
          status?: EvidenceDocumentStatus;
          issued_at?: string | null;
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      tenders: {
        Row: {
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
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          title: string;
          description?: string | null;
          status?: TenderStatus;
          procedure_type?: TenderProcedureType | null;
          buyer_name?: string | null;
          cig?: string | null;
          cup?: string | null;
          estimated_value?: number | null;
          currency?: string;
          submission_deadline?: string | null;
          source_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          status?: TenderStatus;
          procedure_type?: TenderProcedureType | null;
          buyer_name?: string | null;
          cig?: string | null;
          cup?: string | null;
          estimated_value?: number | null;
          currency?: string;
          submission_deadline?: string | null;
          source_url?: string | null;
          notes?: string | null;
          archived_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      tender_documents: {
        Row: {
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
        Insert: {
          id?: string;
          organization_id: string;
          tender_id: string;
          uploaded_by?: string | null;
          document_type?: TenderDocumentType;
          title: string;
          file_name: string;
          file_path: string;
          mime_type: string;
          file_size_bytes: number;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      document_processing_jobs: {
        Row: {
          id: string;
          organization_id: string;
          evidence_document_id: string | null;
          tender_document_id: string | null;
          status: DocumentProcessingStatus;
          attempt_number: number;
          max_attempts: number;
          retry_of_job_id: string | null;
          queued_at: string;
          started_at: string | null;
          completed_at: string | null;
          failed_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          worker_reference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          evidence_document_id?: string | null;
          tender_document_id?: string | null;
          status?: DocumentProcessingStatus;
          attempt_number?: number;
          max_attempts?: number;
          retry_of_job_id?: string | null;
          queued_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          worker_reference?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: DocumentProcessingStatus;
          started_at?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          worker_reference?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_processing_pages: {
        Row: {
          id: string;
          organization_id: string;
          job_id: string;
          page_number: number;
          extracted_text: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          job_id: string;
          page_number: number;
          extracted_text: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          extracted_text?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      document_processing_chunks: {
        Row: {
          id: string;
          organization_id: string;
          job_id: string;
          page_id: string;
          chunk_index: number;
          content: string;
          character_start: number;
          character_end: number;
          token_count: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          job_id: string;
          page_id: string;
          chunk_index: number;
          content: string;
          character_start: number;
          character_end: number;
          token_count?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          content?: string;
          character_start?: number;
          character_end?: number;
          token_count?: number | null;
          metadata?: Json;
        };
        Relationships: [];
      };
      document_chunk_embeddings: {
        Row: {
          id: string;
          organization_id: string;
          job_id: string;
          chunk_id: string;
          model: string;
          embedding: string | null;
          status: DocumentEmbeddingStatus;
          worker_reference: string;
          attempt_number: number;
          max_attempts: number;
          claimed_at: string;
          completed_at: string | null;
          failed_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          job_id: string;
          chunk_id: string;
          model: string;
          embedding?: string | null;
          status?: DocumentEmbeddingStatus;
          worker_reference: string;
          attempt_number?: number;
          max_attempts?: number;
          claimed_at?: string;
          completed_at?: string | null;
          failed_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          embedding?: string | null;
          status?: DocumentEmbeddingStatus;
          worker_reference?: string;
          attempt_number?: number;
          claimed_at?: string;
          completed_at?: string | null;
          failed_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string };
        Returns: string;
      };
      invite_organization_member: {
        Args: {
          p_organization_id: string;
          p_email: string;
          p_role: OrganizationRole;
          p_token_hash: string;
        };
        Returns: string;
      };
      accept_organization_invitation: {
        Args: { p_token_hash: string };
        Returns: string;
      };
      revoke_organization_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      update_organization_member_role: {
        Args: {
          p_organization_id: string;
          p_user_id: string;
          p_role: OrganizationRole;
        };
        Returns: undefined;
      };
      remove_organization_member: {
        Args: { p_organization_id: string; p_user_id: string };
        Returns: undefined;
      };
      retry_document_processing: {
        Args: { p_job_id: string };
        Returns: string;
      };
      claim_document_processing_job: {
        Args: { p_worker_reference: string };
        Returns: Array<{
          id: string;
          organization_id: string;
          evidence_document_id: string | null;
          tender_document_id: string | null;
          status: DocumentProcessingStatus;
          attempt_number: number;
          max_attempts: number;
          retry_of_job_id: string | null;
          queued_at: string;
          started_at: string | null;
          completed_at: string | null;
          failed_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          worker_reference: string | null;
          created_at: string;
          updated_at: string;
        }>;
      };
      complete_document_processing_job: {
        Args: {
          p_job_id: string;
          p_worker_reference: string;
          p_pages: Json;
          p_chunks: Json;
        };
        Returns: undefined;
      };
      fail_document_processing_job: {
        Args: {
          p_job_id: string;
          p_worker_reference: string;
          p_error_code: string;
          p_error_message: string;
        };
        Returns: undefined;
      };
      claim_document_embedding_batch: {
        Args: {
          p_model: string;
          p_worker_reference: string;
          p_limit?: number;
        };
        Returns: Array<{
          claimed_embedding_id: string;
          claimed_organization_id: string;
          claimed_job_id: string;
          claimed_chunk_id: string;
          claimed_chunk_text: string;
        }>;
      };
      complete_document_embedding_batch: {
        Args: {
          p_model: string;
          p_worker_reference: string;
          p_embeddings: Json;
        };
        Returns: undefined;
      };
      fail_document_embedding_batch: {
        Args: {
          p_model: string;
          p_worker_reference: string;
          p_chunk_ids: string[];
          p_error_code: string;
          p_error_message: string;
        };
        Returns: undefined;
      };
      match_document_chunks: {
        Args: {
          p_organization_id: string;
          p_query_embedding: string;
          p_model: string;
          p_source?: "all" | "evidence" | "tender";
          p_top_k?: number;
        };
        Returns: Array<{
          chunk_id: string;
          page_number: number;
          chunk_text: string;
          document_title: string;
          file_name: string;
          source_type: "evidence" | "tender";
          similarity: number;
        }>;
      };
    };
    Enums: {
      organization_role: OrganizationRole;
      invitation_status: InvitationStatus;
      evidence_document_category: EvidenceDocumentCategory;
      evidence_document_status: EvidenceDocumentStatus;
      tender_status: TenderStatus;
      tender_procedure_type: TenderProcedureType;
      tender_document_type: TenderDocumentType;
      document_processing_status: DocumentProcessingStatus;
      document_embedding_status: DocumentEmbeddingStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
