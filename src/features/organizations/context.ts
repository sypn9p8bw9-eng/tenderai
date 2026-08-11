import "server-only";

import { cache } from "react";

import { requireAuthenticatedUser } from "@/lib/auth/user";

import {
  getOrganizationContextForUser,
  listUserOrganizations,
} from "./queries";

/**
 * Request-scoped tenant context for organization routes. The authenticated user
 * is resolved on the server; the URL slug is navigation only and must satisfy
 * the existing RLS policies before a context is returned.
 */
export const loadOrganizationContext = cache(async (organizationSlug: string) => {
  const user = await requireAuthenticatedUser();
  const context = await getOrganizationContextForUser(organizationSlug, user.id);

  if (!context) return null;

  const organizations = await listUserOrganizations(user.id);

  return {
    ...context,
    organizations,
    user,
  };
});
