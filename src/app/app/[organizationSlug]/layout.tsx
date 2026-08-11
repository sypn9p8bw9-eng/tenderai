import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { OrganizationAppShell } from "@/components/app-shell/organization-app-shell";
import { loadOrganizationContext } from "@/features/organizations/context";

type OrganizationLayoutProps = {
  children: ReactNode;
  params: Promise<{ organizationSlug: string }>;
};

export default async function OrganizationLayout({ children, params }: OrganizationLayoutProps) {
  const { organizationSlug } = await params;
  const context = await loadOrganizationContext(organizationSlug);

  if (!context) notFound();

  return (
    <OrganizationAppShell
      organization={context.organization}
      organizations={context.organizations}
      role={context.role}
      userEmail={context.user.email}
    >
      {children}
    </OrganizationAppShell>
  );
}
