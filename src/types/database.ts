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
    };
    Enums: {
      organization_role: OrganizationRole;
      invitation_status: InvitationStatus;
      evidence_document_category: EvidenceDocumentCategory;
      evidence_document_status: EvidenceDocumentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
