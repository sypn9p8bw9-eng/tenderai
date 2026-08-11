import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { organizationRoleLabels } from "@/features/organizations/role-labels";
import type { UserOrganization } from "@/features/organizations/queries";
import type { OrganizationRole } from "@/types/database";

import { OrganizationSwitcher } from "./organization-switcher";
import { WorkspaceNavigation } from "./workspace-navigation";

type OrganizationAppShellProps = {
  children: ReactNode;
  organization: { id: string; name: string; slug: string };
  organizations: UserOrganization[];
  role: OrganizationRole;
  userEmail?: string;
};

export function OrganizationAppShell({
  children,
  organization,
  organizations,
  role,
  userEmail,
}: OrganizationAppShellProps) {
  const basePath = `/app/${organization.slug}`;

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r bg-background px-4 py-5 lg:flex">
          <Link className="mb-6 flex items-center gap-2.5 px-2" href="/app">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              T
            </span>
            <span className="font-semibold tracking-tight">TenderAI</span>
          </Link>

          <OrganizationSwitcher
            currentOrganization={organization}
            currentRole={role}
            organizations={organizations}
          />

          <div className="mt-7">
            <p className="mb-2 px-3 text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Workspace
            </p>
            <WorkspaceNavigation basePath={basePath} variant="sidebar" />
          </div>

          <div className="mt-auto rounded-xl border bg-muted/35 p-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs font-medium">Accesso al workspace</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Il tuo ruolo: {organizationRoleLabels[role].toLowerCase()}.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 border-t pt-3">
            <p className="truncate px-2 text-xs text-muted-foreground">{userEmail}</p>
            <form action={signOutAction} className="mt-2">
              <Button className="w-full justify-start" size="sm" type="submit" variant="ghost">
                Esci dall&apos;account
              </Button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <Link className="flex items-center gap-2 font-semibold tracking-tight" href="/app">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                  T
                </span>
                TenderAI
              </Link>
              <form action={signOutAction}>
                <Button size="sm" type="submit" variant="ghost">Esci</Button>
              </form>
            </div>
            <div className="px-4 pb-3">
              <OrganizationSwitcher
                currentOrganization={organization}
                currentRole={role}
                organizations={organizations}
              />
            </div>
            <div className="overflow-x-auto border-t">
              <WorkspaceNavigation basePath={basePath} variant="mobile" />
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
