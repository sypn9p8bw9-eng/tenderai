"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  TENDER_DOCUMENT_BUCKET_ID,
  TENDER_DOCUMENT_MAX_FILE_SIZE_BYTES,
  tenderDocumentAllowedMimeTypes,
  tenderDocumentTypes,
  tenderProcedureTypes,
  tenderStatuses,
} from "@/features/tenders/constants";
import { getTender, getTenderDocument } from "@/features/tenders/queries";
import { loadOrganizationContext } from "@/features/organizations/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuidSchema = z.uuid();
const procedureTypeSchema = z.enum(tenderProcedureTypes);
const editableTenderStatusSchema = z.enum(
  tenderStatuses.filter((status) => status !== "archived"),
);
const tenderDocumentTypeSchema = z.enum(tenderDocumentTypes);

function optionalTrimmedString(maxLength: number) {
  return z.string().trim().max(maxLength).transform((value) => value || null);
}

function optionalUrl() {
  return z
    .string()
    .trim()
    .max(2048)
    .transform((value) => value || null)
    .refine((value) => value === null || /^https?:\/\/[^\s]+$/i.test(value));
}

const dateTimeLocalPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function datePartsInTimeZone(date: Date, timeZone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: partValue }) => [type, Number(partValue)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

function timeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const parts = datePartsInTimeZone(date, timeZone);

  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ) - date.getTime();
}

function parseRomeDateTimeLocal(value: string) {
  if (!value) return null;

  const match = dateTimeLocalPattern.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number);
  const naiveUtcMilliseconds = Date.UTC(year, month - 1, day, hour, minute);
  const candidate = new Date(naiveUtcMilliseconds);
  const offset = timeZoneOffsetMilliseconds(candidate, "Europe/Rome");
  const date = new Date(naiveUtcMilliseconds - offset);
  const roundTripped = datePartsInTimeZone(date, "Europe/Rome");

  if (
    roundTripped.year !== year
    || roundTripped.month !== month
    || roundTripped.day !== day
    || roundTripped.hour !== hour
    || roundTripped.minute !== minute
  ) {
    return null;
  }

  return date.toISOString();
}

const optionalDateTimeSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || parseRomeDateTimeLocal(value) !== null,
  )
  .transform(parseRomeDateTimeLocal);

const tenderMetadataSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: optionalTrimmedString(4000),
  status: editableTenderStatusSchema,
  procedureType: z.union([z.literal(""), procedureTypeSchema]).transform((value) => value || null),
  buyerName: optionalTrimmedString(200),
  cig: optionalTrimmedString(40),
  cup: optionalTrimmedString(40),
  estimatedValue: z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .refine((value) => value === "" || /^\d+(\.\d{1,2})?$/.test(value))
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || value >= 0),
  currency: z.string().trim().toUpperCase().length(3).regex(/^[A-Z]{3}$/),
  submissionDeadline: optionalDateTimeSchema,
  sourceUrl: optionalUrl(),
  notes: optionalTrimmedString(5000),
});

const createTenderSchema = tenderMetadataSchema.extend({
  organizationSlug: slugSchema,
});

const updateTenderSchema = tenderMetadataSchema.extend({
  organizationSlug: slugSchema,
  tenderId: uuidSchema,
});

const archiveTenderSchema = z.object({
  organizationSlug: slugSchema,
  tenderId: uuidSchema,
});

const uploadTenderDocumentSchema = z.object({
  organizationSlug: slugSchema,
  tenderId: uuidSchema,
  title: z.string().trim().min(2).max(200),
  documentType: tenderDocumentTypeSchema,
});

const documentActionSchema = z.object({
  organizationSlug: slugSchema,
  tenderId: uuidSchema,
  documentId: uuidSchema,
});

const extensionForMimeType: Record<(typeof tenderDocumentAllowedMimeTypes)[number], string> = {
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

function tenderListPath(organizationSlug: string) {
  return `/app/${organizationSlug}/tenders`;
}

function tenderPath(organizationSlug: string, tenderId: string) {
  return `${tenderListPath(organizationSlug)}/${tenderId}`;
}

function destination(
  organizationSlug: string,
  tenderId?: string,
  key?: "error" | "message",
  value?: string,
) {
  const path = tenderId ? tenderPath(organizationSlug, tenderId) : tenderListPath(organizationSlug);

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

function submittedFile(formData: FormData) {
  const value = formData.get("file");

  return value instanceof File ? value : null;
}

function safeFileName(fileName: string, mimeType: (typeof tenderDocumentAllowedMimeTypes)[number]) {
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

async function resolveTenderContext(organizationSlug: string) {
  const context = await loadOrganizationContext(organizationSlug);

  if (!context) notFound();

  return context;
}

async function resolveAccessibleTender(organizationId: string, tenderId: string) {
  const tender = await getTender(organizationId, tenderId);

  if (!tender) notFound();

  return tender;
}

export async function createTenderAction(formData: FormData) {
  const parsed = createTenderSchema.safeParse({
    organizationSlug: field(formData, "organizationSlug"),
    title: field(formData, "title"),
    description: field(formData, "description"),
    status: "draft",
    procedureType: field(formData, "procedureType"),
    buyerName: field(formData, "buyerName"),
    cig: field(formData, "cig"),
    cup: field(formData, "cup"),
    estimatedValue: field(formData, "estimatedValue"),
    currency: field(formData, "currency") || "EUR",
    submissionDeadline: field(formData, "submissionDeadline"),
    sourceUrl: field(formData, "sourceUrl"),
    notes: field(formData, "notes"),
  });
  const fallbackSlug = slugSchema.safeParse(field(formData, "organizationSlug"));

  if (!parsed.success) {
    redirect(
      fallbackSlug.success
        ? destination(fallbackSlug.data, undefined, "error", "Controlla i dati della nuova gara.")
        : "/app",
    );
  }

  const context = await resolveTenderContext(parsed.data.organizationSlug);
  if (!canContribute(context.role)) {
    redirect(destination(context.organization.slug, undefined, "error", "Non hai i permessi per creare gare."));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenders")
    .insert({
      organization_id: context.organization.id,
      created_by: context.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      procedure_type: parsed.data.procedureType,
      buyer_name: parsed.data.buyerName,
      cig: parsed.data.cig,
      cup: parsed.data.cup,
      estimated_value: parsed.data.estimatedValue,
      currency: parsed.data.currency,
      submission_deadline: parsed.data.submissionDeadline,
      source_url: parsed.data.sourceUrl,
      notes: parsed.data.notes,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(destination(context.organization.slug, undefined, "error", "Non è stato possibile creare la gara."));
  }

  revalidatePath(tenderListPath(context.organization.slug));
  redirect(destination(context.organization.slug, data.id));
}

export async function updateTenderAction(formData: FormData) {
  const parsed = updateTenderSchema.safeParse({
    organizationSlug: field(formData, "organizationSlug"),
    tenderId: field(formData, "tenderId"),
    title: field(formData, "title"),
    description: field(formData, "description"),
    status: field(formData, "status"),
    procedureType: field(formData, "procedureType"),
    buyerName: field(formData, "buyerName"),
    cig: field(formData, "cig"),
    cup: field(formData, "cup"),
    estimatedValue: field(formData, "estimatedValue"),
    currency: field(formData, "currency"),
    submissionDeadline: field(formData, "submissionDeadline"),
    sourceUrl: field(formData, "sourceUrl"),
    notes: field(formData, "notes"),
  });

  if (!parsed.success) return;

  const context = await resolveTenderContext(parsed.data.organizationSlug);
  if (!canContribute(context.role)) {
    redirect(destination(context.organization.slug, parsed.data.tenderId, "error", "Non hai i permessi per modificare la gara."));
  }
  await resolveAccessibleTender(context.organization.id, parsed.data.tenderId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tenders")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      procedure_type: parsed.data.procedureType,
      buyer_name: parsed.data.buyerName,
      cig: parsed.data.cig,
      cup: parsed.data.cup,
      estimated_value: parsed.data.estimatedValue,
      currency: parsed.data.currency,
      submission_deadline: parsed.data.submissionDeadline,
      source_url: parsed.data.sourceUrl,
      notes: parsed.data.notes,
    })
    .eq("organization_id", context.organization.id)
    .eq("id", parsed.data.tenderId);

  if (error) {
    redirect(destination(context.organization.slug, parsed.data.tenderId, "error", "Non è stato possibile aggiornare la gara."));
  }

  revalidatePath(tenderListPath(context.organization.slug));
  revalidatePath(tenderPath(context.organization.slug, parsed.data.tenderId));
  redirect(destination(context.organization.slug, parsed.data.tenderId, "message", "Metadati della gara aggiornati."));
}

export async function archiveTenderAction(formData: FormData) {
  const parsed = archiveTenderSchema.safeParse({
    organizationSlug: field(formData, "organizationSlug"),
    tenderId: field(formData, "tenderId"),
  });

  if (!parsed.success) return;

  const context = await resolveTenderContext(parsed.data.organizationSlug);
  if (!canManage(context.role)) {
    redirect(destination(context.organization.slug, parsed.data.tenderId, "error", "Solo proprietari e amministratori possono archiviare una gara."));
  }
  await resolveAccessibleTender(context.organization.id, parsed.data.tenderId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tenders")
    .update({ status: "archived" })
    .eq("organization_id", context.organization.id)
    .eq("id", parsed.data.tenderId);

  if (error) {
    redirect(destination(context.organization.slug, parsed.data.tenderId, "error", "Non è stato possibile archiviare la gara."));
  }

  revalidatePath(tenderListPath(context.organization.slug));
  redirect(destination(context.organization.slug, undefined, "message", "Gara archiviata."));
}

export async function uploadTenderDocumentAction(formData: FormData) {
  const parsed = uploadTenderDocumentSchema.safeParse({
    organizationSlug: field(formData, "organizationSlug"),
    tenderId: field(formData, "tenderId"),
    title: field(formData, "title"),
    documentType: field(formData, "documentType"),
  });

  if (!parsed.success) return;

  const context = await resolveTenderContext(parsed.data.organizationSlug);
  if (!canContribute(context.role)) {
    redirect(destination(context.organization.slug, parsed.data.tenderId, "error", "Non hai i permessi per caricare documenti."));
  }
  const tender = await resolveAccessibleTender(context.organization.id, parsed.data.tenderId);
  if (tender.status === "archived") {
    redirect(destination(context.organization.slug, tender.id, "error", "Non è possibile aggiungere documenti a una gara archiviata."));
  }

  const file = submittedFile(formData);
  if (!file || file.size < 1) {
    redirect(destination(context.organization.slug, tender.id, "error", "Seleziona un file da caricare."));
  }
  if (file.size > TENDER_DOCUMENT_MAX_FILE_SIZE_BYTES) {
    redirect(destination(context.organization.slug, tender.id, "error", "Il file supera il limite di 25 MB."));
  }
  if (!tenderDocumentAllowedMimeTypes.includes(file.type as (typeof tenderDocumentAllowedMimeTypes)[number])) {
    redirect(destination(context.organization.slug, tender.id, "error", "Formato file non supportato."));
  }

  const documentId = randomUUID();
  const mimeType = file.type as (typeof tenderDocumentAllowedMimeTypes)[number];
  const fileName = safeFileName(file.name, mimeType);
  const filePath = `${context.organization.id}/${tender.id}/${documentId}/${fileName}`;
  const supabase = await createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from(TENDER_DOCUMENT_BUCKET_ID)
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    redirect(destination(context.organization.slug, tender.id, "error", "Non è stato possibile caricare il file. Riprova."));
  }

  const { error: insertError } = await supabase.from("tender_documents").insert({
    id: documentId,
    organization_id: context.organization.id,
    tender_id: tender.id,
    uploaded_by: context.user.id,
    document_type: parsed.data.documentType,
    title: parsed.data.title,
    file_name: fileName,
    file_path: filePath,
    mime_type: mimeType,
    file_size_bytes: file.size,
  });

  if (insertError) {
    await supabase.storage.from(TENDER_DOCUMENT_BUCKET_ID).remove([filePath]);
    redirect(destination(context.organization.slug, tender.id, "error", "Il file non è stato registrato. Riprova."));
  }

  revalidatePath(tenderPath(context.organization.slug, tender.id));
  redirect(destination(context.organization.slug, tender.id, "message", "Documento di gara caricato e messo in coda per l'elaborazione."));
}

export async function downloadTenderDocumentAction(formData: FormData) {
  const parsed = documentActionSchema.safeParse({
    organizationSlug: field(formData, "organizationSlug"),
    tenderId: field(formData, "tenderId"),
    documentId: field(formData, "documentId"),
  });

  if (!parsed.success) return;

  const context = await resolveTenderContext(parsed.data.organizationSlug);
  await resolveAccessibleTender(context.organization.id, parsed.data.tenderId);
  const document = await getTenderDocument(
    context.organization.id,
    parsed.data.tenderId,
    parsed.data.documentId,
  );

  if (!document) notFound();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(TENDER_DOCUMENT_BUCKET_ID)
    .createSignedUrl(document.file_path, 60, { download: document.file_name });

  if (error || !data?.signedUrl) {
    redirect(destination(context.organization.slug, parsed.data.tenderId, "error", "Non è stato possibile preparare il download."));
  }

  redirect(data.signedUrl);
}
