import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrganizationRole } from "@/types/database";

export type UserOrganization = {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
};

export async function listUserOrganizations(userId: string): Promise<UserOrganization[]> {
  const supabase = await createSupabaseServerClient();
  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId);

  if (error || !memberships?.length) return [];

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .in("id", memberships.map((membership) => membership.organization_id));

  const roles = new Map(
    memberships.map((membership) => [membership.organization_id, membership.role]),
  );

  return (organizations ?? []).map((organization) => ({
    ...organization,
    role: roles.get(organization.id) ?? "viewer",
  }));
}

export async function getOrganizationWorkspace(slug: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!organization) return null;

  const { data: currentMembership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!currentMembership) return null;

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, role, joined_at")
    .eq("organization_id", organization.id)
    .order("joined_at");

  const memberIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", memberIds)
    : { data: [] };
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const canManage = currentMembership.role === "owner" || currentMembership.role === "admin";

  const { data: invitations } = canManage
    ? await supabase
        .from("organization_invitations")
        .select("id, email, role, created_at, expires_at")
        .eq("organization_id", organization.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] };

  return {
    organization,
    currentRole: currentMembership.role,
    members: (members ?? []).map((member) => ({
      ...member,
      displayName: profileNames.get(member.user_id) ?? null,
    })),
    invitations: invitations ?? [],
  };
}
