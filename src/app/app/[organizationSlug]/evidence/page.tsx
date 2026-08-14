import { Archive, Filter, FileStack } from "lucide-react";

import { EvidenceDocumentCard } from "@/components/evidence/evidence-document-card";
import { EvidenceUploadForm } from "@/components/evidence/evidence-upload-form";
import { PageHeader } from "@/components/app-shell/page-header";
import { AuthNotice } from "@/components/auth/auth-panel";
import { Button } from "@/components/ui/button";
import { listLatestEvidenceProcessingJobs } from "@/features/document-processing/queries";
import {
  evidenceDocumentCategories,
  evidenceDocumentCategoryLabels,
  evidenceDocumentStatusLabels,
  evidenceDocumentStatuses,
} from "@/features/evidence/constants";
import { listEvidenceDocuments } from "@/features/evidence/queries";
import { loadOrganizationContext } from "@/features/organizations/context";
import type {
  EvidenceDocumentCategory,
  EvidenceDocumentStatus,
} from "@/types/database";

type EvidencePageProps = {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ category?: string; status?: string; error?: string; message?: string }>;
};

function selectedCategory(value?: string): EvidenceDocumentCategory | undefined {
  return evidenceDocumentCategories.includes(value as EvidenceDocumentCategory)
    ? (value as EvidenceDocumentCategory)
    : undefined;
}

function selectedStatus(value?: string): EvidenceDocumentStatus | undefined {
  return evidenceDocumentStatuses.includes(value as EvidenceDocumentStatus)
    ? (value as EvidenceDocumentStatus)
    : undefined;
}

export default async function EvidencePage({ params, searchParams }: EvidencePageProps) {
  const [{ organizationSlug }, parameters] = await Promise.all([params, searchParams]);
  const context = await loadOrganizationContext(organizationSlug);

  if (!context) return null;

  const category = selectedCategory(parameters.category);
  const status = selectedStatus(parameters.status);
  const documents = await listEvidenceDocuments(context.organization.id, { category, status });
  const processingJobs = await listLatestEvidenceProcessingJobs(
    context.organization.id,
    documents.map((document) => document.id),
  );
  const canContribute = context.role === "owner" || context.role === "admin" || context.role === "member";
  const canManage = context.role === "owner" || context.role === "admin";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Company Evidence Vault"
        title="Archivio evidenze aziendali"
        description="Organizza documenti riutilizzabili e rendili disponibili al team. In futuro TenderAI potrà confrontare queste evidenze con i requisiti dei bandi."
      />

      {parameters.error ? <AuthNotice tone="error">{parameters.error}</AuthNotice> : null}
      {parameters.message ? <AuthNotice>{parameters.message}</AuthNotice> : null}

      {canContribute ? (
        <EvidenceUploadForm organizationSlug={context.organization.slug} />
      ) : (
        <section className="rounded-2xl border border-dashed bg-card p-5 text-sm leading-6 text-muted-foreground">
          Il tuo ruolo consente la consultazione dell&apos;archivio. Per aggiungere o modificare evidenze, contatta un proprietario o un amministratore del workspace.
        </section>
      )}

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Documenti del workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">Solo contenuti reali caricati dal tuo team.</p>
          </div>
          <form className="flex flex-wrap items-end gap-2" method="get">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Categoria
              <select className="block h-9 rounded-lg border bg-background px-2 text-sm text-foreground" defaultValue={category ?? ""} name="category">
                <option value="">Tutte</option>
                {evidenceDocumentCategories.map((item) => (
                  <option key={item} value={item}>{evidenceDocumentCategoryLabels[item]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Stato
              <select className="block h-9 rounded-lg border bg-background px-2 text-sm text-foreground" defaultValue={status ?? ""} name="status">
                <option value="">Tutti</option>
                {evidenceDocumentStatuses.map((item) => (
                  <option key={item} value={item}>{evidenceDocumentStatusLabels[item]}</option>
                ))}
              </select>
            </label>
            <Button size="sm" type="submit" variant="outline">
              <Filter aria-hidden="true" className="size-3.5" />
              Filtra
            </Button>
          </form>
        </div>

        {documents.length ? (
          <div className="grid gap-4">
            {documents.map((document) => (
              <EvidenceDocumentCard
                key={document.id}
                canContribute={canContribute}
                canManage={canManage}
                document={document}
                organizationSlug={context.organization.slug}
                processingJob={processingJobs.get(document.id) ?? null}
              />
            ))}
          </div>
        ) : (
          <section className="rounded-2xl border bg-card px-6 py-12 text-center shadow-sm sm:px-10">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-primary">
              {parameters.category || parameters.status ? <Filter aria-hidden="true" className="size-5" /> : <FileStack aria-hidden="true" className="size-5" />}
            </span>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">
              {parameters.category || parameters.status ? "Nessun documento corrisponde ai filtri." : "L'archivio è pronto per le prime evidenze."}
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {parameters.category || parameters.status
                ? "Modifica i filtri oppure aggiungi un nuovo documento quando disponibile."
                : "Carica certificazioni, dichiarazioni, referenze e altri documenti riutilizzabili. La revisione umana resta necessaria prima della presentazione."}
            </p>
            <Archive aria-hidden="true" className="mx-auto mt-5 size-4 text-muted-foreground" />
          </section>
        )}
      </section>
    </div>
  );
}
