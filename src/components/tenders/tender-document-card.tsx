import { Download, FileText } from "lucide-react";

import { DocumentProcessingStatusCard } from "@/components/documents/document-processing-status";
import { Button } from "@/components/ui/button";
import type { DocumentProcessingJob } from "@/features/document-processing/queries";
import { downloadTenderDocumentAction } from "@/features/tenders/actions";
import {
  formatTenderFileSize,
  tenderDocumentTypeLabels,
} from "@/features/tenders/constants";
import type { TenderDocument } from "@/features/tenders/queries";

type TenderDocumentCardProps = {
  document: TenderDocument;
  organizationSlug: string;
  tenderId: string;
  canRetry: boolean;
  processingJob: DocumentProcessingJob | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
}

export function TenderDocumentCard({
  canRetry,
  document,
  organizationSlug,
  processingJob,
  tenderId,
}: TenderDocumentCardProps) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
            <FileText aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{document.title}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{tenderDocumentTypeLabels[document.document_type]}</p>
            <p className="mt-2 truncate text-xs text-muted-foreground" title={document.file_name}>
              {document.file_name} · {formatTenderFileSize(document.file_size_bytes)} · Caricato il {formatDate(document.created_at)}
            </p>
          </div>
        </div>
        <form action={downloadTenderDocumentAction}>
          <input name="organizationSlug" type="hidden" value={organizationSlug} />
          <input name="tenderId" type="hidden" value={tenderId} />
          <input name="documentId" type="hidden" value={document.id} />
          <Button size="sm" type="submit" variant="outline">
            <Download aria-hidden="true" className="size-3.5" />
            Scarica
          </Button>
        </form>
      </div>

      <DocumentProcessingStatusCard
        canRetry={canRetry}
        job={processingJob}
        organizationSlug={organizationSlug}
        source="tender"
        tenderId={tenderId}
      />
    </article>
  );
}
