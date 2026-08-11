import { Button } from "@/components/ui/button";
import { updateMemberRoleAction } from "@/features/organizations/actions";
import { organizationRoleLabels } from "@/features/organizations/role-labels";
import type { OrganizationRole } from "@/types/database";

type MemberRoleFormProps = {
  organizationId: string;
  organizationSlug: string;
  userId: string;
  currentRole: Exclude<OrganizationRole, "owner">;
  allowedRoles: Array<Exclude<OrganizationRole, "owner">>;
};

export function MemberRoleForm({
  organizationId,
  organizationSlug,
  userId,
  currentRole,
  allowedRoles,
}: MemberRoleFormProps) {
  return (
    <form action={updateMemberRoleAction} className="flex items-center gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`member-role-${userId}`}>Ruolo membro</label>
      <select
        id={`member-role-${userId}`}
        className="h-8 rounded-lg border bg-background px-2 text-xs font-medium outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
        defaultValue={currentRole}
        name="role"
      >
        {allowedRoles.map((role) => (
          <option key={role} value={role}>{organizationRoleLabels[role]}</option>
        ))}
      </select>
      <Button size="sm" type="submit" variant="outline">Salva</Button>
    </form>
  );
}
