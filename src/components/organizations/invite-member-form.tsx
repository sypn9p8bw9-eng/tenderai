"use client";

import { useActionState } from "react";

import { authInputClassName } from "@/components/auth/auth-panel";
import { Button } from "@/components/ui/button";
import {
  createInvitationAction,
  type InvitationActionState,
} from "@/features/organizations/actions";

const initialState: InvitationActionState = {};

type InviteMemberFormProps = {
  organizationId: string;
  organizationSlug: string;
  canInviteAdmin: boolean;
};

export function InviteMemberForm({
  organizationId,
  organizationSlug,
  canInviteAdmin,
}: InviteMemberFormProps) {
  const [state, action, pending] = useActionState(createInvitationAction, initialState);

  return (
    <div className="space-y-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="organizationSlug" value={organizationSlug} />
        <label className="space-y-2 text-sm font-medium">
          Email del collega
          <input className={authInputClassName} name="email" type="email" autoComplete="email" required />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Ruolo
          <select className={authInputClassName} name="role" defaultValue="member">
            {canInviteAdmin ? <option value="admin">Admin</option> : null}
            <option value="member">Membro</option>
            <option value="viewer">Visualizzatore</option>
          </select>
        </label>
        <Button type="submit" disabled={pending}>{pending ? "Creazione…" : "Crea invito"}</Button>
      </form>
      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state.invitationUrl ? (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-medium">Link creato. Copialo ora: non verrà mostrato di nuovo.</p>
          <code className="mt-2 block break-all rounded bg-white/70 p-2 text-xs">{state.invitationUrl}</code>
        </div>
      ) : null}
    </div>
  );
}
