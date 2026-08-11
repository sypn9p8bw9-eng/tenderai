import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrganizationRole } from "@/types/database";

export type UserOrganization = {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
};

export type OrganizationContextRecord = {
  organization: Omit<UserOrganization, "role">;
  role: OrganizationRole;
};

export type OrganizationMember = {
  user_id: string;
  role: OrganizationRole;
  joined_at: string;
  displayName: string | null;
};

export type OrganizationInvitation = {
  id: string;
  email: string;
  role: OrganizationRole;
  created_at: string;
  expires_at: string;
};

function queryFailure(scope: string) {
  return new Error(`Unable to load ${scope}.`);
}

/**
 * Returns the organizations visible to a user under the caller's RLS session.
 * The user id must always come from a verified server-side Supabase user.
 */
export async function listUserOrganizations(userId: string): Promise<UserOrganization[]> {
  const supabase = await createSupabaseServerClient();
  const { data: memberships, error: membershipsError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId);

  if (membershipsError) throw queryFailure("workspace memberships");
  if (!memberships?.length) return [];

  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .in("id", memberships.map((membership) => membership.organization_id))
    .order("name");

  if (organizationsError) throw queryFailure("workspaces");

  const roles = new Map(
    memberships.map((membership) => [membership.organization_id, membership.role]),
  );

  return (organizations ?? []).flatMap((organization) => {
    const role = roles.get(organization.id);

    return role ? [{ ...organization, role }] : [];
  });
}

/**
 * Resolves an organization from its navigational slug and the authenticated
 * caller's RLS session. A slug is never treated as proof of access.
 */
export async function getOrganizationContextForUser(
  slug: string,
  userId: string,
): Promise<OrganizationContextRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (organizationError) throw queryFailure("workspace");
  if (!organization) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) throw queryFailure("workspace membership");
  if (!membership) return null;

  return { organization, role: membership.role };
}

/** Loads only the team data needed by the dedicated Team page. */
export async function getOrganizationTeam(
  organizationId: string,
  canManage: boolean,
): Promise<{ members: OrganizationMember[]; invitations: OrganizationInvitation[] }> {
  const supabase = await createSupabaseServerClient();
  const { data: members, error: membersError } = await supabase
    .from("organization_members")
    .select("user_id, role, joined_at")
    .eq("organization_id", organizationId)
    .order("joined_at");

  if (membersError) throw queryFailure("workspace members");

  const memberIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles, error: profilesError } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", memberIds)
    : { data: [], error: null };

  if (profilesError) throw queryFailure("member profiles");

  const profileNames = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name]),
  );

  if (!canManage) {
    return {
      members: (members ?? []).map((member) => ({
        ...member,
        displayName: profileNames.get(member.user_id) ?? null,
      })),
      invitations: [],
    };
  }

  const { data: invitations, error: invitationsError } = await supabase
    .from("organization_invitations")
    .select("id, email, role, created_at, expires_at")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (invitationsError) throw queryFailure("pending invitations");

  return {
    members: (members ?? []).map((member) => ({
      ...member,
      displayName: profileNames.get(member.user_id) ?? null,
    })),
    invitations: invitations ?? [],
  };
}
