import Link from "next/link";
import { notFound } from "next/navigation";

import { InviteMemberForm } from "@/components/organizations/invite-member-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { removeMemberAction, revokeInvitationAction } from "@/features/organizations/actions";
import { getOrganizationWorkspace } from "@/features/organizations/queries";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { cn } from "@/lib/utils";

const roleLabels = { owner: "Proprietario", admin: "Admin", member: "Membro", viewer: "Visualizzatore" } as const;

type WorkspacePageProps = { params: Promise<{ organizationSlug: string }> };

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const user = await requireAuthenticatedUser();
  const { organizationSlug } = await params;
  const workspace = await getOrganizationWorkspace(organizationSlug, user.id);

  if (!workspace) notFound();
  const canManage = workspace.currentRole === "owner" || workspace.currentRole === "admin";

  return (
    <main className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="text-sm text-muted-foreground hover:text-foreground" href="/app">← Tutti i workspace</Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{workspace.organization.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ruolo: {roleLabels[workspace.currentRole]}</p>
        </div>
        <span className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">Tenant verificato via RLS</span>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Membri</h2>
          <p className="mt-1 text-sm text-muted-foreground">Persone autorizzate ad accedere a questo workspace.</p>
        </div>
        <div className="divide-y">
          {workspace.members.map((member) => {
            const mayRemove = canManage && member.role !== "owner" && member.user_id !== user.id && (workspace.currentRole === "owner" || member.role === "member" || member.role === "viewer");
            return (
              <div key={member.user_id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.displayName ?? (member.user_id === user.id ? user.email : "Membro del workspace")}</p>
                  <p className="text-xs text-muted-foreground">{roleLabels[member.role]}</p>
                </div>
                {mayRemove ? (
                  <form action={removeMemberAction}>
                    <input type="hidden" name="organizationId" value={workspace.organization.id} />
                    <input type="hidden" name="organizationSlug" value={workspace.organization.slug} />
                    <input type="hidden" name="userId" value={member.user_id} />
                    <Button variant="ghost" type="submit">Rimuovi</Button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {canManage ? (
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Invita un collega</h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">Il link contiene un token monouso; il database conserva soltanto il suo hash.</p>
          <InviteMemberForm organizationId={workspace.organization.id} organizationSlug={workspace.organization.slug} canInviteAdmin={workspace.currentRole === "owner"} />

          {workspace.invitations.length ? (
            <div className="mt-7 border-t pt-5">
              <h3 className="text-sm font-semibold">Inviti in attesa</h3>
              <div className="mt-2 divide-y">
                {workspace.invitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center justify-between gap-4 py-3">
                    <div><p className="text-sm font-medium">{invitation.email}</p><p className="text-xs text-muted-foreground">{roleLabels[invitation.role]} · scade {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(invitation.expires_at))}</p></div>
                    <form action={revokeInvitationAction}>
                      <input type="hidden" name="invitationId" value={invitation.id} />
                      <input type="hidden" name="organizationSlug" value={workspace.organization.slug} />
                      <Button variant="ghost" type="submit">Revoca</Button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <Link className={cn(buttonVariants({ variant: "outline" }))} href="/app">Cambia workspace</Link>
    </main>
  );
}
