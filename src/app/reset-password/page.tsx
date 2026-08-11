import { AuthNotice, AuthPanel, authInputClassName } from "@/components/auth/auth-panel";
import { Button } from "@/components/ui/button";
import { resetPasswordAction } from "@/features/auth/actions";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

type ResetPasswordPageProps = { searchParams: Promise<{ error?: string }> };

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  await requireAuthenticatedUser();
  const { error } = await searchParams;

  return (
    <AuthPanel title="Scegli una nuova password" description="La nuova password verrà applicata immediatamente.">
      {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
      <form action={resetPasswordAction} className="space-y-4">
        <label className="block space-y-2 text-sm font-medium">
          Nuova password
          <input className={authInputClassName} name="password" type="password" autoComplete="new-password" minLength={12} required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Conferma password
          <input className={authInputClassName} name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} required />
        </label>
        <Button className="w-full" size="lg" type="submit">Aggiorna password</Button>
      </form>
    </AuthPanel>
  );
}
