import Link from "next/link";

import { AuthNotice, AuthPanel, authInputClassName } from "@/components/auth/auth-panel";
import { Button } from "@/components/ui/button";
import { signUpAction } from "@/features/auth/actions";

type SignUpPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const parameters = await searchParams;

  return (
    <AuthPanel
      title="Crea il tuo account"
      description="Inizia con un workspace sicuro per il tuo team."
      footer={
        <>
          Hai già un account?{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href={`/login${parameters.next ? `?next=${encodeURIComponent(parameters.next)}` : ""}`}>
            Accedi
          </Link>
        </>
      }
    >
      {parameters.error ? <AuthNotice tone="error">{parameters.error}</AuthNotice> : null}
      <form action={signUpAction} className="space-y-4">
        <input type="hidden" name="next" value={parameters.next ?? "/onboarding"} />
        <label className="block space-y-2 text-sm font-medium">
          Email di lavoro
          <input className={authInputClassName} name="email" type="email" autoComplete="email" required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Password
          <input className={authInputClassName} name="password" type="password" autoComplete="new-password" minLength={12} required />
        </label>
        <p className="text-xs leading-5 text-muted-foreground">Usa almeno 12 caratteri. Potrebbe essere richiesta la verifica email.</p>
        <Button className="w-full" size="lg" type="submit">Crea account</Button>
      </form>
    </AuthPanel>
  );
}
