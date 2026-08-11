import { Building2, ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { listUserOrganizations } from "@/features/organizations/queries";
import { organizationRoleLabels } from "@/features/organizations/role-labels";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { cn } from "@/lib/utils";

export default async function ApplicationPage() {
  const user = await requireAuthenticatedUser();
  const organizations = await listUserOrganizations(user.id);

  if (!organizations.length) redirect("/onboarding");

  return (
    <main className="min-h-screen">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
          <Link className="flex items-center gap-2.5 font-semibold tracking-tight" href="/app">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              T
            </span>
            TenderAI
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:block">{user.email}</span>
            <form action={signOutAction}>
              <Button size="sm" type="submit" variant="ghost">
                <LogOut aria-hidden="true" className="size-4" />
                <span className="sr-only sm:not-sr-only">Esci</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">I tuoi workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Scegli lo spazio operativo del tuo team.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Ogni workspace riunisce persone, processi e dati della relativa organizzazione.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizations.map((organization) => (
            <article key={organization.id} className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-primary">
                  <Building2 aria-hidden="true" className="size-5" />
                </span>
                <span className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {organizationRoleLabels[organization.role]}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold">{organization.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Workspace: {organization.slug}</p>
              <Link
                className={cn(buttonVariants({ variant: "outline" }), "mt-6 w-full justify-between")}
                href={`/app/${organization.slug}`}
              >
                Apri workspace
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
