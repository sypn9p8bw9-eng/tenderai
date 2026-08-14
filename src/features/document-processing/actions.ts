"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { loadOrganizationContext } from "@/features/organizations/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const retrySchema = z.object({
  organizationSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  jobId: z.uuid(),
  source: z.enum(["evidence", "tender"]),
  tenderId: z.union([z.literal(""), z.uuid()]),
});

function field(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function destination(
  organizationSlug: string,
  source: "evidence" | "tender",
  tenderId: string,
) {
  return source === "evidence"
    ? `/app/${organizationSlug}/evidence`
    : `/app/${organizationSlug}/tenders/${tenderId}`;
}

export async function retryDocumentProcessingAction(formData: FormData) {
  const parsed = retrySchema.safeParse({
    organizationSlug: field(formData, "organizationSlug"),
    jobId: field(formData, "jobId"),
    source: field(formData, "source"),
    tenderId: field(formData, "tenderId"),
  });

  if (!parsed.success || (parsed.data.source === "tender" && !parsed.data.tenderId)) return;

  const context = await loadOrganizationContext(parsed.data.organizationSlug);
  if (!context) redirect("/app");

  const retryPath = destination(
    context.organization.slug,
    parsed.data.source,
    parsed.data.tenderId,
  );
  const canContribute = context.role === "owner"
    || context.role === "admin"
    || context.role === "member";

  if (!canContribute) {
    redirect(`${retryPath}?${new URLSearchParams({ error: "Non hai i permessi per riprovare l'elaborazione." }).toString()}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("retry_document_processing", {
    p_job_id: parsed.data.jobId,
  });

  if (error) {
    redirect(`${retryPath}?${new URLSearchParams({ error: "Non è stato possibile rimettere il documento in coda." }).toString()}`);
  }

  revalidatePath(retryPath);
  redirect(`${retryPath}?${new URLSearchParams({ message: "Documento rimesso in coda per l'elaborazione." }).toString()}`);
}
