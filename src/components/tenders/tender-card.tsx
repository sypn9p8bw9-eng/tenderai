import { ArrowRight, Building2, CalendarDays } from "lucide-react";
import Link from "next/link";

import {
  formatTenderDeadline,
  tenderStatusLabels,
} from "@/features/tenders/constants";
import type { Tender } from "@/features/tenders/queries";

type TenderCardProps = {
  tender: Tender;
  organizationSlug: string;
};

const statusClassNames = {
  draft: "border-border bg-muted text-muted-foreground",
  evaluating: "border-sky-200 bg-sky-50 text-sky-800",
  in_progress: "border-amber-200 bg-amber-50 text-amber-800",
  submitted: "border-violet-200 bg-violet-50 text-violet-800",
  won: "border-emerald-200 bg-emerald-50 text-emerald-800",
  lost: "border-rose-200 bg-rose-50 text-rose-800",
  archived: "border-border bg-muted text-muted-foreground",
} as const;

export function TenderCard({ tender, organizationSlug }: TenderCardProps) {
  return (
    <Link
      className="group block rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md sm:p-6"
      href={`/app/${organizationSlug}/tenders/${tender.id}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight">{tender.title}</h2>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClassNames[tender.status]}`}>
              {tenderStatusLabels[tender.status]}
            </span>
          </div>
          {tender.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{tender.description}</p> : null}
        </div>
        <ArrowRight aria-hidden="true" className="hidden size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary sm:block" />
      </div>

      <dl className="mt-5 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2 text-muted-foreground">
          <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <div><dt className="text-xs">Ente acquirente</dt><dd className="mt-0.5 font-medium text-foreground">{tender.buyer_name || "Non indicato"}</dd></div>
        </div>
        <div className="flex items-start gap-2 text-muted-foreground">
          <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <div><dt className="text-xs">Scadenza</dt><dd className="mt-0.5 font-medium text-foreground">{formatTenderDeadline(tender.submission_deadline)}</dd></div>
        </div>
      </dl>
    </Link>
  );
}
