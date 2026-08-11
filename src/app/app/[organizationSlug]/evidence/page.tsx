import { Archive } from "lucide-react";

import { EmptyState } from "@/components/app-shell/empty-state";
import { loadOrganizationContext } from "@/features/organizations/context";

type EvidencePageProps = { params: Promise<{ organizationSlug: string }> };

export default async function EvidencePage({ params }: EvidencePageProps) {
  const { organizationSlug } = await params;
  const context = await loadOrganizationContext(organizationSlug);

  if (!context) return null;

  return (
    <EmptyState
      eyebrow="Archivio evidenze"
      icon={<Archive aria-hidden="true" className="size-5" />}
      title="L&apos;archivio aziendale sarà disponibile qui."
      description="Qui il team manterrà documenti ed evidenze riutilizzabili per le future verifiche. Al momento TenderAI non raccoglie né elabora documenti in questo workspace."
    />
  );
}
