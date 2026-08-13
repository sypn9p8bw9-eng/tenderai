import type {
  EvidenceDocumentCategory,
  EvidenceDocumentStatus,
} from "@/types/database";

export const EVIDENCE_BUCKET_ID = "evidence-documents";
export const EVIDENCE_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const evidenceDocumentCategories: readonly EvidenceDocumentCategory[] = [
  "legal",
  "certification",
  "soa",
  "financial",
  "insurance",
  "administrative",
  "reference",
  "personnel",
  "equipment",
  "technical",
  "other",
];

export const evidenceDocumentStatuses: readonly EvidenceDocumentStatus[] = [
  "active",
  "expired",
  "expiring_soon",
  "needs_review",
  "archived",
];

export const editableEvidenceDocumentStatuses: readonly Exclude<
  EvidenceDocumentStatus,
  "archived"
>[] = ["active", "expired", "expiring_soon", "needs_review"];

export const evidenceDocumentCategoryLabels: Record<EvidenceDocumentCategory, string> = {
  legal: "Documenti legali",
  certification: "Certificazioni",
  soa: "SOA e categorie",
  financial: "Requisiti finanziari",
  insurance: "Assicurazioni",
  administrative: "Dichiarazioni amministrative",
  reference: "Referenze e casi studio",
  personnel: "Personale e CV",
  equipment: "Attrezzature e mezzi",
  technical: "Certificazioni tecniche",
  other: "Altre evidenze",
};

export const evidenceDocumentStatusLabels: Record<EvidenceDocumentStatus, string> = {
  active: "Attivo",
  expired: "Scaduto",
  expiring_soon: "In scadenza",
  needs_review: "Da verificare",
  archived: "Archiviato",
};

export const evidenceAllowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const evidenceFileInputAccept = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
].join(",");

export function formatEvidenceFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return `${(bytes / (1024 * 1024)).toLocaleString("it-IT", {
    maximumFractionDigits: 1,
  })} MB`;
}
