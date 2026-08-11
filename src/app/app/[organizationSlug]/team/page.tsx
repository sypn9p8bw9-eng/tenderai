import { UserPlus, Users } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { AuthNotice } from "@/components/auth/auth-panel";
import { InviteMemberForm } from "@/components/organizations/invite-member-form";
import { MemberRoleForm } from "@/components/organizations/member-role-form";
import { Button } from "@/components/ui/button";
import { removeMemberAction, revokeInvitationAction } from "@/features/organizations/actions";
import { loadOrganizationContext } from "@/features/organizations/context";
import { getOrganizationTeam, type OrganizationMember } from "@/features/organizations/queries";
import { organizationRoleLabels } from "@/features/organizations/role-labels";
import type { OrganizationRole } from "@/types/database";

type TeamPageProps = {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
};

function allowedRoles(
  currentRole: OrganizationRole,
  member: OrganizationMember,
  isCurrentUser: boolean,
): Array<Exclude<OrganizationRole, "owner">> | null {
  if (member.role === "owner" || isCurrentUser) return null;
  if (currentRole === "owner") return ["admin", "member", "viewer"];
  if (currentRole === "admin" && (member.role === "member" || member.role === "viewer")) {
    return ["member", "viewer"];
  }

  return null;
}

function canRemoveMember(
  currentRole: OrganizationRole,
  member: OrganizationMember,
  isCurrentUser: boolean,
) {
  if (member.role === "owner" || isCurrentUser) return false;
  if (currentRole === "owner") return true;

  return currentRole === "admin" && (member.role === "member" || member.role === "viewer");
}

export default async function TeamPage({ params, searchParams }: TeamPageProps) {
  const [{ organizationSlug }, parameters] = await Promise.all([params, searchParams]);
  const context = await loadOrganizationContext(organizationSlug);

  if (!context) return null;
  const canManage = context.role === "owner" || context.role === "admin";
  const team = await getOrganizationTeam(context.organization.id, canManage);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collaborazione"
        title="Team e accessi"
        description="Gestisci le persone autorizzate a lavorare in questo workspace. I permessi applicati qui sono verificati dal database."
      />

      {parameters.error ? <AuthNotice tone="error">{parameters.error}</AuthNotice> : null}
      {parameters.message ? <AuthNotice>{parameters.message}</AuthNotice> : null}

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div>
            <div className="flex items-center gap-2">
              <Users aria-hidden="true" className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Membri del workspace</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Le persone elencate possono accedere solo alle informazioni per cui hanno un&apos;appartenenza attiva.
            </p>
          </div>
          <span className="w-fit rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {team.members.length} {team.members.length === 1 ? "membro" : "membri"}
          </span>
        </div>

        <div className="divide-y">
          {team.members.map((member) => {
            const isCurrentUser = member.user_id === context.user.id;
            const roles = allowedRoles(context.role, member, isCurrentUser);
            const canRemove = canRemoveMember(context.role, member, isCurrentUser);
            const memberName = isCurrentUser
              ? context.user.email ?? "Tu"
              : member.displayName ?? "Membro del workspace";

            return (
              <div key={member.user_id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{memberName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border bg-background px-2 py-0.5">
                      {organizationRoleLabels[member.role]}
                    </span>
                    {isCurrentUser ? <span>Questo sei tu</span> : null}
                  </div>
                </div>

                {canManage ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {roles && member.role !== "owner" ? (
                      <MemberRoleForm
                        allowedRoles={roles}
                        currentRole={member.role}
                        organizationId={context.organization.id}
                        organizationSlug={context.organization.slug}
                        userId={member.user_id}
                      />
                    ) : null}
                    {canRemove ? (
                      <form action={removeMemberAction}>
                        <input type="hidden" name="organizationId" value={context.organization.id} />
                        <input type="hidden" name="organizationSlug" value={context.organization.slug} />
                        <input type="hidden" name="userId" value={member.user_id} />
                        <Button type="submit" variant="ghost">Rimuovi</Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {canManage ? (
        <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
              <UserPlus aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Invita una persona</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Il collegamento è monouso e collegato all&apos;indirizzo email invitato. Copialo e condividilo tramite un canale approvato dalla tua organizzazione.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <InviteMemberForm
              canInviteAdmin={context.role === "owner"}
              organizationId={context.organization.id}
              organizationSlug={context.organization.slug}
            />
          </div>

          {team.invitations.length ? (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-sm font-semibold">Inviti in attesa</h3>
              <div className="mt-3 divide-y rounded-xl border">
                {team.invitations.map((invitation) => (
                  <div key={invitation.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{invitation.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {organizationRoleLabels[invitation.role]} · scade {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(invitation.expires_at))}
                      </p>
                    </div>
                    <form action={revokeInvitationAction}>
                      <input type="hidden" name="invitationId" value={invitation.id} />
                      <input type="hidden" name="organizationSlug" value={context.organization.slug} />
                      <Button size="sm" type="submit" variant="ghost">Revoca</Button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
