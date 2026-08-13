"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  EVIDENCE_BUCKET_ID,
  EVIDENCE_MAX_FILE_SIZE_BYTES,
  evidenceAllowedMimeTypes,
} from "@/features/evidence/constants";
import { loadOrganizationContext } from "@/features/organizations/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { getEvidenceDocument } from "./queries";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const documentIdSchema = z.uuid();
const categorySchema = z.enum([
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
]);
const editableStatusSchema = z.enum([
  "active",
  "expired",
  "expiring_soon",
  "needs_review",
]);

function isValidDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const optionalDateSchema = z
  .union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDate),
  ])
  .transform((value) => value || null);

const metadataSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).transform((value) => value || null),
    category: categorySchema,
    issuedAt: optionalDateSchema,
    expiresAt: optionalDateSchema,
  })
  .refine(
    ({ issuedAt, expiresAt }) => !issuedAt || !expiresAt || expiresAt >= issuedAt,
    { path: ["expiresAt"], message: "La scadenza deve essere successiva alla data di rilascio." },
  );

const uploadSchema = metadataSchema.extend({
  organizationSlug: slugSchema,
});

const updateSchema = metadataSchema.extend({
  organizationSlug: slugSchema,
  documentId: documentIdSchema,
  status: editableStatusSchema,
});

const documentActionSchema = z.object({
  organizationSlug: slugSchema,
  documentId: documentIdSchema,
});

const extensionForMimeType: Record<(typeof evidenceAllowedMimeTypes)[number], string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function field(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function evidenceDestination(
  organizationSlug: string,
  key?: "error" | "message",
  value?: string,
) {
  const path = `/app/${organizationSlug}/evidence`;

  return key && value
    ? `${path}?${new URLSearchParams({ [key]: value }).toString()}`
    : path;
}

function canContribute(role: string) {
  return role === "owner" || role === "admin" || role === "member";
}

function canManage(role: string) {
  return role === "owner" || role === "admin";
}

function getSubmittedFile(formData: FormData) {
  const value = formData.get("file");

  return value instanceof File ? value : null;
}

function safeFileName(fileName: string, mimeType: (typeof evidenceAllowedMimeTypes)[number]) {
  const extension = extensionForMimeType[mimeType];
  const normalizedBase = fileName
    .replace(/\.[^/.]+$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 176 - extension.length);

  return `${normalizedBase || "documento"}.${extension}`;
}

async function resolveEvidenceContext(organizationSlug: string) {
  const context = await loadOrganizationContext(organizationSlug);

  if (!context) redirect("/app");

  return context;
}

export async function uploadEvidenceDocumentAction(formData: FormData) {
  const parsed = uploadSchema.safeParse({
    organizationSlug: field(formData, "organizationSlug"),
    title: field(formData, "title"),
    description: field(formData, "description"),
    category: field(formData, "category"),
    issuedAt: field(formData, "issuedAt"),
    expiresAt: field(formData, "expiresAt"),
  });
  const fallbackSlug = slugSchema.safeParse(field(formData, "organizationSlug"));

  if (!parsed.success) {
    redirect(
      fallbackSlug.success
        ? evidenceDestination(fallbackSlug.data, "error", "Controlla i dati del documento e le date inserite.")
        : "/app",
    );
  }

  const file = getSubmittedFile(formData);
  if (!file || file.size < 1) {
    redirect(evidenceDestination(parsed.data.organizationSlug, "error", "Seleziona un file da caricare."));
  }

  if (file.size > EVIDENCE_MAX_FILE_SIZE_BYTES) {
    redirect(evidenceDestination(parsed.data.organizationSlug, "error", "Il file supera il limite di 10 MB."));
  }

  if (!evidenceAllowedMimeTypes.includes(file.type as (typeof evidenceAllowedMimeTypes)[number])) {
    redirect(evidenceDestination(parsed.data.organizationSlug, "error", "Formato file non supportato."));
  }

  const context = await resolveEvidenceContext(parsed.data.organizationSlug);
  if (!canContribute(context.role)) {
    redirect(evidenceDestination(context.organization.slug, "error", "Non hai i permessi per caricare evidenze."));
  }

  const documentId = randomUUID();
  const mimeType = file.type as (typeof evidenceAllowedMimeTypes)[number];
  const fileName = safeFileName(file.name, mimeType);
  const filePath = `${context.organization.id}/${documentId}/${fileName}`;
  const supabase = await createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from(EVIDENCE_BUCKET_ID)
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    redirect(evidenceDestination(context.organization.slug, "error", "Non è stato possibile caricare il file. Riprova."));
  }

  const { error: insertError } = await supabase.from("evidence_documents").insert({
    id: documentId,
    organization_id: context.organization.id,
    uploaded_by: context.user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    category: parsed.data.category,
    file_name: fileName,
    file_path: filePath,
    mime_type: mimeType,
    file_size_bytes: file.size,
    issued_at: parsed.data.issuedAt,
    expires_at: parsed.data.expiresAt,
  });

  if (insertError) {
    await supabase.storage.from(EVIDENCE_BUCKET_ID).remove([filePath]);
    redirect(evidenceDestination(context.organization.slug, "error", "Il file non è stato registrato. Riprova."));
  }

  revalidatePath(evidenceDestination(context.organization.slug));
  redirect(evidenceDestination(context.organization.slug, "message", "Documento caricato nell'archivio evidenze."));
}

export async function updateEvidenceDocumentAction(formData: FormData) {
  const parsed = updateSchema.safeParse({
    organizationSlug: field(formData, "organizationSlug"),
    documentId: field(formData, "documentId"),
    title: field(formData, "title"),
    description: field(formData, "description"),
    category: field(formData, "category"),
    status: field(formData, "status"),
    issuedAt: field(formData, "issuedAt"),
    expiresAt: field(formData, "expiresAt"),
  });

  if (!parsed.success) return;

  const context = await resolveEvidenceContext(parsed.data.organizationSlug);
  if (!canContribute(context.role)) {
    redirect(evidenceDestination(context.organization.slug, "error", "Non hai i permessi per modificare le evidenze."));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("evidence_documents")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      status: parsed.data.status,
      issued_at: parsed.data.issuedAt,
      expires_at: parsed.data.expiresAt,
    })
    .eq("organization_id", context.organization.id)
    .eq("id", parsed.data.documentId);

  if (error) {
    redirect(evidenceDestination(context.organization.slug, "error", "Non è stato possibile aggiornare il documento."));
  }

  revalidatePath(evidenceDestination(context.organization.slug));
  redirect(evidenceDestination(context.organization.slug, "message", "Metadati del documento aggiornati."));
}

export async function archiveEvidenceDocumentAction(formData: FormData) {
  const parsed = documentActionSchema.safeParse({
    organizationSlug: field(formData, "organizationSlug"),
    documentId: field(formData, "documentId"),
  });

  if (!parsed.success) return;

  const context = await resolveEvidenceContext(parsed.data.organizationSlug);
  if (!canManage(context.role)) {
    redirect(evidenceDestination(context.organization.slug, "error", "Solo proprietari e amministratori possono archiviare evidenze."));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("evidence_documents")
    .update({ status: "archived" })
    .eq("organization_id", context.organization.id)
    .eq("id", parsed.data.documentId);

  if (error) {
    redirect(evidenceDestination(context.organization.slug, "error", "Non è stato possibile archiviare il documento."));
  }

  revalidatePath(evidenceDestination(context.organization.slug));
  redirect(evidenceDestination(context.organization.slug, "message", "Documento archiviato."));
}

export async function downloadEvidenceDocumentAction(formData: FormData) {
  const parsed = documentActionSchema.safeParse({
    organizationSlug: field(formData, "organizationSlug"),
    documentId: field(formData, "documentId"),
  });

  if (!parsed.success) return;

  const context = await resolveEvidenceContext(parsed.data.organizationSlug);
  const document = await getEvidenceDocument(context.organization.id, parsed.data.documentId);

  if (!document) {
    redirect(evidenceDestination(context.organization.slug, "error", "Documento non trovato o non accessibile."));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET_ID)
    .createSignedUrl(document.file_path, 60, { download: document.file_name });

  if (error || !data?.signedUrl) {
    redirect(evidenceDestination(context.organization.slug, "error", "Non è stato possibile preparare il download."));
  }

  redirect(data.signedUrl);
}
