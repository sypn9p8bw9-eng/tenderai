import { Building2, ChevronsUpDown } from "lucide-react";
import Link from "next/link";

import { organizationRoleLabels } from "@/features/organizations/role-labels";
import type { UserOrganization } from "@/features/organizations/queries";
import type { OrganizationRole } from "@/types/database";
import { cn } from "@/lib/utils";

type OrganizationSwitcherProps = {
  currentOrganization: { id: string; name: string; slug: string };
  currentRole: OrganizationRole;
  organizations: UserOrganization[];
  className?: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.slice(0, 1))
    .join("")
    .toUpperCase();
}

export function OrganizationSwitcher({
  currentOrganization,
  currentRole,
  organizations,
  className,
}: OrganizationSwitcherProps) {
  return (
    <details className={cn("group relative", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl border border-border/80 bg-background px-3 py-2.5 text-left shadow-sm outline-none transition hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
          {initials(currentOrganization.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{currentOrganization.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {organizationRoleLabels[currentRole]}
          </span>
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </summary>

      <div className="absolute inset-x-0 z-30 mt-2 overflow-hidden rounded-xl border bg-popover p-1.5 shadow-xl shadow-black/10">
        <p className="px-2.5 pb-1.5 pt-1 text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          I tuoi workspace
        </p>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {organizations.map((organization) => {
            const isCurrent = organization.id === currentOrganization.id;

            return (
              <Link
                key={organization.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition hover:bg-muted",
                  isCurrent && "bg-muted",
                )}
                href={`/app/${organization.slug}`}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-[0.65rem] font-semibold text-muted-foreground">
                  {initials(organization.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{organization.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {organizationRoleLabels[organization.role]}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
        <div className="mt-1 border-t pt-1">
          <Link
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            href="/app"
          >
            <Building2 aria-hidden="true" className="size-4" />
            Visualizza tutti i workspace
          </Link>
        </div>
      </div>
    </details>
  );
}
