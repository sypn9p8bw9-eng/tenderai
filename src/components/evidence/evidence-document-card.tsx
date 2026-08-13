import { Archive, CalendarDays, Download, FileText, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  editableEvidenceDocumentStatuses,
  evidenceDocumentCategories,
  evidenceDocumentCategoryLabels,
  evidenceDocumentStatusLabels,
  formatEvidenceFileSize,
} from "@/features/evidence/constants";
import {
  archiveEvidenceDocumentAction,
  downloadEvidenceDocumentAction,
  updateEvidenceDocumentAction,
} from "@/features/evidence/actions";
import type { EvidenceDocument } from "@/features/evidence/queries";

type EvidenceDocumentCardProps = {
  document: EvidenceDocument;
  organizationSlug: string;
  canContribute: boolean;
  canManage: boolean;
};

const inputClassName = "h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30";

const statusClassNames = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  expired: "border-rose-200 bg-rose-50 text-rose-800",
  expiring_soon: "border-amber-200 bg-amber-50 text-amber-800",
  needs_review: "border-sky-200 bg-sky-50 text-sky-800",
  archived: "border-border bg-muted text-muted-foreground",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

export function EvidenceDocumentCard({
  document,
  organizationSlug,
  canContribute,
  canManage,
}: EvidenceDocumentCardProps) {
  const canEdit = canContribute && (document.status !== "archived" || canManage);

  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
            <FileText aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold">{document.title}</h3>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClassNames[document.status]}`}>
                {evidenceDocumentStatusLabels[document.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{evidenceDocumentCategoryLabels[document.category]}</p>
          </div>
        </div>
        <form action={downloadEvidenceDocumentAction}>
          <input name="organizationSlug" type="hidden" value={organizationSlug} />
          <input name="documentId" type="hidden" value={document.id} />
          <Button size="sm" type="submit" variant="outline">
            <Download aria-hidden="true" className="size-3.5" />
            Scarica
          </Button>
        </form>
      </div>

      {document.description ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{document.description}</p> : null}

      <dl className="mt-5 grid gap-3 border-y py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">File</dt>
          <dd className="mt-1 truncate font-medium" title={document.file_name}>{document.file_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Dimensione</dt>
          <dd className="mt-1 font-medium">{formatEvidenceFileSize(document.file_size_bytes)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Caricato il</dt>
          <dd className="mt-1 font-medium">{formatDate(document.created_at.slice(0, 10))}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays aria-hidden="true" className="size-3" />Scadenza</dt>
          <dd className="mt-1 font-medium">{document.expires_at ? formatDate(document.expires_at) : "Non indicata"}</dd>
        </div>
      </dl>

      {canEdit ? (
        <details className="group mt-4">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground [&::-webkit-details-marker]:hidden">
            <Pencil aria-hidden="true" className="size-3.5" />
            Modifica metadati
          </summary>
          <form action={updateEvidenceDocumentAction} className="mt-4 grid gap-3 rounded-xl border bg-muted/30 p-4 lg:grid-cols-2">
            <input name="organizationSlug" type="hidden" value={organizationSlug} />
            <input name="documentId" type="hidden" value={document.id} />
            <label className="space-y-1.5 text-sm font-medium">
              Titolo
              <input className={inputClassName} defaultValue={document.title} maxLength={160} name="title" required />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Categoria
              <select className={inputClassName} defaultValue={document.category} name="category">
                {evidenceDocumentCategories.map((category) => (
                  <option key={category} value={category}>{evidenceDocumentCategoryLabels[category]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Stato
              <select className={inputClassName} defaultValue={document.status === "archived" ? "needs_review" : document.status} name="status">
                {editableEvidenceDocumentStatuses.map((status) => (
                  <option key={status} value={status}>{evidenceDocumentStatusLabels[status]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Data di rilascio
              <input className={inputClassName} defaultValue={document.issued_at ?? ""} name="issuedAt" type="date" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Data di scadenza
              <input className={inputClassName} defaultValue={document.expires_at ?? ""} name="expiresAt" type="date" />
            </label>
            <label className="space-y-1.5 text-sm font-medium lg:col-span-2">
              Descrizione
              <textarea className="min-h-20 w-full rounded-lg border bg-background px-2.5 py-2 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30" defaultValue={document.description ?? ""} maxLength={2000} name="description" />
            </label>
            <div className="flex justify-end lg:col-span-2">
              <Button size="sm" type="submit">Salva modifiche</Button>
            </div>
          </form>
        </details>
      ) : null}

      {canManage && document.status !== "archived" ? (
        <form action={archiveEvidenceDocumentAction} className="mt-4">
          <input name="organizationSlug" type="hidden" value={organizationSlug} />
          <input name="documentId" type="hidden" value={document.id} />
          <Button size="sm" type="submit" variant="ghost">
            <Archive aria-hidden="true" className="size-3.5" />
            Archivia documento
          </Button>
        </form>
      ) : null}
    </article>
  );
}
