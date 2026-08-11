import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { listUserOrganizations } from "@/features/organizations/queries";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { cn } from "@/lib/utils";

const roleLabels = { owner: "Proprietario", admin: "Admin", member: "Membro", viewer: "Visualizzatore" } as const;

export default async function ApplicationPage() {
  const user = await requireAuthenticatedUser();
  const organizations = await listUserOrganizations(user.id);

  if (!organizations.length) redirect("/onboarding");

  return (
    <main>
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-muted-foreground">Workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Le tue organizzazioni</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Ogni workspace è isolato a livello database.</p>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {organizations.map((organization) => (
          <article key={organization.id} className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{roleLabels[organization.role]}</p>
            <h2 className="mt-2 text-lg font-semibold">{organization.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{organization.slug}</p>
            <Link className={cn(buttonVariants({ variant: "outline" }), "mt-5 w-full")} href={`/app/${organization.slug}`}>Apri workspace</Link>
          </article>
        ))}
      </div>
    </main>
  );
}
