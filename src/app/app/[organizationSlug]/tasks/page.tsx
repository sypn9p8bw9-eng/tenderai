import { ListTodo } from "lucide-react";

import { EmptyState } from "@/components/app-shell/empty-state";
import { loadOrganizationContext } from "@/features/organizations/context";

type TasksPageProps = { params: Promise<{ organizationSlug: string }> };

export default async function TasksPage({ params }: TasksPageProps) {
  const { organizationSlug } = await params;
  const context = await loadOrganizationContext(organizationSlug);

  if (!context) return null;

  return (
    <EmptyState
      eyebrow="Attività"
      icon={<ListTodo aria-hidden="true" className="size-5" />}
      title="Le attività del team saranno disponibili qui."
      description="Questa area collegherà persone, scadenze e controlli alle future workspace di gara. In questa fase non vengono creati promemoria o attività automatiche."
    />
  );
}
