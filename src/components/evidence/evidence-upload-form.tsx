import { FileUp, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EVIDENCE_MAX_FILE_SIZE_BYTES,
  evidenceDocumentCategories,
  evidenceDocumentCategoryLabels,
  evidenceFileInputAccept,
} from "@/features/evidence/constants";
import { uploadEvidenceDocumentAction } from "@/features/evidence/actions";

type EvidenceUploadFormProps = {
  organizationSlug: string;
};

const inputClassName = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30";

export function EvidenceUploadForm({ organizationSlug }: EvidenceUploadFormProps) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileUp aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Aggiungi un&apos;evidenza</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Carica documenti aziendali riutilizzabili per le future analisi di gara.
          </p>
        </div>
      </div>

      <form action={uploadEvidenceDocumentAction} className="mt-6 grid gap-4 lg:grid-cols-2">
        <input name="organizationSlug" type="hidden" value={organizationSlug} />
        <label className="space-y-2 text-sm font-medium">
          Titolo
          <input className={inputClassName} maxLength={160} name="title" placeholder="Es. Certificazione ISO 9001" required />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Categoria
          <select className={inputClassName} defaultValue="certification" name="category">
            {evidenceDocumentCategories.map((category) => (
              <option key={category} value={category}>{evidenceDocumentCategoryLabels[category]}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium lg:col-span-2">
          Descrizione <span className="font-normal text-muted-foreground">(facoltativa)</span>
          <textarea className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30" maxLength={2000} name="description" placeholder="Contesto o note utili per il team." />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Data di rilascio <span className="font-normal text-muted-foreground">(facoltativa)</span>
          <input className={inputClassName} name="issuedAt" type="date" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Data di scadenza <span className="font-normal text-muted-foreground">(facoltativa)</span>
          <input className={inputClassName} name="expiresAt" type="date" />
        </label>
        <label className="space-y-2 text-sm font-medium lg:col-span-2">
          File
          <input
            accept={evidenceFileInputAccept}
            className="block w-full cursor-pointer rounded-lg border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            name="file"
            required
            type="file"
          />
          <span className="block text-xs font-normal leading-5 text-muted-foreground">
            PDF, Word, Excel, JPG, PNG o WEBP. Dimensione massima: {EVIDENCE_MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.
          </span>
        </label>
        <div className="flex flex-col gap-3 border-t pt-5 lg:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex max-w-xl items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            Il documento rimane privato nel workspace. La revisione umana resta necessaria prima della presentazione.
          </p>
          <Button size="lg" type="submit">Carica evidenza</Button>
        </div>
      </form>
    </section>
  );
}
