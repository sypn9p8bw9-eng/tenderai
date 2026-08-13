import { ClipboardList, Filter } from "lucide-react";

import { EmptyState } from "@/components/app-shell/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";
import { CreateTenderForm } from "@/components/tenders/create-tender-form";
import { TenderCard } from "@/components/tenders/tender-card";
import { Button } from "@/components/ui/button";
import {
  tenderStatusLabels,
  tenderStatuses,
} from "@/features/tenders/constants";
import { listTenders } from "@/features/tenders/queries";
import { loadOrganizationContext } from "@/features/organizations/context";
import type { TenderStatus } from "@/types/database";

type TendersPageProps = {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ status?: string; error?: string; message?: string }>;
};

function selectedStatus(value?: string): TenderStatus | undefined {
  return tenderStatuses.includes(value as TenderStatus) ? (value as TenderStatus) : undefined;
}

export default async function TendersPage({ params, searchParams }: TendersPageProps) {
  const [{ organizationSlug }, parameters] = await Promise.all([params, searchParams]);
  const context = await loadOrganizationContext(organizationSlug);

  if (!context) return null;
  const status = selectedStatus(parameters.status);
  const tenders = await listTenders(context.organization.id, { status });
  const canContribute = context.role === "owner" || context.role === "admin" || context.role === "member";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tender Workspace"
        title="Gare"
        description="Organizza opportunità reali, documenti sorgente e informazioni operative del team. Le analisi dei requisiti non sono ancora attive."
      />

      {parameters.error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{parameters.error}</p> : null}
      {parameters.message ? <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">{parameters.message}</p> : null}

      {canContribute ? <CreateTenderForm organizationSlug={context.organization.slug} /> : (
        <section className="rounded-2xl border border-dashed bg-card p-5 text-sm leading-6 text-muted-foreground">
          Il tuo ruolo consente la consultazione delle gare. Per creare o modificare una gara, contatta un proprietario o un amministratore del workspace.
        </section>
      )}

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Workspace di gara</h2>
            <p className="mt-1 text-sm text-muted-foreground">Solo opportunità inserite dal tuo team.</p>
          </div>
          <form className="flex items-end gap-2" method="get">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Stato
              <select className="block h-9 rounded-lg border bg-background px-2 text-sm text-foreground" defaultValue={status ?? ""} name="status">
                <option value="">Tutti</option>
                {tenderStatuses.map((item) => <option key={item} value={item}>{tenderStatusLabels[item]}</option>)}
              </select>
            </label>
            <Button size="sm" type="submit" variant="outline"><Filter aria-hidden="true" className="size-3.5" />Filtra</Button>
          </form>
        </div>

        {tenders.length ? <div className="grid gap-4">{tenders.map((tender) => (
          <TenderCard key={tender.id} organizationSlug={context.organization.slug} tender={tender} />
        ))}</div> : (
          <EmptyState
            eyebrow="Gare"
            icon={parameters.status ? <Filter aria-hidden="true" className="size-5" /> : <ClipboardList aria-hidden="true" className="size-5" />}
            title={parameters.status ? "Nessuna gara corrisponde al filtro." : "Crea il primo workspace gara."}
            description={parameters.status ? "Modifica il filtro per vedere altre opportunità del workspace." : "Aggiungi una gara reale per raccogliere documenti e informazioni operative. TenderAI non ha ancora analizzato alcun requisito."}
          />
        )}
      </section>
    </div>
  );
}
