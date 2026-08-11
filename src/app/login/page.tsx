import Link from "next/link";

import { AuthNotice, AuthPanel, authInputClassName } from "@/components/auth/auth-panel";
import { Button } from "@/components/ui/button";
import { signInAction } from "@/features/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const parameters = await searchParams;

  return (
    <AuthPanel
      title="Accedi"
      description="Entra nel tuo workspace TenderAI."
      footer={
        <>
          Non hai un account?{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href={`/signup${parameters.next ? `?next=${encodeURIComponent(parameters.next)}` : ""}`}>
            Registrati
          </Link>
        </>
      }
    >
      {parameters.error ? <AuthNotice tone="error">{parameters.error}</AuthNotice> : null}
      {parameters.message ? <AuthNotice>{parameters.message}</AuthNotice> : null}
      <form action={signInAction} className="space-y-4">
        <input type="hidden" name="next" value={parameters.next ?? "/app"} />
        <label className="block space-y-2 text-sm font-medium">
          Email
          <input className={authInputClassName} name="email" type="email" autoComplete="email" required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Password
          <input className={authInputClassName} name="password" type="password" autoComplete="current-password" minLength={12} required />
        </label>
        <div className="flex justify-end">
          <Link className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href="/forgot-password">
            Password dimenticata?
          </Link>
        </div>
        <Button className="w-full" size="lg" type="submit">Accedi</Button>
      </form>
    </AuthPanel>
  );
}
