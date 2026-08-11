import Link from "next/link";

import { AuthNotice, AuthPanel } from "@/components/auth/auth-panel";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "@/features/organizations/actions";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

type AcceptInvitationPageProps = { searchParams: Promise<{ token?: string; error?: string }> };

export default async function AcceptInvitationPage({ searchParams }: AcceptInvitationPageProps) {
  const user = await requireAuthenticatedUser();
  const { token, error } = await searchParams;

  return (
    <AuthPanel title="Accetta l’invito" description={`Se l’invito è valido e destinato a ${user.email}, entrerai nel workspace con il ruolo assegnato.`} footer={<Link className="font-medium text-foreground hover:underline" href="/app">Torna ai workspace</Link>}>
      {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
      {token ? (
        <form action={acceptInvitationAction}>
          <input type="hidden" name="token" value={token} />
          <Button className="w-full" size="lg" type="submit">Accetta invito</Button>
        </form>
      ) : (
        <AuthNotice tone="error">Token di invito mancante.</AuthNotice>
      )}
    </AuthPanel>
  );
}
