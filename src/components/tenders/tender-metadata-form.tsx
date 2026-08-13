import { Archive, ExternalLink, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  archiveTenderAction,
  updateTenderAction,
} from "@/features/tenders/actions";
import {
  editableTenderStatuses,
  formatTenderCurrency,
  tenderDeadlineInputValue,
  tenderProcedureTypeLabels,
  tenderProcedureTypes,
  tenderStatusLabels,
} from "@/features/tenders/constants";
import type { Tender } from "@/features/tenders/queries";

type TenderMetadataFormProps = {
  tender: Tender;
  organizationSlug: string;
  canContribute: boolean;
  canManage: boolean;
};

const inputClassName = "h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30";

export function TenderMetadataForm({
  tender,
  organizationSlug,
  canContribute,
  canManage,
}: TenderMetadataFormProps) {
  const canEdit = canContribute && tender.status !== "archived";

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Informazioni della gara</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Dati dichiarati dal team; non rappresentano un&apos;analisi automatica.</p>
        </div>
        {tender.source_url ? (
          <a className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline" href={tender.source_url} rel="noreferrer" target="_blank">
            Apri fonte
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </div>

      {canEdit ? (
        <details className="group mt-5" open>
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground [&::-webkit-details-marker]:hidden">
            <Pencil aria-hidden="true" className="size-3.5" />
            Modifica metadati
          </summary>
          <form action={updateTenderAction} className="mt-4 grid gap-3 rounded-xl border bg-muted/30 p-4 lg:grid-cols-2">
            <input name="organizationSlug" type="hidden" value={organizationSlug} />
            <input name="tenderId" type="hidden" value={tender.id} />
            <label className="space-y-1.5 text-sm font-medium lg:col-span-2">
              Titolo
              <input className={inputClassName} defaultValue={tender.title} maxLength={200} minLength={2} name="title" required />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Stato
              <select className={inputClassName} defaultValue={tender.status} name="status">
                {editableTenderStatuses.map((status) => (
                  <option key={status} value={status}>{tenderStatusLabels[status]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Procedura
              <select className={inputClassName} defaultValue={tender.procedure_type ?? ""} name="procedureType">
                <option value="">Non indicata</option>
                {tenderProcedureTypes.map((procedureType) => (
                  <option key={procedureType} value={procedureType}>{tenderProcedureTypeLabels[procedureType]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Ente acquirente
              <input className={inputClassName} defaultValue={tender.buyer_name ?? ""} maxLength={200} name="buyerName" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Scadenza per la presentazione
              <input className={inputClassName} defaultValue={tenderDeadlineInputValue(tender.submission_deadline)} name="submissionDeadline" type="datetime-local" />
              <span className="block text-xs font-normal text-muted-foreground">Orario Italia.</span>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              CIG
              <input className={inputClassName} defaultValue={tender.cig ?? ""} maxLength={40} name="cig" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              CUP
              <input className={inputClassName} defaultValue={tender.cup ?? ""} maxLength={40} name="cup" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Valore stimato
              <input className={inputClassName} defaultValue={tender.estimated_value ?? ""} inputMode="decimal" name="estimatedValue" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Valuta
              <input className={inputClassName} defaultValue={tender.currency} maxLength={3} name="currency" required />
            </label>
            <label className="space-y-1.5 text-sm font-medium lg:col-span-2">
              Link alla fonte
              <input className={inputClassName} defaultValue={tender.source_url ?? ""} maxLength={2048} name="sourceUrl" type="url" />
            </label>
            <label className="space-y-1.5 text-sm font-medium lg:col-span-2">
              Descrizione
              <textarea className="min-h-20 w-full rounded-lg border bg-background px-2.5 py-2 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30" defaultValue={tender.description ?? ""} maxLength={4000} name="description" />
            </label>
            <label className="space-y-1.5 text-sm font-medium lg:col-span-2">
              Note interne
              <textarea className="min-h-20 w-full rounded-lg border bg-background px-2.5 py-2 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30" defaultValue={tender.notes ?? ""} maxLength={5000} name="notes" />
            </label>
            <div className="flex justify-end lg:col-span-2">
              <Button size="sm" type="submit">Salva modifiche</Button>
            </div>
          </form>
        </details>
      ) : (
        <dl className="mt-5 grid gap-4 border-t pt-5 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Ente acquirente</dt><dd className="mt-1 font-medium">{tender.buyer_name || "Non indicato"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Valore stimato</dt><dd className="mt-1 font-medium">{formatTenderCurrency(tender.estimated_value, tender.currency)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">CIG</dt><dd className="mt-1 font-medium">{tender.cig || "Non indicato"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">CUP</dt><dd className="mt-1 font-medium">{tender.cup || "Non indicato"}</dd></div>
          {tender.description ? <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Descrizione</dt><dd className="mt-1 leading-6">{tender.description}</dd></div> : null}
          {tender.notes ? <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Note interne</dt><dd className="mt-1 leading-6">{tender.notes}</dd></div> : null}
        </dl>
      )}

      {canManage && tender.status !== "archived" ? (
        <form action={archiveTenderAction} className="mt-5 border-t pt-4">
          <input name="organizationSlug" type="hidden" value={organizationSlug} />
          <input name="tenderId" type="hidden" value={tender.id} />
          <Button size="sm" type="submit" variant="ghost">
            <Archive aria-hidden="true" className="size-3.5" />
            Archivia gara
          </Button>
        </form>
      ) : null}
    </section>
  );
}
