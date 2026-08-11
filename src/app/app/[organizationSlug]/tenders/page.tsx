import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/app-shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { loadOrganizationContext } from "@/features/organizations/context";
import { cn } from "@/lib/utils";

type TendersPageProps = { params: Promise<{ organizationSlug: string }> };

export default async function TendersPage({ params }: TendersPageProps) {
  const { organizationSlug } = await params;
  const context = await loadOrganizationContext(organizationSlug);

  if (!context) return null;

  return (
    <EmptyState
      eyebrow="Gare"
      icon={<ClipboardList aria-hidden="true" className="size-5" />}
      title="Le workspace di gara saranno organizzate qui."
      description="Questa area ospiterà le opportunità, i requisiti e le verifiche del team. In questa fase non sono ancora presenti dati di gara né analisi automatizzate."
    >
      <Link className={cn(buttonVariants({ variant: "outline" }))} href={`/app/${context.organization.slug}/team`}>
        Gestisci il team
      </Link>
    </EmptyState>
  );
}
