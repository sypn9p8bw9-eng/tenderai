import type { OrganizationRole } from "@/types/database";

export const organizationRoleLabels: Record<OrganizationRole, string> = {
  owner: "Proprietario",
  admin: "Amministratore",
  member: "Membro",
  viewer: "Visualizzatore",
};
