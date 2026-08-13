import type {
  TenderDocumentType,
  TenderProcedureType,
  TenderStatus,
} from "@/types/database";

export const TENDER_DOCUMENT_BUCKET_ID = "tender-documents";
export const TENDER_DOCUMENT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const tenderStatuses = [
  "draft",
  "evaluating",
  "in_progress",
  "submitted",
  "won",
  "lost",
  "archived",
] as const satisfies readonly TenderStatus[];

export const editableTenderStatuses = [
  "draft",
  "evaluating",
  "in_progress",
  "submitted",
  "won",
  "lost",
] as const satisfies readonly Exclude<TenderStatus, "archived">[];

export const tenderStatusLabels: Record<TenderStatus, string> = {
  draft: "Bozza",
  evaluating: "In valutazione",
  in_progress: "In preparazione",
  submitted: "Presentata",
  won: "Aggiudicata",
  lost: "Non aggiudicata",
  archived: "Archiviata",
};

export const tenderProcedureTypes = [
  "open",
  "restricted",
  "negotiated",
  "direct_award",
  "framework",
  "other",
] as const satisfies readonly TenderProcedureType[];

export const tenderProcedureTypeLabels: Record<TenderProcedureType, string> = {
  open: "Procedura aperta",
  restricted: "Procedura ristretta",
  negotiated: "Procedura negoziata",
  direct_award: "Affidamento diretto",
  framework: "Accordo quadro",
  other: "Altra procedura",
};

export const tenderDocumentTypes = [
  "bando",
  "disciplinare",
  "capitolato",
  "allegato",
  "chiarimento",
  "modello",
  "other",
] as const satisfies readonly TenderDocumentType[];

export const tenderDocumentTypeLabels: Record<TenderDocumentType, string> = {
  bando: "Bando",
  disciplinare: "Disciplinare",
  capitolato: "Capitolato",
  allegato: "Allegato",
  chiarimento: "Chiarimento",
  modello: "Modello",
  other: "Altro documento",
};

export const tenderDocumentAllowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const tenderDocumentFileInputAccept = [
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

export function formatTenderFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return `${(bytes / (1024 * 1024)).toLocaleString("it-IT", {
    maximumFractionDigits: 1,
  })} MB`;
}

export function formatTenderCurrency(value: number | null, currency: string) {
  if (value === null) return "Non indicato";

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatTenderDeadline(value: string | null) {
  if (!value) return "Non indicata";

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

export function tenderDeadlineInputValue(value: string | null) {
  if (!value) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: partValue }) => [type, partValue]),
  );

  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}
