"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { getSupabaseEnvironment } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidSchema = z.uuid();
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
});

const invitationSchema = z.object({
  organizationId: uuidSchema,
  organizationSlug: slugSchema,
  email: z.email().max(320).transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "member", "viewer"]),
});

const tokenSchema = z.string().min(40).max(100).regex(/^[A-Za-z0-9_-]+$/);

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function organizationError(message: string, fallback: string) {
  if (message.includes("organizations_slug_key")) return "Questo identificatore è già in uso.";
  if (message.includes("already an organization member")) return "Questa persona fa già parte del workspace.";
  if (message.includes("organization_invitations_pending_email_idx")) return "Esiste già un invito attivo per questa email.";
  if (message.includes("cannot assign")) return "Non puoi assegnare questo ruolo.";
  return fallback;
}

export async function createOrganizationAction(formData: FormData) {
  await requireAuthenticatedUser();
  const parsed = organizationSchema.safeParse({
    name: field(formData, "name"),
    slug: field(formData, "slug"),
  });

  if (!parsed.success) {
    redirect("/onboarding?error=Controlla+nome+e+identificatore+del+workspace.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });

  if (error) {
    const message = organizationError(error.message, "Non è stato possibile creare il workspace.");
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/app");
  redirect(`/app/${parsed.data.slug}`);
}

export type InvitationActionState = {
  error?: string;
  invitationUrl?: string;
};

export async function createInvitationAction(
  _previousState: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  await requireAuthenticatedUser();
  const parsed = invitationSchema.safeParse({
    organizationId: field(formData, "organizationId"),
    organizationSlug: field(formData, "organizationSlug"),
    email: field(formData, "email"),
    role: field(formData, "role"),
  });

  if (!parsed.success) {
    return { error: "Controlla email e ruolo." };
  }

  const token = randomBytes(32).toString("base64url");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("invite_organization_member", {
    p_organization_id: parsed.data.organizationId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_token_hash: hashInvitationToken(token),
  });

  if (error) {
    return {
      error: organizationError(error.message, "Non è stato possibile creare l’invito."),
    };
  }

  const environment = getSupabaseEnvironment();
  const invitationUrl = new URL("/invitations/accept", environment.NEXT_PUBLIC_APP_URL);
  invitationUrl.searchParams.set("token", token);
  revalidatePath(`/app/${parsed.data.organizationSlug}`);

  return { invitationUrl: invitationUrl.toString() };
}

export async function acceptInvitationAction(formData: FormData) {
  await requireAuthenticatedUser();
  const token = tokenSchema.safeParse(field(formData, "token"));

  if (!token.success) {
    redirect("/invitations/accept?error=Invito+non+valido.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: organizationId, error } = await supabase.rpc(
    "accept_organization_invitation",
    { p_token_hash: hashInvitationToken(token.data) },
  );

  if (error || !organizationId) {
    redirect(`/invitations/accept?token=${encodeURIComponent(token.data)}&error=${encodeURIComponent("L’invito è scaduto, già usato o destinato a un’altra email.")}`);
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", organizationId)
    .single();

  revalidatePath("/app");
  redirect(organization ? `/app/${organization.slug}` : "/app");
}

export async function revokeInvitationAction(formData: FormData) {
  await requireAuthenticatedUser();
  const parsed = z.object({
    invitationId: uuidSchema,
    organizationSlug: slugSchema,
  }).safeParse({
    invitationId: field(formData, "invitationId"),
    organizationSlug: field(formData, "organizationSlug"),
  });

  if (!parsed.success) return;

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("revoke_organization_invitation", {
    p_invitation_id: parsed.data.invitationId,
  });
  revalidatePath(`/app/${parsed.data.organizationSlug}`);
}

export async function removeMemberAction(formData: FormData) {
  await requireAuthenticatedUser();
  const parsed = z.object({
    organizationId: uuidSchema,
    userId: uuidSchema,
    organizationSlug: slugSchema,
  }).safeParse({
    organizationId: field(formData, "organizationId"),
    userId: field(formData, "userId"),
    organizationSlug: field(formData, "organizationSlug"),
  });

  if (!parsed.success) return;

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("remove_organization_member", {
    p_organization_id: parsed.data.organizationId,
    p_user_id: parsed.data.userId,
  });
  revalidatePath(`/app/${parsed.data.organizationSlug}`);
}
