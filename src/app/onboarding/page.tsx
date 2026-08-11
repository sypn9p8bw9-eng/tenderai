import { redirect } from "next/navigation";

import { AuthNotice, authInputClassName } from "@/components/auth/auth-panel";
import { Button } from "@/components/ui/button";
import { createOrganizationAction } from "@/features/organizations/actions";
import { listUserOrganizations } from "@/features/organizations/queries";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

type OnboardingPageProps = { searchParams: Promise<{ error?: string }> };

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const user = await requireAuthenticatedUser();
  const organizations = await listUserOrganizations(user.id);

  if (organizations.length) redirect("/app");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">TenderAI</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Crea il tuo workspace</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Sarà il confine sicuro per utenti e dati della tua organizzazione.</p>
        <div className="mt-6">
          {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
          <form action={createOrganizationAction} className="space-y-4">
            <label className="block space-y-2 text-sm font-medium">
              Nome organizzazione
              <input className={authInputClassName} name="name" maxLength={120} required />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Identificatore workspace
              <input className={authInputClassName} name="slug" minLength={3} maxLength={63} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="acme-italia" required />
            </label>
            <p className="text-xs leading-5 text-muted-foreground">Usa lettere minuscole, numeri e trattini. L’identificatore sarà stabile negli URL.</p>
            <Button className="w-full" size="lg" type="submit">Crea workspace</Button>
          </form>
        </div>
      </section>
    </main>
  );
}
