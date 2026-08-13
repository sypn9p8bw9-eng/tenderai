import { ArrowLeft, CalendarDays, ClipboardList } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { TenderDocumentCard } from "@/components/tenders/tender-document-card";
import { TenderDocumentUploadForm } from "@/components/tenders/tender-document-upload-form";
import { TenderMetadataForm } from "@/components/tenders/tender-metadata-form";
import { buttonVariants } from "@/components/ui/button";
import {
  formatTenderDeadline,
  tenderProcedureTypeLabels,
  tenderStatusLabels,
} from "@/features/tenders/constants";
import { getTender, listTenderDocuments } from "@/features/tenders/queries";
import { loadOrganizationContext } from "@/features/organizations/context";
import { cn } from "@/lib/utils";

type TenderWorkspacePageProps = {
  params: Promise<{ organizationSlug: string; tenderId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function TenderWorkspacePage({ params, searchParams }: TenderWorkspacePageProps) {
  const [{ organizationSlug, tenderId }, parameters] = await Promise.all([params, searchParams]);
  const context = await loadOrganizationContext(organizationSlug);

  if (!context) notFound();

  const tender = await getTender(context.organization.id, tenderId);
  if (!tender) notFound();

  const documents = await listTenderDocuments(context.organization.id, tender.id);
  const canContribute = context.role === "owner" || context.role === "admin" || context.role === "member";
  const canManage = context.role === "owner" || context.role === "admin";
  const isArchived = tender.status === "archived";

  return (
    <div className="space-y-8">
      <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")} href={`/app/${context.organization.slug}/tenders`}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Tutte le gare
      </Link>

      <PageHeader
        eyebrow="Workspace gara"
        title={tender.title}
        description={`${tenderStatusLabels[tender.status]}${tender.buyer_name ? ` · ${tender.buyer_name}` : ""}${tender.procedure_type ? ` · ${tenderProcedureTypeLabels[tender.procedure_type]}` : ""}`}
      />

      <section className="grid gap-4 rounded-2xl border border-primary/15 bg-primary/[0.035] p-5 text-sm sm:grid-cols-3 sm:p-6">
        <div className="flex items-start gap-2"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 text-primary" /><div><p className="text-xs text-muted-foreground">Scadenza</p><p className="mt-1 font-semibold">{formatTenderDeadline(tender.submission_deadline)}</p></div></div>
        <div><p className="text-xs text-muted-foreground">CIG</p><p className="mt-1 font-semibold">{tender.cig || "Non indicato"}</p></div>
        <div><p className="text-xs text-muted-foreground">CUP</p><p className="mt-1 font-semibold">{tender.cup || "Non indicato"}</p></div>
      </section>

      {parameters.error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{parameters.error}</p> : null}
      {parameters.message ? <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">{parameters.message}</p> : null}

      <TenderMetadataForm
        canContribute={canContribute}
        canManage={canManage}
        organizationSlug={context.organization.slug}
        tender={tender}
      />

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Documenti di gara</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">I documenti restano privati nel workspace. L&apos;analisi AI dei requisiti sarà introdotta in una milestone successiva.</p>
        </div>

        {canContribute && !isArchived ? <TenderDocumentUploadForm organizationSlug={context.organization.slug} tenderId={tender.id} /> : (
          <section className="rounded-2xl border border-dashed bg-card p-5 text-sm leading-6 text-muted-foreground">
            {isArchived ? "Questa gara è archiviata: non è possibile aggiungere nuovi documenti." : "Il tuo ruolo consente la consultazione dei documenti. Per aggiungerne uno, contatta un proprietario o un amministratore del workspace."}
          </section>
        )}

        {documents.length ? <div className="grid gap-3">{documents.map((document) => (
          <TenderDocumentCard key={document.id} document={document} organizationSlug={context.organization.slug} tenderId={tender.id} />
        ))}</div> : (
          <section className="rounded-2xl border bg-card px-6 py-10 text-center shadow-sm">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-primary"><ClipboardList aria-hidden="true" className="size-5" /></span>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">Nessun documento di gara caricato.</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Carica bando, disciplinare, capitolato o allegati quando disponibili. La revisione umana resta necessaria prima della presentazione.</p>
          </section>
        )}
      </section>
    </div>
  );
}
