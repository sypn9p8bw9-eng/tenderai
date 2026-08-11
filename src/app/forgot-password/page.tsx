import Link from "next/link";

import { AuthNotice, AuthPanel, authInputClassName } from "@/components/auth/auth-panel";
import { Button } from "@/components/ui/button";
import { requestPasswordResetAction } from "@/features/auth/actions";

type ForgotPasswordPageProps = { searchParams: Promise<{ error?: string }> };

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { error } = await searchParams;

  return (
    <AuthPanel title="Reimposta la password" description="Ti invieremo un link sicuro se l’account esiste." footer={<Link className="font-medium text-foreground hover:underline" href="/login">Torna all’accesso</Link>}>
      {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
      <form action={requestPasswordResetAction} className="space-y-4">
        <label className="block space-y-2 text-sm font-medium">
          Email
          <input className={authInputClassName} name="email" type="email" autoComplete="email" required />
        </label>
        <Button className="w-full" size="lg" type="submit">Invia link</Button>
      </form>
    </AuthPanel>
  );
}
