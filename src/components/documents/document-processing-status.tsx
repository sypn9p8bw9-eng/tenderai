import {
  CircleCheckBig,
  Clock3,
  LoaderCircle,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { retryDocumentProcessingAction } from "@/features/document-processing/actions";
import type { DocumentProcessingJob } from "@/features/document-processing/queries";
import type { DocumentProcessingStatus } from "@/types/database";

type DocumentProcessingStatusProps = {
  canRetry: boolean;
  job: DocumentProcessingJob | null;
  organizationSlug: string;
  source: "evidence" | "tender";
  tenderId?: string;
};

const statusLabels: Record<DocumentProcessingStatus, string> = {
  queued: "In coda",
  processing: "In elaborazione",
  completed: "Completato",
  failed: "Non riuscito",
};

const statusDescriptions: Record<DocumentProcessingStatus, string> = {
  queued: "Documento registrato e in attesa del servizio di elaborazione.",
  processing: "Estrazione tecnica del contenuto in corso.",
  completed: "Elaborazione tecnica completata.",
  failed: "L'elaborazione tecnica non è stata completata.",
};

const statusClassNames: Record<DocumentProcessingStatus, string> = {
  queued: "border-slate-200 bg-slate-50 text-slate-700",
  processing: "border-sky-200 bg-sky-50 text-sky-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
};

function ProcessingIcon({ status }: { status: DocumentProcessingStatus }) {
  if (status === "processing") {
    return <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />;
  }

  if (status === "completed") {
    return <CircleCheckBig aria-hidden="true" className="size-4" />;
  }

  if (status === "failed") {
    return <TriangleAlert aria-hidden="true" className="size-4" />;
  }

  return <Clock3 aria-hidden="true" className="size-4" />;
}

export function DocumentProcessingStatusCard({
  canRetry,
  job,
  organizationSlug,
  source,
  tenderId = "",
}: DocumentProcessingStatusProps) {
  if (!job) {
    return (
      <div className="mt-4 rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Stato di elaborazione non ancora disponibile.
      </div>
    );
  }

  const retryAvailable = canRetry
    && job.status === "failed"
    && job.attempt_number < job.max_attempts;

  return (
    <section className="mt-4 rounded-xl border bg-muted/20 px-4 py-3" aria-label="Stato elaborazione documento">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassNames[job.status]}`}>
              <ProcessingIcon status={job.status} />
              {statusLabels[job.status]}
            </span>
            <span className="text-xs text-muted-foreground">
              Tentativo {job.attempt_number} di {job.max_attempts}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {job.status === "failed" && job.last_error_message
              ? job.last_error_message
              : statusDescriptions[job.status]}
          </p>
          {job.status === "failed" && job.last_error_code ? (
            <p className="mt-1 text-xs text-muted-foreground">Codice errore: {job.last_error_code}</p>
          ) : null}
        </div>

        {retryAvailable ? (
          <form action={retryDocumentProcessingAction}>
            <input name="organizationSlug" type="hidden" value={organizationSlug} />
            <input name="jobId" type="hidden" value={job.id} />
            <input name="source" type="hidden" value={source} />
            <input name="tenderId" type="hidden" value={tenderId} />
            <Button size="sm" type="submit" variant="outline">
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Riprova
            </Button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
