import { ArrowRight, Archive, ClipboardList, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { loadOrganizationContext } from "@/features/organizations/context";
import { organizationRoleLabels } from "@/features/organizations/role-labels";
import { cn } from "@/lib/utils";

type WorkspacePageProps = { params: Promise<{ organizationSlug: string }> };

const operationalAreas = [
  {
    href: "tenders",
    icon: ClipboardList,
    title: "Gare",
    description: "Organizza le opportunità e prepara un percorso di verifica prima della candidatura.",
  },
  {
    href: "evidence",
    icon: Archive,
    title: "Archivio evidenze",
    description: "Raccogli in un unico luogo i documenti e le evidenze riutilizzabili dell'azienda.",
  },
  {
    href: "team",
    icon: Users,
    title: "Team",
    description: "Gestisci le persone autorizzate a lavorare in questo workspace.",
  },
];

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { organizationSlug } = await params;
  const context = await loadOrganizationContext(organizationSlug);

  if (!context) return null;
  const basePath = `/app/${context.organization.slug}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={organizationRoleLabels[context.role]}
        title={context.organization.name}
        description="Uno spazio operativo per valutare opportunità, coordinare il team e preparare evidenze verificabili."
        action={
          <Link className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")} href={`${basePath}/team`}>
            Gestisci il team
          </Link>
        }
      />

      <section className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-6 sm:p-7">
        <p className="text-sm font-semibold">Costruisci una base affidabile prima di ogni gara.</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          TenderAI supporta il lavoro del team con informazioni strutturate e verificabili. Le decisioni di partecipazione e la verifica finale restano sempre responsabilità delle persone autorizzate.
        </p>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Aree operative</h2>
          <p className="mt-1 text-sm text-muted-foreground">Prepara il workspace per i prossimi flussi di lavoro del team.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {operationalAreas.map((area) => {
            const Icon = area.icon;

            return (
              <Link
                key={area.href}
                className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
                href={`${basePath}/${area.href}`}
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="mt-5 font-semibold">{area.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{area.description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Apri area
                  <ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
