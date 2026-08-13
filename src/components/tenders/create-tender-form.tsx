import { ClipboardPlus, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createTenderAction } from "@/features/tenders/actions";
import {
  tenderProcedureTypeLabels,
  tenderProcedureTypes,
} from "@/features/tenders/constants";

type CreateTenderFormProps = {
  organizationSlug: string;
};

const inputClassName = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30";

export function CreateTenderForm({ organizationSlug }: CreateTenderFormProps) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ClipboardPlus aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Nuova gara</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Crea un workspace per raccogliere le informazioni e i documenti sorgente della procedura.
          </p>
        </div>
      </div>

      <form action={createTenderAction} className="mt-6 grid gap-4 lg:grid-cols-2">
        <input name="organizationSlug" type="hidden" value={organizationSlug} />
        <label className="space-y-2 text-sm font-medium lg:col-span-2">
          Titolo della gara
          <input className={inputClassName} maxLength={200} minLength={2} name="title" placeholder="Es. Servizi di manutenzione per il Comune di …" required />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Ente acquirente <span className="font-normal text-muted-foreground">(facoltativo)</span>
          <input className={inputClassName} maxLength={200} name="buyerName" placeholder="Es. Comune di Milano" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Procedura <span className="font-normal text-muted-foreground">(facoltativa)</span>
          <select className={inputClassName} defaultValue="" name="procedureType">
            <option value="">Non indicata</option>
            {tenderProcedureTypes.map((procedureType) => (
              <option key={procedureType} value={procedureType}>{tenderProcedureTypeLabels[procedureType]}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Scadenza per la presentazione <span className="font-normal text-muted-foreground">(facoltativa)</span>
          <input className={inputClassName} name="submissionDeadline" type="datetime-local" />
          <span className="block text-xs font-normal text-muted-foreground">Orario Italia.</span>
        </label>
        <label className="space-y-2 text-sm font-medium">
          CIG <span className="font-normal text-muted-foreground">(facoltativo)</span>
          <input className={inputClassName} maxLength={40} name="cig" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          CUP <span className="font-normal text-muted-foreground">(facoltativo)</span>
          <input className={inputClassName} maxLength={40} name="cup" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Valore stimato <span className="font-normal text-muted-foreground">(facoltativo)</span>
          <input className={inputClassName} inputMode="decimal" name="estimatedValue" placeholder="Es. 250000,00" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Valuta
          <input className={inputClassName} defaultValue="EUR" maxLength={3} name="currency" required />
        </label>
        <label className="space-y-2 text-sm font-medium lg:col-span-2">
          Link alla fonte <span className="font-normal text-muted-foreground">(facoltativo)</span>
          <input className={inputClassName} maxLength={2048} name="sourceUrl" placeholder="https://…" type="url" />
        </label>
        <label className="space-y-2 text-sm font-medium lg:col-span-2">
          Descrizione <span className="font-normal text-muted-foreground">(facoltativa)</span>
          <textarea className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30" maxLength={4000} name="description" placeholder="Contesto utile per il team, senza conclusioni automatiche." />
        </label>
        <label className="space-y-2 text-sm font-medium lg:col-span-2">
          Note interne <span className="font-normal text-muted-foreground">(facoltative)</span>
          <textarea className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30" maxLength={5000} name="notes" placeholder="Informazioni operative iniziali del team." />
        </label>
        <div className="flex flex-col gap-3 border-t pt-5 lg:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex max-w-xl items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            La gara resta privata nel workspace. Le verifiche di requisiti e conformità non sono ancora attive.
          </p>
          <Button size="lg" type="submit">Crea workspace gara</Button>
        </div>
      </form>
    </section>
  );
}
